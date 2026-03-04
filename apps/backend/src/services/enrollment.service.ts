
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { UserModel } from "../models/User.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { ENROLLMENT_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

export interface CreateEnrollmentInput {
  studentId: string;
  batchId: string;
  createdBy: string;
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

async function resolveStudentId(studentIdOrFuntId: string): Promise<string> {
  if (!studentIdOrFuntId?.trim()) throw new AppError("studentId or funtId is required", 400);
  const v = studentIdOrFuntId.trim();
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v).exec();
    if (!user) throw new AppError("Student not found", 404);
    return String(user._id);
  }
  const user = await UserModel.findOne({ funtId: v }).exec();
  if (!user) throw new AppError("Student not found (invalid FUNT ID or user ID)", 404);
  return String(user._id);
}

export async function createEnrollment(input: CreateEnrollmentInput) {
  if (!input.studentId) throw new AppError("studentId or funtId is required", 400);
  if (!input.batchId) throw new AppError("batchId is required", 400);

  const studentId = await resolveStudentId(input.studentId);
  if (!OBJECT_ID_REGEX.test(studentId)) throw new AppError("Invalid student reference", 400);

  const [student, batch] = await Promise.all([
    UserModel.findById(studentId).exec(),
    findBatchByParam(input.batchId),
  ]);
  if (!student) throw new AppError("Student not found", 404);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const existing = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
  }).exec();
  if (existing) throw new AppError("Student is already enrolled in this batch", 400);

  const doc = await EnrollmentModel.create({
    studentId,
    batchId: batchMongoId,
    status: ENROLLMENT_STATUS.ACTIVE,
  });

  await createAuditLog("ENROLLMENT_CREATED", input.createdBy, "Enrollment", String(doc._id));
  return {
    id: String(doc._id),
    studentId: doc.studentId,
    batchId: doc.batchId,
    status: doc.status,
    enrolledAt: doc.enrolledAt,
  };
}

export async function getMyEnrollments(studentId: string) {
  const enrollments = await EnrollmentModel.find({ studentId })
    .sort({ enrolledAt: -1 })
    .lean()
    .exec();
  const batchIds = enrollments.map((e) => e.batchId);
  const batches = await BatchModel.find({ _id: { $in: batchIds } }).lean().exec();
  const batchMap = new Map(batches.map((b) => [String(b._id), b]));

  return enrollments
    .filter((e) => e.status === ENROLLMENT_STATUS.ACTIVE || e.status === ENROLLMENT_STATUS.COMPLETED)
    .map((e) => {
      const batch = batchMap.get(e.batchId);
      const snapshots = batch ? getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]) : [];
      const firstSnap = snapshots[0] as { courseId?: string } | undefined;
      const courseId = firstSnap?.courseId ?? (batch ? String(batch._id) : e.batchId);
      return {
        id: String(e._id),
        studentId: e.studentId,
        batchId: e.batchId,
        courseId,
        status: e.status,
        enrolledAt: e.enrolledAt,
        batch: batch
          ? {
              id: String(batch._id),
              batchId: (batch as { batchId?: string }).batchId,
              name: batch.name,
              courseSnapshots: snapshots,
              courseSnapshot: firstSnap ?? null,
              trainerId: batch.trainerId,
              startDate: batch.startDate,
              endDate: batch.endDate,
              zoomLink: batch.zoomLink,
              status: batch.status,
            }
          : null,
      };
    });
}

export async function requireActiveEnrollment(studentId: string, batchId: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);
  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
  }).exec();
  if (!enrollment) throw new AppError("Not enrolled in this batch", 403);
  if (enrollment.status !== ENROLLMENT_STATUS.ACTIVE) {
    throw new AppError("Enrollment is not active", 403);
  }
  return enrollment;
}

export interface BulkEnrollmentResult {
  enrolled: number;
  skipped: number;
  notFound: string[];
  errors: Array<{ identifier: string; message: string }>;
}

export async function bulkEnroll(
  batchId: string,
  studentFuntIdsOrIds: string[],
  createdBy: string
): Promise<BulkEnrollmentResult> {
  if (!batchId?.trim()) throw new AppError("batchId is required", 400);
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const result: BulkEnrollmentResult = { enrolled: 0, skipped: 0, notFound: [], errors: [] };
  const seen = new Set<string>();
  const toCreate: string[] = [];

  for (const raw of studentFuntIdsOrIds) {
    const v = (raw && String(raw).trim()) || "";
    if (!v || seen.has(v)) continue;
    seen.add(v);

    try {
      const studentId = await resolveStudentId(v);
      const existing = await EnrollmentModel.findOne({ studentId, batchId: batchMongoId }).exec();
      if (existing) {
        result.skipped += 1;
        continue;
      }
      toCreate.push(studentId);
    } catch {
      result.notFound.push(v);
    }
  }

  for (const studentId of toCreate) {
    try {
      await EnrollmentModel.create({
        studentId,
        batchId: batchMongoId,
        status: ENROLLMENT_STATUS.ACTIVE,
      });
      await createAuditLog("ENROLLMENT_CREATED", createdBy, "Enrollment", batchMongoId);
      result.enrolled += 1;
    } catch (err) {
      result.errors.push({
        identifier: studentId,
        message: err instanceof Error ? err.message : "Failed to enroll",
      });
    }
  }

  return result;
}

export async function listEnrollmentsByBatch(batchId: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) return [];
  const batchMongoId = String((batch as { _id: unknown })._id);
  const humanBatchId = (batch as { batchId?: string }).batchId;

  
  const matchValues: unknown[] = [batchMongoId, batchId.trim()];
  if (humanBatchId && humanBatchId !== batchMongoId) matchValues.push(humanBatchId);
  if (OBJECT_ID_REGEX.test(batchMongoId)) {
    try {
      const mongoose = await import("mongoose");
      matchValues.push(new mongoose.default.Types.ObjectId(batchMongoId));
    } catch {
      
    }
  }

  
  const cursor = EnrollmentModel.collection.find({
    batchId: { $in: matchValues },
  } as Record<string, unknown>);
  const rawEnrollments = await cursor.sort({ enrolledAt: -1 }).toArray();
  if (rawEnrollments.length === 0) return [];

  const enrollments = rawEnrollments.map((e) => ({
    studentId: String(e.studentId),
    batchId: String(e.batchId),
    enrolledAt: e.enrolledAt instanceof Date ? e.enrolledAt : new Date(e.enrolledAt as string | number),
  }));
  const userIds = [...new Set(enrollments.map((e) => e.studentId))];
  const users = await UserModel.find({ _id: { $in: userIds } }).select("_id funtId name").lean().exec();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  return enrollments.map((e) => {
    const u = userMap.get(e.studentId);
    return {
      studentId: e.studentId,
      funtId: (u as { funtId?: string } | undefined)?.funtId ?? "",
      name: (u as { name?: string } | undefined)?.name ?? "",
      enrolledAt: e.enrolledAt,
    };
  });
}

/** Remove a student from a batch (delete enrollment). */
export async function removeEnrollment(batchId: string, studentId: string, performedBy: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);
  const doc = await EnrollmentModel.findOne({ batchId: batchMongoId, studentId }).exec();
  if (!doc) throw new AppError("Enrollment not found", 404);
  await EnrollmentModel.deleteOne({ _id: doc._id }).exec();
  await createAuditLog("ENROLLMENT_REMOVED", performedBy, "Enrollment", String(doc._id));
  return { removed: true };
}
