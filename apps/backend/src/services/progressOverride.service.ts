
import { ChapterProgressModel } from "../models/ModuleProgress.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

export interface OverrideProgressInput {
  studentId: string;
  batchId: string;
  courseId?: string;
  chapterOrder: number;
  reason: string;
  performedBy: string;
}

export async function overrideProgress(input: OverrideProgressInput) {
  if (!input.reason?.trim()) throw new AppError("reason is required for override", 400);

  const batch = await findBatchByParam(input.batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  // Support both single-course (courseSnapshot) and multi-course (courseSnapshots) batches
  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  let chapters: unknown[] = [];

  if (input.courseId && snapshots.length > 0) {
    // Find the specific course snapshot
    const snap = snapshots.find((s) => String((s as { courseId?: string }).courseId ?? "") === input.courseId);
    if (snap) {
      chapters = (snap as { modules?: unknown[] }).modules ?? [];
    }
  }

  // Fallback to legacy single-course snapshot
  if (chapters.length === 0) {
    chapters = (batch as { courseSnapshot?: { modules?: unknown[] } }).courseSnapshot?.modules ?? [];
  }

  // If still no chapters found (batch with snapshots but no courseId provided), use first snapshot
  if (chapters.length === 0 && snapshots.length > 0) {
    chapters = (snapshots[0] as { modules?: unknown[] }).modules ?? [];
  }

  if (input.chapterOrder < 0 || input.chapterOrder >= chapters.length) {
    throw new AppError("Chapter not found in batch", 404);
  }

  const enrollment = await EnrollmentModel.findOne({
    studentId: input.studentId,
    batchId: batchMongoId,
  }).exec();
  if (!enrollment) throw new AppError("Student is not enrolled in this batch", 404);

  await ChapterProgressModel.findOneAndUpdate(
    { studentId: input.studentId, batchId: batchMongoId, moduleOrder: input.chapterOrder },
    {
      $set: {
        studentId: input.studentId,
        batchId: batchMongoId,
        moduleOrder: input.chapterOrder,
        completedAt: new Date(),
        completedBy: input.performedBy,
        isManualOverride: true,
        reason: input.reason.trim(),
      },
    },
    { upsert: true }
  ).exec();

  const targetId = `${input.studentId}:${input.batchId}:${input.chapterOrder}`;
  await createAuditLog("PROGRESS_OVERRIDE", input.performedBy, "ChapterProgress", targetId, {
    reason: input.reason.trim(),
    studentId: input.studentId,
    batchId: input.batchId,
    chapterOrder: input.chapterOrder,
  });

  return {
    studentId: input.studentId,
    batchId: input.batchId,
    chapterOrder: input.chapterOrder,
    moduleOrder: input.chapterOrder,
    completedAt: new Date(),
    isManualOverride: true,
    reason: input.reason.trim(),
  };
}
