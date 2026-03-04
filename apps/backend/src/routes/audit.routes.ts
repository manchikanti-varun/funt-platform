/**
 * Audit routes – list logs (Super Admin only).
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { listAuditLogs } from "../controllers/audit.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/", listAuditLogs);

export const auditRoutes = router;
