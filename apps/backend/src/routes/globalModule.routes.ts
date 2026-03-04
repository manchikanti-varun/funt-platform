
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
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateModule);
router.post("/:id/versions/restore", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), restoreVersion);

export const globalModuleRoutes = router;
