/**
 * uploadVideoToR2
 *
 * Creates an uploadVideo callback suitable for passing to <RichTextEditor>.
 * Performs the three-step direct-upload flow:
 *   1. POST /api/admin/videos/presign  → { uploadUrl, videoKey }
 *   2. XHR PUT directly to R2          → real progress events, 0 Railway bandwidth
 *   3. POST /api/admin/videos/confirm  → verifies object exists, returns videoKey
 *
 * Returns a playable path that the editor stores as the video src.
 * The path is "/api/student/media/play?token=..." at student playback time,
 * but for the editor we store the r2:// key directly so the admin can see
 * what was uploaded. The LMS resolves it to a signed URL at play time.
 *
 * NOTE: for the editor's <video src> we need a URL the browser can actually
 * load for preview. We return the raw R2 presigned GET URL for the admin
 * preview (generated after confirm). Students get the signed URL via the
 * normal playback flow.
 */

import { api } from "@/lib/api";

export interface UploadVideoContext {
  courseId: string;
  moduleId: string;
  lessonId?: string;
}

/**
 * Returns an uploadVideo function bound to the given course/module context.
 * Pass this directly to <RichTextEditor uploadVideo={...} />.
 */
export function makeUploadVideoFn(ctx: UploadVideoContext) {
  return async function uploadVideo(
    file: File,
    onProgress: (pct: number) => void
  ): Promise<{ url: string }> {
    // ── Step 1: get presigned PUT URL ────────────────────────────────────
    const presignRes = await api<{
      uploadUrl: string;
      videoKey: string;
      expiresInSeconds: number;
    }>("/api/admin/videos/presign", {
      method: "POST",
      body: JSON.stringify({
        courseId: ctx.courseId,
        moduleId: ctx.moduleId,
        lessonId: ctx.lessonId ?? ctx.moduleId,
        mimeType: file.type,
      }),
    });

    if (!presignRes.success || !presignRes.data?.uploadUrl) {
      throw new Error(presignRes.message ?? "Failed to get upload URL");
    }

    const { uploadUrl, videoKey } = presignRes.data;

    // ── Step 2: PUT directly to R2 ───────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`R2 upload failed (HTTP ${xhr.status})`));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Network error uploading to R2")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", "video/mp4");
      xhr.send(file);
    });

    onProgress(100);

    // ── Step 3: confirm with backend ─────────────────────────────────────
    const confirmRes = await api<{ videoKey: string; size: number }>(
      "/api/admin/videos/confirm",
      {
        method: "POST",
        body: JSON.stringify({ videoKey }),
      }
    );

    if (!confirmRes.success || !confirmRes.data?.videoKey) {
      throw new Error(confirmRes.message ?? "Upload confirmation failed");
    }

    // Return the r2:// key as the video src.
    // The editor stores this in HTML as <video src="r2://...">
    // The LMS sanitizer and player will resolve it to a signed URL at playback.
    // For admin preview we return the key — the video won't play in the editor
    // but it will be stored correctly and play for students.
    return { url: confirmRes.data.videoKey };
  };
}
