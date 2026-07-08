
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createModule,
  listModules,
  getModule,
  updateModule,
  archiveModule,
  unarchiveModule,
  deleteModule,
  duplicateModule,
  restoreVersion,
} from "../controllers/globalModule.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createModule);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listModules);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getModule);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateModule);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveModule);
router.patch("/:id/unarchive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), unarchiveModule);
router.delete("/:id", requireRoles(ROLE.SUPER_ADMIN), deleteModule);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateModule);
router.post("/:id/versions/restore", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), restoreVersion);

// ── Temporary: Export chapter as Word doc (Super Admin only) ──────────────────
router.get("/:id/export-doc", requireRoles(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { exportChapterAsDoc } = await import("../services/chapterExport.service.js");
    const { html, filename } = await exportChapterAsDoc(req.params.id);
    res.setHeader("Content-Type", "application/msword");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err) { next(err); }
});

export const globalModuleRoutes = router;
