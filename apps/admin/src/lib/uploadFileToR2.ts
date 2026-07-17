/**
 * uploadFileToR2
 *
 * Upload a file attachment to R2 for chapter downloads.
 * Three-step direct-upload flow:
 *   1. POST /api/admin/files/presign  → { uploadUrl, fileKey }
 *   2. XHR PUT directly to R2
 *   3. POST /api/admin/files/confirm  → { fileKey, size, contentType }
 */

import { api } from "@/lib/api";

export interface UploadFileContext {
  courseId: string;
  moduleId: string;
}

export interface UploadedFile {
  fileKey: string;
  filename: string;
  size: number;
  mimeType: string;
}

export function makeUploadFileFn(ctx: UploadFileContext) {
  return async function uploadFile(
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<UploadedFile> {
    const mimeType = file.type || "application/octet-stream";
    const filename = file.name;

    // Step 1: presign
    const presignRes = await api<{ uploadUrl: string; fileKey: string }>("/api/admin/files/presign", {
      method: "POST",
      body: JSON.stringify({ courseId: ctx.courseId, moduleId: ctx.moduleId, filename, mimeType }),
    });

    if (!presignRes.success || !presignRes.data?.uploadUrl) {
      throw new Error(presignRes.message ?? "Failed to get file upload URL");
    }

    const { uploadUrl, fileKey } = presignRes.data;

    // Step 2: PUT to R2
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`R2 file upload failed (HTTP ${xhr.status})`));
      });
      xhr.addEventListener("error", () => reject(new Error("Network error uploading file")));
      xhr.addEventListener("abort", () => reject(new Error("File upload cancelled")));
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", mimeType);
      xhr.send(file);
    });

    if (onProgress) onProgress(100);

    // Step 3: confirm
    const confirmRes = await api<{ fileKey: string; size: number; contentType: string }>("/api/admin/files/confirm", {
      method: "POST",
      body: JSON.stringify({ fileKey }),
    });

    if (!confirmRes.success || !confirmRes.data?.fileKey) {
      throw new Error(confirmRes.message ?? "File upload confirmation failed");
    }

    return {
      fileKey: confirmRes.data.fileKey,
      filename,
      size: confirmRes.data.size,
      mimeType: confirmRes.data.contentType,
    };
  };
}
