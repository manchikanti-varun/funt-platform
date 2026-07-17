/**
 * Content Protection routes.
 *
 * Admin (config):
 *   GET  /api/config/content-protection   — super admin + admin: read settings
 *   PUT  /api/config/content-protection   — super admin only: write settings
 *
 * Student (LMS):
 *   GET  /api/student/content-protection         — get effective policy + watermark identity
 *   POST /api/student/content-protection/events  — log a security event
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { updateContentProtectionSchema } from "../schemas/index.js";
import {
  getGlobalContentProtection,
  updateGlobalContentProtection,
  getStudentContentProtection,
  postProtectionEvent,
} from "../controllers/contentProtection.controller.js";

// ── Admin config router ───────────────────────────────────────────────────────
const configRouter = Router();
configRouter.use(authMiddleware);
configRouter.get(
  "/",
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN),
  getGlobalContentProtection
);
configRouter.put(
  "/",
  requireRoles(ROLE.SUPER_ADMIN),
  validateBody(updateContentProtectionSchema),
  updateGlobalContentProtection
);
export const contentProtectionConfigRoutes = configRouter;

// ── Student LMS router ────────────────────────────────────────────────────────
const studentRouter = Router();
studentRouter.use(authMiddleware, requireRoles(ROLE.STUDENT));
studentRouter.get("/", getStudentContentProtection);
studentRouter.post("/events", postProtectionEvent);
export const contentProtectionStudentRoutes = studentRouter;
