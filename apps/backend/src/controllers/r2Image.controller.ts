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
// Image serving — streams the image from R2 so no CORS/CSP issues on clients.
// ---------------------------------------------------------------------------
export const serveImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const key = req.params[0] || "";

  if (!key || !key.startsWith("images/")) {
    throw new AppError("Invalid image key", 400);
  }

  // Allow any origin — images are public content embedded in courses and marketing site
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // If R2_PUBLIC_DOMAIN is set, redirect there directly (permanent)
  const publicDomain = process.env.R2_PUBLIC_DOMAIN?.trim().replace(/\/$/, "");
  if (publicDomain) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.redirect(301, `${publicDomain}/${key}`);
    return;
  }

  // Otherwise: stream the image through the backend (avoids CORS/CSP issues)
  const signedUrl = await generateSignedImageUrl(key);
  const upstream = await fetch(signedUrl);
  if (!upstream.ok) {
    throw new AppError("Image not found", 404);
  }
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const contentLength = upstream.headers.get("content-length");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  if (contentLength) res.setHeader("Content-Length", contentLength);
  // Stream the response body
  const buffer = await upstream.arrayBuffer();
  res.end(Buffer.from(buffer));
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
