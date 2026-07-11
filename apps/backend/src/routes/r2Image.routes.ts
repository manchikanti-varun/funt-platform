/**
 * R2 image routes — mounted under /api/admin/images
 *
 * POST   /api/admin/images/presign   — issue presigned PUT URL for direct R2 upload
 * POST   /api/admin/images/confirm   — verify the upload landed; returns publicUrl
 * GET    /api/admin/images/serve/*   — fallback: redirect to presigned GET URL
 * DELETE /api/admin/images           — delete by imageKey
 *
 * No multer / multipart handling here. Railway only processes small JSON bodies.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  presignImageUpload,
  confirmImage,
  serveImage,
  deleteImage,
} from "../controllers/r2Image.controller.js";

const router = Router();

/**
 * GET /api/admin/images/serve/*
 * Fallback image serving when R2_PUBLIC_DOMAIN is not configured.
 * Public endpoint — images embedded in chapter content must be viewable by anyone
 * (students, unauthenticated previews, etc.)
 */
router.get(
  "/serve/*",
  serveImage
);

// All other endpoints require authentication
router.use(authMiddleware);

/**
 * POST /api/admin/images/presign
 * JSON body: { courseId, moduleId, mimeType }
 * Returns:   { uploadUrl, imageKey, publicUrl, expiresInSeconds }
 */
router.post(
  "/presign",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  presignImageUpload
);

/**
 * POST /api/admin/images/confirm
 * JSON body: { imageKey }
 * Returns:   { imageKey, publicUrl, size, contentType }
 */
router.post(
  "/confirm",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  confirmImage
);

/**
 * DELETE /api/admin/images
 * JSON body: { imageKey }
 * Returns:   { deleted: true }
 */
router.delete(
  "/",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  deleteImage
);

export const r2ImageRoutes = router;
