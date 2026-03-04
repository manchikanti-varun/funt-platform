
import { ModuleProgressModel } from "../models/ModuleProgress.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { findBatchByParam } from "./batch.service.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

export interface OverrideProgressInput {
  studentId: string;
  batchId: string;
  moduleOrder: number;
  reason: string;
  performedBy: string;
}

export async function overrideProgress(input: OverrideProgressInput) {
  if (!input.reason?.trim()) throw new AppError("reason is required for override", 400);

  const batch = await findBatchByParam(input.batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const modules = batch.courseSnapshot?.modules ?? [];
  if (input.moduleOrder < 0 || input.moduleOrder >= modules.length) {
    throw new AppError("Module not found in batch", 404);
  }

  const enrollment = await EnrollmentModel.findOne({
    studentId: input.studentId,
    batchId: batchMongoId,
  }).exec();
  if (!enrollment) throw new AppError("Student is not enrolled in this batch", 404);

  await ModuleProgressModel.findOneAndUpdate(
    { studentId: input.studentId, batchId: batchMongoId, moduleOrder: input.moduleOrder },
    {
      $set: {
        studentId: input.studentId,
        batchId: batchMongoId,
        moduleOrder: input.moduleOrder,
        completedAt: new Date(),
        completedBy: input.performedBy,
        isManualOverride: true,
        reason: input.reason.trim(),
      },
    },
    { upsert: true }
  ).exec();

  const targetId = `${input.studentId}:${input.batchId}:${input.moduleOrder}`;
  await createAuditLog("PROGRESS_OVERRIDE", input.performedBy, "ModuleProgress", targetId, {
    reason: input.reason.trim(),
    studentId: input.studentId,
    batchId: input.batchId,
    moduleOrder: input.moduleOrder,
  });

  return {
    studentId: input.studentId,
    batchId: input.batchId,
    moduleOrder: input.moduleOrder,
    completedAt: new Date(),
    isManualOverride: true,
    reason: input.reason.trim(),
  };
}
