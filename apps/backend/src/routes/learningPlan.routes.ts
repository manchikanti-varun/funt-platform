/**
 * Learning Plan Routes
 *
 * Course config (admin):
 *   PUT    /api/courses/:id/learning-plan              — save full plan
 *   PUT    /api/courses/:id/learning-plan/milestones   — upsert single milestone
 *   DELETE /api/courses/:id/learning-plan/milestones/:milestoneId
 *   POST   /api/courses/:id/learning-plan/sync-to-batch/:batchId
 *
 * Student:
 *   GET    /api/student/courses/:courseId/milestones   — milestone status for LMS
 *
 * Admin student management:
 *   GET    /api/admin/batches/:batchId/students/:studentId/milestones
 *   PATCH  /api/admin/milestones/:milestoneId/unlock
 *   PATCH  /api/admin/milestones/:milestoneId/lock
 *   PATCH  /api/admin/milestones/:milestoneId/reset
 *   PATCH  /api/admin/milestones/:milestoneId/extend-due
 *
 * Analytics:
 *   GET    /api/analytics/learning-plans
 *   POST   /api/admin/learning-plan/process-overdue
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  putLearningPlan,
  putMilestone,
  deleteMilestoneHandler,
  postSyncToBatch,
  getStudentMilestones,
  getAdminStudentMilestones,
  patchAdminUnlock,
  patchAdminLock,
  patchAdminReset,
  patchAdminSkip,
  patchExtendDue,
  postGenerateMilestoneKey,
  getLearningPlanAnalyticsHandler,
  postProcessOverdue,
} from "../controllers/learningPlan.controller.js";

const ADMIN_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN] as const;
const STUDENT_ROLES = [ROLE.STUDENT, ROLE.PARENT] as const;

// ── Course config router (mounted at /api/courses/:id) ─────────────────────
export const courseLearningPlanRouter = Router({ mergeParams: true });
courseLearningPlanRouter.use(authMiddleware);

courseLearningPlanRouter.put("/",                            requireRoles(...ADMIN_ROLES), putLearningPlan);
courseLearningPlanRouter.put("/milestones",                  requireRoles(...ADMIN_ROLES), putMilestone);
courseLearningPlanRouter.delete("/milestones/:milestoneId",  requireRoles(...ADMIN_ROLES), deleteMilestoneHandler);
courseLearningPlanRouter.post("/sync-to-batch/:batchId",     requireRoles(...ADMIN_ROLES), postSyncToBatch);

// ── Student router (mounted at /api/student) ───────────────────────────────
export const studentMilestoneRouter = Router({ mergeParams: true });
studentMilestoneRouter.use(authMiddleware);
studentMilestoneRouter.get("/courses/:courseId/milestones", requireRoles(...STUDENT_ROLES), getStudentMilestones);

// ── Admin management router (mounted at /api/admin) ────────────────────────
export const adminMilestoneRouter = Router();
adminMilestoneRouter.use(authMiddleware, requireRoles(...ADMIN_ROLES));

adminMilestoneRouter.get("/batches/:batchId/students/:studentId/milestones", getAdminStudentMilestones);
adminMilestoneRouter.patch("/milestones/:milestoneId/unlock",     patchAdminUnlock);
adminMilestoneRouter.patch("/milestones/:milestoneId/lock",       patchAdminLock);
adminMilestoneRouter.patch("/milestones/:milestoneId/reset",      patchAdminReset);
adminMilestoneRouter.patch("/milestones/:milestoneId/skip",       patchAdminSkip);
adminMilestoneRouter.patch("/milestones/:milestoneId/extend-due", patchExtendDue);
adminMilestoneRouter.post("/milestones/:milestoneId/generate-key", postGenerateMilestoneKey);
adminMilestoneRouter.post("/learning-plan/process-overdue",       postProcessOverdue);

// ── Analytics router (mounted at /api/analytics) ──────────────────────────
export const learningPlanAnalyticsRouter = Router();
learningPlanAnalyticsRouter.use(authMiddleware, requireRoles(...ADMIN_ROLES));
learningPlanAnalyticsRouter.get("/learning-plans", getLearningPlanAnalyticsHandler);
