/**
 * Batch Assignment Engine
 *
 * Centralized logic for student-to-batch assignment:
 * - Account creation: assign to specified batch or "Not Enrolled Students" batch
 * - First course enrollment: transfer to specified batch or "Global Online Batch"
 * - Validation, permission checks, and manual transfers by Admin/Super Admin
 *
 * Rules:
 * - Students get at most 2 opportunities to enter a Batch ID (signup + first enrollment)
 * - After that, only Admin/Super Admin can transfer students between batches
 * - Franchise Owners cannot transfer students
 */

import { BatchModel } from "../models/Batch.model.js";
import { UserModel } from "../models/User.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { BATCH_STATUS, ENROLLMENT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";
import { createAuditLog } from "./audit.service.js";
import { cacheDel, CACHE_KEYS } from "../utils/cache.js";

/** Find the single "Global Online Batch" */
export async function getGlobalOnlineBatch() {
  return BatchModel.findOne({ isGlobalOnlineBatch: true, status: BATCH_STATUS.ACTIVE }).lean().exec();
}

/** Find the single "Not Enrolled Students" batch */
export async function getNotEnrolledBatch() {
  return BatchModel.findOne({ isNotEnrolledBatch: true, status: BATCH_STATUS.ACTIVE }).lean().exec();
}

/** Validate a batch ID (human-readable format like BT-000001) and return the batch document */
export async function validateBatchId(batchId: string) {
  const trimmed = batchId.trim().toUpperCase();
  if (!trimmed) return null;
  const batch = await BatchModel.findOne({ batchId: trimmed, status: BATCH_STATUS.ACTIVE }).lean().exec();
  return batch;
}

/**
 * Assign a student to a batch during account creation.
 * - If batchId is provided and valid → assign to that batch
 * - If batchId is empty/invalid → assign to "Not Enrolled Students" batch
 */
export async function assignBatchOnSignup(
  studentId: string,
  batchId?: string
): Promise<{ assignedBatchId: string; batchName: string }> {
  let targetBatch: { _id: unknown; batchId?: string; name: string } | null = null;

  if (batchId?.trim()) {
    targetBatch = await validateBatchId(batchId) as { _id: unknown; batchId?: string; name: string } | null;
  }

  if (!targetBatch) {
    targetBatch = await getNotEnrolledBatch() as { _id: unknown; batchId?: string; name: string } | null;
  }

  if (!targetBatch) {
    // No "Not Enrolled Students" batch configured — skip batch assignment
    return { assignedBatchId: "", batchName: "" };
  }

  const batchMongoId = String(targetBatch._id);
  const humanBatchId = targetBatch.batchId ?? batchMongoId;

  // Update user's assigned batch
  await UserModel.updateOne(
    { _id: studentId },
    { $set: { assignedBatchId: humanBatchId, batchAssignmentCount: 1 } }
  ).exec();

  // Enroll student in the batch
  const existing = await EnrollmentModel.findOne({ studentId, batchId: batchMongoId }).exec();
  if (!existing) {
    await EnrollmentModel.create({
      studentId,
      batchId: batchMongoId,
      status: ENROLLMENT_STATUS.ACTIVE,
    }).catch((err) => {
      // Ignore duplicate key errors (race condition)
      if ((err as { code?: number })?.code !== 11000) throw err;
    });
  }

  return { assignedBatchId: humanBatchId, batchName: targetBatch.name };
}

/**
 * Handle batch assignment during first course enrollment (after payment verified).
 * - If student already has batchAssignmentCount >= 2, skip
 * - If batchId provided → transfer to that batch
 * - If batchId empty → transfer to Global Online Batch
 */
