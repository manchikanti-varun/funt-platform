/**
 * uploadImageToR2
 *
 * Creates an uploadImage callback suitable for passing to <RichTextEditor>.
 * Performs the three-step direct-upload flow:
 *   1. POST /api/admin/images/presign  → { uploadUrl, imageKey, publicUrl }
 *   2. XHR PUT directly to R2          → 0 Railway bandwidth
 *   3. POST /api/admin/images/confirm  → verifies object exists, returns publicUrl
 *
 * Returns { url, alt } which the editor uses to replace the base64 placeholder
 * with the permanent R2-hosted URL.
 */

import { api } from "@/lib/api";

export interface UploadImageContext {
  courseId: string;
  moduleId: string;
}

/**
 * Returns an uploadImage function bound to the given course/module context.
 * Pass this directly to <RichTextEditor uploadImage={...} />.
 */
export function makeUploadImageFn(ctx: UploadImageContext) {
  return async function uploadImage(
    file: File
  ): Promise<{ url: string; alt?: string }> {
    const mimeType = file.type || "image/jpeg";

    // ── Step 1: get presigned PUT URL ────────────────────────────────────
    const presignRes = await api<{
      uploadUrl: string;
      imageKey: string;
      publicUrl: string;
      expiresInSeconds: number;
    }>("/api/admin/images/presign", {
      method: "POST",
      body: JSON.stringify({
        courseId: ctx.courseId,
        moduleId: ctx.moduleId,
        mimeType,
      }),
    });

    if (!presignRes.success || !presignRes.data?.uploadUrl) {
      throw new Error(presignRes.message ?? "Failed to get image upload URL");
    }

    const { uploadUrl, imageKey } = presignRes.data;

    // ── Step 2: PUT directly to R2 ───────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`R2 image upload failed (HTTP ${xhr.status})`));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Network error uploading image to R2")));
      xhr.addEventListener("abort", () => reject(new Error("Image upload cancelled")));
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", mimeType);
      xhr.send(file);
    });

    // ── Step 3: confirm with backend ─────────────────────────────────────
    const confirmRes = await api<{ imageKey: string; publicUrl: string; size: number }>(
      "/api/admin/images/confirm",
      {
        method: "POST",
        body: JSON.stringify({ imageKey }),
      }
    );

    if (!confirmRes.success || !confirmRes.data?.publicUrl) {
      throw new Error(confirmRes.message ?? "Image upload confirmation failed");
    }

    return {
      url: confirmRes.data.publicUrl,
      alt: file.name.replace(/\.[^.]+$/, ""),
    };
  };
}
