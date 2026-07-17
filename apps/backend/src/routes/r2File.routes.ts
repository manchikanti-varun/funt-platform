/**
 * R2 file routes — mounted under /api/admin/files
 *
 * POST   /api/admin/files/presign   — issue presigned PUT URL for direct R2 upload
 * POST   /api/admin/files/confirm   — verify the upload landed
 * DELETE /api/admin/files           — delete by fileKey
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { presignFileUpload, confirmFile, deleteFile } from "../controllers/r2File.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/presign", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), presignFileUpload);
router.post("/confirm", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), confirmFile);
router.delete("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), deleteFile);

export const r2FileRoutes = router;