export async function assignBatchOnFirstEnrollment(
  studentId: string,
  batchId?: string
): Promise<{ transferred: boolean; newBatchId: string; newBatchName: string }> {
  const user = await UserModel.findById(studentId).select("batchAssignmentCount assignedBatchId").lean().exec();
  if (!user) throw new AppError("Student not found", 404);

  const count = (user as { batchAssignmentCount?: number }).batchAssignmentCount ?? 0;
  if (count >= 2) {
    // Student has already used both opportunities
    return { transferred: false, newBatchId: "", newBatchName: "" };
  }

  let targetBatch: { _id: unknown; batchId?: string; name: string } | null = null;

  if (batchId?.trim()) {
    targetBatch = await validateBatchId(batchId) as { _id: unknown; batchId?: string; name: string } | null;
  }

  if (!targetBatch) {
    targetBatch = await getGlobalOnlineBatch() as { _id: unknown; batchId?: string; name: string } | null;
  }

  if (!targetBatch) {
    // No Global Online Batch configured — skip
    await UserModel.updateOne({ _id: studentId }, { $set: { batchAssignmentCount: 2 } }).exec();
    return { transferred: false, newBatchId: "", newBatchName: "" };
  }

  const newBatchMongoId = String(targetBatch._id);
  const newHumanBatchId = targetBatch.batchId ?? newBatchMongoId;

  // Remove from current "Not Enrolled Students" batch if applicable
  const notEnrolledBatch = await getNotEnrolledBatch();
  if (notEnrolledBatch) {
    const notEnrolledMongoId = String(notEnrolledBatch._id);
    await EnrollmentModel.deleteOne({ studentId, batchId: notEnrolledMongoId }).exec();
  }

  // Enroll in new batch
  const existing = await EnrollmentModel.findOne({ studentId, batchId: newBatchMongoId }).exec();
  if (!existing) {
    await EnrollmentModel.create({
      studentId,
      batchId: newBatchMongoId,
      status: ENROLLMENT_STATUS.ACTIVE,
    }).catch((err) => {
      if ((err as { code?: number })?.code !== 11000) throw err;
    });
  }

  // Update user record
  await UserModel.updateOne(
    { _id: studentId },
    { $set: { assignedBatchId: newHumanBatchId, batchAssignmentCount: 2 } }
  ).exec();

  await cacheDel(CACHE_KEYS.studentCourses(studentId));

  return { transferred: true, newBatchId: newHumanBatchId, newBatchName: targetBatch.name };
}

/**
 * Manual transfer by Admin/Super Admin.
 * Removes student from current batch, adds to new batch.
 */
export async function transferStudentBatch(
  studentId: string,
  newBatchId: string,
  performedBy: string
): Promise<{ success: boolean; fromBatch: string; toBatch: string }> {
  const newBatch = await validateBatchId(newBatchId);
  if (!newBatch) throw new AppError("Target batch not found or not active", 404);

  const student = await UserModel.findById(studentId).select("assignedBatchId username").lean().exec();
  if (!student) throw new AppError("Student not found", 404);

  const currentBatchId = (student as { assignedBatchId?: string }).assignedBatchId ?? "";
  const newBatchMongoId = String(newBatch._id);
  const newHumanBatchId = (newBatch as { batchId?: string }).batchId ?? newBatchMongoId;

  // Remove from current batch enrollment
  if (currentBatchId) {
    const currentBatch = await BatchModel.findOne({ batchId: currentBatchId }).lean().exec();
    if (currentBatch) {
      await EnrollmentModel.deleteOne({ studentId, batchId: String(currentBatch._id) }).exec();
    }
  }

  // Enroll in new batch
  const existing = await EnrollmentModel.findOne({ studentId, batchId: newBatchMongoId }).exec();
  if (!existing) {
    await EnrollmentModel.create({
      studentId,
      batchId: newBatchMongoId,
      status: ENROLLMENT_STATUS.ACTIVE,
    }).catch((err) => {
      if ((err as { code?: number })?.code !== 11000) throw err;
    });
  }

  // Update user record
  await UserModel.updateOne(
    { _id: studentId },
    { $set: { assignedBatchId: newHumanBatchId } }
  ).exec();

  await cacheDel(CACHE_KEYS.studentCourses(studentId));
  await createAuditLog("BATCH_TRANSFER", performedBy, "User", studentId, {
    from: currentBatchId,
    to: newHumanBatchId,
  });

  return { success: true, fromBatch: currentBatchId, toBatch: newHumanBatchId };
}

/**
 * Mark/unmark a batch as the Global Online Batch (Super Admin only).
 * Ensures only one batch has this flag at a time.
 */
export async function setGlobalOnlineBatch(batchMongoId: string): Promise<void> {
  // Clear flag from any existing batch
  await BatchModel.updateMany({ isGlobalOnlineBatch: true }, { $set: { isGlobalOnlineBatch: false } }).exec();
  // Set flag on the specified batch
  await BatchModel.updateOne({ _id: batchMongoId }, { $set: { isGlobalOnlineBatch: true } }).exec();
}

/**
 * Mark/unmark a batch as the "Not Enrolled Students" batch (Super Admin only).
 * Ensures only one batch has this flag at a time.
 */
export async function setNotEnrolledBatch(batchMongoId: string): Promise<void> {
  // Clear flag from any existing batch
  await BatchModel.updateMany({ isNotEnrolledBatch: true }, { $set: { isNotEnrolledBatch: false } }).exec();
  // Set flag on the specified batch
  await BatchModel.updateOne({ _id: batchMongoId }, { $set: { isNotEnrolledBatch: true } }).exec();
}
