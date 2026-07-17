
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { listAuditLogs } from "../controllers/audit.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/", requireRoles(ROLE.SUPER_ADMIN), listAuditLogs);

export const auditRoutes = router;
