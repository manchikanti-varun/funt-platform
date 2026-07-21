/**
 * R2 video routes — mounted under /api/admin/videos
 *
 * POST   /api/admin/videos/presign   — issue presigned PUT URL for direct R2 upload
 * POST   /api/admin/videos/confirm   — verify the upload landed; returns videoKey
 * DELETE /api/admin/videos           — delete by videoKey
 *
 * No multer / multipart handling here. Railway only processes small JSON bodies.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  presignVideoUpload,
  confirmVideo,
  deleteVideo,
  getVideoPreview,
} from "../controllers/r2Video.controller.js";

const router = Router();

router.use(authMiddleware);

/**
 * POST /api/admin/videos/presign
 * JSON body: { courseId, moduleId, lessonId?, mimeType? }
 * Returns:   { uploadUrl, videoKey, expiresInSeconds }
 */
router.post(
  "/presign",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  presignVideoUpload
);

/**
 * POST /api/admin/videos/confirm
 * JSON body: { videoKey }
 * Returns:   { videoKey, size, contentType }
 */
router.post(
  "/confirm",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  confirmVideo
);

/**
 * GET /api/admin/videos/preview?key=r2://...
 * Returns: { previewUrl } — short-lived presigned GET URL for admin video preview
 */
router.get(
  "/preview",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN, ROLE.TRAINER),
  getVideoPreview
);

/**
 * DELETE /api/admin/videos
 * JSON body: { videoKey }
 * Returns:   { deleted: true }
 */
router.delete(
  "/",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  deleteVideo
);

export const r2VideoRoutes = router;
