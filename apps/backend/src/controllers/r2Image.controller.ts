/**
 * R2 image controller — direct browser-to-R2 upload via presigned URLs.
 *
 * Endpoints:
 *
 *   POST /api/admin/images/presign
 *     Body:    { courseId, moduleId, mimeType }
 *     Returns: { uploadUrl, imageKey, publicUrl, expiresInSeconds }
 *
 *   POST /api/admin/images/confirm
 *     Body:    { imageKey }
 *     Returns: { imageKey, publicUrl, size, contentType }
 *
 *   GET  /api/admin/images/serve/:key
 *     Redirects to a presigned GET URL (fallback when R2_PUBLIC_DOMAIN is not set)
 *
 *   DELETE /api/admin/images
 *     Body:    { imageKey }
 *     Returns: { deleted: true }
 */

import type { Request, Response } from "express";
import {
  generatePresignedImageUploadUrl,
  confirmImageUpload,
  deleteImageFromR2,
  generateSignedImageUrl,
  buildImagePublicUrl,
  ALLOWED_IMAGE_MIME_TYPES,
} from "../services/r2Image.service.js";
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
// POST /api/admin/images/presign
// ---------------------------------------------------------------------------
export const presignImageUpload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const courseId = String(req.body?.courseId ?? "").trim();
  const moduleId = String(req.body?.moduleId ?? "").trim();
  const mimeType = String(req.body?.mimeType ?? "image/jpeg").trim();

  assertSafeSegment(courseId, "courseId");
  assertSafeSegment(moduleId, "moduleId");

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new AppError(
      `Unsupported file type "${mimeType}". Allowed: jpeg, png, gif, webp, svg.`,
      400
    );
  }

  const { uploadUrl, imageKey, publicUrl } = await generatePresignedImageUploadUrl(courseId, moduleId, mimeType);

  successRes(
    res,
    { uploadUrl, imageKey, publicUrl, expiresInSeconds: 15 * 60 },
    "Presigned image upload URL issued",
    201
  );
});

// ---------------------------------------------------------------------------
// POST /api/admin/images/confirm
// ---------------------------------------------------------------------------
export const confirmImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { imageKey } = req.body ?? {};

  if (!imageKey || typeof imageKey !== "string") {
    throw new AppError("imageKey is required", 400);
  }

  // Validate it looks like an image path
  if (!imageKey.startsWith("images/")) {
    throw new AppError("imageKey must start with 'images/'", 400);
  }

  const { size, contentType } = await confirmImageUpload(imageKey);
  const publicUrl = buildImagePublicUrl(imageKey);

  successRes(res, { imageKey, publicUrl, size, contentType }, "Image upload confirmed");
});

// ---------------------------------------------------------------------------
// GET /api/admin/images/serve/:key(*)
// Fallback image serving — redirects to a presigned GET URL.
// Used only when R2_PUBLIC_DOMAIN is not configured.
// ---------------------------------------------------------------------------
export const serveImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Express wildcard: /serve/* captures everything after /serve/ in req.params[0]
  const key = req.params[0] || "";

  if (!key || !key.startsWith("images/")) {
    throw new AppError("Invalid image key", 400);
  }

  const signedUrl = await generateSignedImageUrl(key);
  // Cache the redirect for 1 hour — the presigned URL is valid for 7 days
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.redirect(302, signedUrl);
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/images
// ---------------------------------------------------------------------------
export const deleteImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { imageKey } = req.body ?? {};

  if (!imageKey || typeof imageKey !== "string") {
    throw new AppError("imageKey is required", 400);
  }
  if (!imageKey.startsWith("images/")) {
    throw new AppError("imageKey must start with 'images/'", 400);
  }

  await deleteImageFromR2(imageKey);
  successRes(res, { deleted: true }, "Image deleted");
});
