/**
 * R2 video controller — direct browser-to-R2 upload via presigned URLs.
 *
 * Multer is NOT used. Railway never buffers video bytes.
 *
 * Endpoints:
 *
 *   POST /api/admin/videos/presign
 *     Body:    { courseId, moduleId, lessonId? }
 *     Returns: { uploadUrl, videoKey, expiresInSeconds }
 *     The browser PUTs the MP4 file directly to uploadUrl with
 *     Content-Type: video/mp4. No auth header required on the PUT
 *     because the presigned URL carries the credentials.
 *
 *   POST /api/admin/videos/confirm
 *     Body:    { videoKey }
 *     Returns: { videoKey, size, contentType }
 *     Call this after the browser PUT succeeds. The backend does a
 *     HeadObject to verify the file is in R2, then returns the key
 *     the frontend should persist into the chapter's videoUrl field.
 *
 *   DELETE /api/admin/videos
 *     Body:    { videoKey }
 *     Returns: { deleted: true }
 *     Removes the R2 object. Used when replacing or removing a video.
 */

import type { Request, Response } from "express";
import {
  generatePresignedUploadUrl,
  confirmVideoUpload,
  deleteVideoFromR2,
  r2KeyFromVideoUrl,
  ALLOWED_VIDEO_MIME_TYPES,
} from "../services/r2Video.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

/** Path segments may only contain alphanumeric chars, hyphens, and underscores. */
const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

function assertSafeSegment(value: string, name: string): void {
  if (!value) throw new AppError(`${name} is required`, 400);
  if (!SAFE_SEGMENT.test(value)) {
    throw new AppError(`${name} contains invalid characters (only a-z, A-Z, 0-9, - and _ are allowed)`, 400);
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/videos/presign
// ---------------------------------------------------------------------------
export const presignVideoUpload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const courseId = String(req.body?.courseId ?? "").trim();
  const moduleId = String(req.body?.moduleId ?? "").trim();
  // lessonId is optional — defaults to moduleId when absent
  const lessonId = String(req.body?.lessonId ?? moduleId).trim();
  const mimeType = String(req.body?.mimeType ?? "video/mp4").trim();

  assertSafeSegment(courseId, "courseId");
  assertSafeSegment(moduleId, "moduleId");
  assertSafeSegment(lessonId, "lessonId");

  if (!ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
    throw new AppError(
      `Unsupported file type "${mimeType}". Only video/mp4 is accepted.`,
      400
    );
  }

  const { uploadUrl, videoKey } = await generatePresignedUploadUrl(courseId, moduleId, lessonId);

  successRes(
    res,
    {
      uploadUrl,
      videoKey,
      expiresInSeconds: 15 * 60,
    },
    "Presigned upload URL issued",
    201
  );
});

// ---------------------------------------------------------------------------
// POST /api/admin/videos/confirm
// ---------------------------------------------------------------------------
export const confirmVideo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { videoKey } = req.body ?? {};

  if (!videoKey || typeof videoKey !== "string") {
    throw new AppError("videoKey is required", 400);
  }
  if (!videoKey.startsWith("r2://")) {
    throw new AppError("videoKey must start with 'r2://'", 400);
  }

  const key = r2KeyFromVideoUrl(videoKey);
  const { size, contentType } = await confirmVideoUpload(key);

  successRes(res, { videoKey, size, contentType }, "Upload confirmed");
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/videos
// ---------------------------------------------------------------------------
export const deleteVideo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { videoKey } = req.body ?? {};

  if (!videoKey || typeof videoKey !== "string") {
    throw new AppError("videoKey is required", 400);
  }
  if (!videoKey.startsWith("r2://")) {
    throw new AppError("videoKey must start with 'r2://'", 400);
  }

  const key = r2KeyFromVideoUrl(videoKey);
  await deleteVideoFromR2(key);

  successRes(res, { deleted: true }, "Video deleted");
});
