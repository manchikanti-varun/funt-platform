import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import {
  saveLearningPlan,
  upsertMilestone,
  deleteMilestone,
  syncLearningPlanToBatch,
  getStudentMilestoneStatus,
  adminUnlockMilestone,
  adminLockMilestone,
  adminResetMilestone,
  adminSkipMilestone,
  extendPaymentDueDate,
  getLearningPlanAnalytics,
  flagOverdueMilestones,
} from "../services/learningPlan.service.js";
import { findBatchByParam, getBatchCourseSnapshots } from "../services/batch.service.js";
import { MilestoneProgressModel } from "../models/MilestoneProgress.model.js";
import { generateMilestoneLicenseKeys } from "../services/licenseKey.service.js";

function uid(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

// ── Course learning plan config (admin) ────────────────────────────────────

// PUT /api/courses/:id/learning-plan
export const putLearningPlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const courseId = req.params.id;
  const { enabled, autoLockPreviousMilestones, milestones } = req.body ?? {};
  const result = await saveLearningPlan(courseId, { enabled: !!enabled, autoLockPreviousMilestones: !!autoLockPreviousMilestones, milestones: milestones ?? [] }, actorId);
  successRes(res, result, "Learning plan saved");
});

// PUT /api/courses/:id/learning-plan/milestones  (upsert single milestone)
export const putMilestone = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const courseId = req.params.id;
  const milestoneId = typeof req.body?.milestoneId === "string" ? req.body.milestoneId.trim() : null;
  const entry = await upsertMilestone(courseId, milestoneId || null, req.body, actorId);
  successRes(res, entry, "Milestone saved");
});

// DELETE /api/courses/:id/learning-plan/milestones/:milestoneId
export const deleteMilestoneHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const courseId = req.params.id;
  const milestoneId = req.params.milestoneId;
  const result = await deleteMilestone(courseId, milestoneId, actorId);
  successRes(res, result, "Milestone deleted");
});

// POST /api/courses/:id/learning-plan/sync-to-batch/:batchId
export const postSyncToBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const courseId = req.params.id;
  const batchId = req.params.batchId;
  const result = await syncLearningPlanToBatch(courseId, batchId, actorId);
  successRes(res, result, "Learning plan synced to batch");
});

// ── Student milestone view ─────────────────────────────────────────────────

// GET /api/student/courses/:courseId/milestones?batchId=...
export const getStudentMilestones = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const courseId = req.params.courseId;
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId.trim() : "";
  if (!batchId) throw new AppError("batchId is required", 400);

  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) throw new AppError("Course not found in batch", 404);

  const status = await getStudentMilestoneStatus(studentId, batchMongoId, courseId, snap);
  successRes(res, status);
});

// ── Admin student milestone management ────────────────────────────────────

// GET /api/admin/batches/:batchId/students/:studentId/milestones
export const getAdminStudentMilestones = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { batchId, studentId } = req.params;
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId.trim() : "";
  const filter: Record<string, unknown> = { studentId, batchId };
  if (courseId) filter.courseId = courseId;
  const docs = await MilestoneProgressModel.find(filter).sort({ milestoneOrder: 1 }).lean().exec();
  successRes(res, docs);
});

// PATCH /api/admin/milestones/:milestoneId/unlock
export const patchAdminUnlock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const milestoneId = req.params.milestoneId;
  const { studentId, batchId, courseId, isScholarship } = req.body ?? {};
  if (!studentId || !batchId || !courseId) throw new AppError("studentId, batchId, courseId required", 400);
  await adminUnlockMilestone(studentId, batchId, courseId, milestoneId, adminId, !!isScholarship);
  successRes(res, { unlocked: true }, isScholarship ? "Scholarship granted" : "Milestone unlocked");
});

// PATCH /api/admin/milestones/:milestoneId/lock
export const patchAdminLock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const milestoneId = req.params.milestoneId;
  const { studentId, batchId, courseId } = req.body ?? {};
  if (!studentId || !batchId || !courseId) throw new AppError("studentId, batchId, courseId required", 400);
  await adminLockMilestone(studentId, batchId, courseId, milestoneId, adminId);
  successRes(res, { locked: true }, "Milestone locked");
});

// PATCH /api/admin/milestones/:milestoneId/reset
export const patchAdminReset = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const milestoneId = req.params.milestoneId;
  const { studentId, batchId, courseId } = req.body ?? {};
  if (!studentId || !batchId || !courseId) throw new AppError("studentId, batchId, courseId required", 400);
  await adminResetMilestone(studentId, batchId, courseId, milestoneId, adminId);
  successRes(res, { reset: true }, "Milestone reset");
});

// PATCH /api/admin/milestones/:milestoneId/extend-due
export const patchExtendDue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const milestoneId = req.params.milestoneId;
  const { studentId, batchId, courseId, extendDays } = req.body ?? {};
  if (!studentId || !batchId || !courseId || !extendDays) throw new AppError("studentId, batchId, courseId, extendDays required", 400);
  await extendPaymentDueDate(studentId, batchId, courseId, milestoneId, Number(extendDays), adminId);
  successRes(res, { extended: true }, "Payment due date extended");
});

// PATCH /api/admin/milestones/:milestoneId/skip
export const patchAdminSkip = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const milestoneId = req.params.milestoneId;
  const { studentId, batchId, courseId } = req.body ?? {};
  if (!studentId || !batchId || !courseId) throw new AppError("studentId, batchId, courseId required", 400);
  await adminSkipMilestone(studentId, batchId, courseId, milestoneId, adminId);
  successRes(res, { skipped: true }, "Milestone skipped — student promoted to next");
});

// ── Milestone License Key Generation ──────────────────────────────────────

// POST /api/admin/milestones/:milestoneId/generate-key
export const postGenerateMilestoneKey = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const milestoneId = req.params.milestoneId;
  const { courseId, batchId, count } = req.body ?? {};
  if (!courseId || !batchId) throw new AppError("courseId and batchId are required", 400);
  const data = await generateMilestoneLicenseKeys({
    courseId,
    batchId,
    milestoneId,
    createdBy: adminId,
    count: count ? Number(count) : 1,
  });
  successRes(res, data, `${data.keys.length} milestone license key(s) generated`, 201);
});

// ── Analytics ─────────────────────────────────────────────────────────────

// GET /api/analytics/learning-plans?courseId=...&batchId=...
export const getLearningPlanAnalyticsHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId.trim() : "";
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId.trim() : undefined;
  if (!courseId) throw new AppError("courseId is required", 400);
  const data = await getLearningPlanAnalytics(courseId, batchId);
  successRes(res, data);
});

// POST /api/admin/learning-plan/process-overdue  (internal/cron)
export const postProcessOverdue = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const flagged = await flagOverdueMilestones();
  successRes(res, { flagged }, `${flagged} milestones flagged as overdue`);
});
