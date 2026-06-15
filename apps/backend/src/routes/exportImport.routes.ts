/**
 * Import / Export Routes
 *
 * POST /api/admin/export           — Generate + download ZIP export
 * POST /api/admin/import/preview   — Preview import (conflicts)
 * POST /api/admin/import           — Execute import
 *
 * Permissions:
 *   SUPER_ADMIN: Full export (all levels) + Full import + Restore
 *   ADMIN: Level 1-2 export + Level 1-2 import
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { postExport, postImportPreview, postImport } from "../controllers/exportImport.controller.js";

const router = Router();
router.use(authMiddleware);

// Export — ADMIN can export Level 1-2, SUPER_ADMIN can export all
router.post("/export", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postExport);

// Import — preview is allowed for both, execution requires SUPER_ADMIN for Level 3-4
router.post("/import/preview", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postImportPreview);
router.post("/import", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postImport);

export const exportImportRoutes = router;
