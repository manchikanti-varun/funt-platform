
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { UserModel } from "../models/User.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { ENROLLMENT_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import {
  clearBatchEnrollmentExclusion,
  recordBatchEnrollmentExclusion,
  shouldSkipEnrollmentInvoice,
} from "./demoEnrollment.service.js";
import { issueInvoiceForEnrollment } from "./invoice.service.js";
import { AppError } from "../utils/AppError.js";
import { cacheDel, CACHE_KEYS } from "../utils/cache.js";
import {
  isLearningPlanActive,
  getMilestonesFromSnapshot,
  initializeMilestoneProgress,
} from "./learningPlan.service.js";

export interface CreateEnrollmentInput {
  studentId: string;
  batchId: string;
  courseId?: string;
  createdBy: string;
  /** Skip auto-invoice (e.g. when payment flow will issue its own). */
  skipAutoInvoice?: boolean;
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

async function resolveStudentId(studentIdOrUsername: string): Promise<string> {
  if (!studentIdOrUsername?.trim()) throw new AppError("studentId or username is required", 400);
  const v = studentIdOrUsername.trim();
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v).exec();
    if (!user) throw new AppError("Student not found", 404);
    return String(user._id);
  }
  const user = await UserModel.findOne({ username: v.toLowerCase() }).exec();
  if (!user) throw new AppError("Student not found (invalid username or user ID)", 404);
  return String(user._id);
}

export async function createEnrollment(input: CreateEnrollmentInput) {
  if (!input.studentId) throw new AppError("studentId or username is required", 400);
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

  let doc;
  try {
    doc = await EnrollmentModel.create({
      studentId,
      batchId: batchMongoId,
      status: ENROLLMENT_STATUS.ACTIVE,
    });
  } catch (err) {
    // Handle race condition: concurrent requests may both pass the findOne check above
    if ((err as { code?: number })?.code === 11000) {
      throw new AppError("Student is already enrolled in this batch", 400);
    }
    throw err;
  }

  await clearBatchEnrollmentExclusion(studentId, batchMongoId);
  await createAuditLog("ENROLLMENT_CREATED", input.createdBy, "Enrollment", String(doc._id));

  // Invalidate the student's cached course list so they see the new enrollment immediately
  await cacheDel(CACHE_KEYS.studentCourses(studentId));

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const courseId =
    String(input.courseId ?? "").trim() ||
    String((snapshots[0] as { courseId?: string } | undefined)?.courseId ?? "").trim() ||
    undefined;

  // ── Learning Plan: initialize milestone progress for each course in snapshot ──
  for (const snap of snapshots) {
    const snapCourseId = String((snap as { courseId?: string }).courseId ?? "").trim();
    if (!snapCourseId) continue;
    if (isLearningPlanActive(snap)) {
      const milestones = getMilestonesFromSnapshot(snap);
      try {
        await initializeMilestoneProgress(
          studentId,
          batchMongoId,
          snapCourseId,
          milestones,
          doc.enrolledAt ?? new Date()
        );
      } catch (lpErr) {
        // Critical: LP initialization failed — enrollment succeeds but student will have broken milestone state.
        // Log for admin visibility and flag the enrollment for retry.
        console.error(
          `[LP_INIT_FAILED] studentId=${studentId} batchId=${batchMongoId} courseId=${snapCourseId}`,
          lpErr instanceof Error ? lpErr.message : lpErr
        );
        // Mark enrollment so a background check can retry initialization
        await EnrollmentModel.updateOne(
          { studentId, batchId: batchMongoId },
          { $set: { learningPlanActive: true, _milestoneInitPending: true } }
        ).exec().catch(() => {});
      }
    }
  }

  if (!input.skipAutoInvoice && !(await shouldSkipEnrollmentInvoice(batchMongoId, courseId))) {
    await issueInvoiceForEnrollment({
      enrollmentId: String(doc._id),
      studentId: doc.studentId,
      batchId: doc.batchId,
      courseId,
      createdBy: input.createdBy,
    });
  }

  return {
    id: String(doc._id),
    studentId: doc.studentId,
    batchId: doc.batchId,
    status: doc.status,
    enrolledAt: doc.enrolledAt,
  };
}

export async function getMyEnrollments(studentId: string, page = 1, limit = 50) {
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
  const effectiveLimit = Math.min(100, Math.max(1, limit));

  const [enrollments, _total] = await Promise.all([
    EnrollmentModel.find({ studentId })
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(effectiveLimit)
      .lean()
      .exec(),
    EnrollmentModel.countDocuments({ studentId }).exec(),
  ]);
  const batchIds = enrollments.map((e) => e.batchId);
  const batches = await BatchModel.find({ _id: { $in: batchIds } }).lean().exec();
  const batchMap = new Map(batches.map((b) => [String(b._id), b]));

  const items = enrollments
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
        accessBlocked: !!(e as { accessBlocked?: boolean }).accessBlocked,
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
  return items;
}

export async function setEnrollmentAccessBlocked(enrollmentId: string, blocked: boolean) {
  const doc = await EnrollmentModel.findByIdAndUpdate(
    enrollmentId,
    { $set: { accessBlocked: blocked } },
    { new: true }
  ).exec();
  if (!doc) throw new AppError("Enrollment not found", 404);
  return doc;
}

export async function setEnrollmentCourseAccessBlocked(
  enrollmentId: string,
  courseId: string,
  blocked: boolean
) {
  const enrollment = await EnrollmentModel.findById(enrollmentId).exec();
  if (!enrollment) throw new AppError("Enrollment not found", 404);
  const cId = String(courseId ?? "").trim();
  if (!cId) throw new AppError("courseId is required", 400);

  const batch = await BatchModel.findById(enrollment.batchId).lean().exec();
  if (!batch) throw new AppError("Batch not found for enrollment", 404);
  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const inBatch = snapshots.some((s) => String((s as { courseId?: string }).courseId ?? "").trim() === cId);
  if (!inBatch) throw new AppError("courseId is not part of this batch", 400);

  const mapRaw = (enrollment as { courseAccessBlocked?: Map<string, boolean> | Record<string, boolean> })
    .courseAccessBlocked;
  const next = new Map<string, boolean>(
    mapRaw instanceof Map ? Array.from(mapRaw.entries()) : Object.entries(mapRaw ?? {})
  );
  if (blocked) next.set(cId, true);
  else next.delete(cId);
  (enrollment as { courseAccessBlocked: Map<string, boolean> }).courseAccessBlocked = next;
  enrollment.markModified("courseAccessBlocked");
  await enrollment.save();
  return enrollment;
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
  if ((enrollment as { accessBlocked?: boolean }).accessBlocked) {
    throw new AppError("Access to this course has been disabled", 403);
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
  studentUsernamesOrIds: string[],
  createdBy: string
): Promise<BulkEnrollmentResult> {
  if (!batchId?.trim()) throw new AppError("batchId is required", 400);
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const result: BulkEnrollmentResult = { enrolled: 0, skipped: 0, notFound: [], errors: [] };
  const seen = new Set<string>();
  const toCreate: string[] = [];

  // ── Batch-resolve all usernames/IDs in 1–2 queries instead of N ──
  const uniqueInputs: string[] = [];
  for (const raw of studentUsernamesOrIds) {
    const v = (raw && String(raw).trim()) || "";
    if (!v || seen.has(v)) continue;
    seen.add(v);
    uniqueInputs.push(v);
  }

  // Separate ObjectIds from usernames for batch lookup
  const possibleIds = uniqueInputs.filter((v) => OBJECT_ID_REGEX.test(v));
  const possibleUsernames = uniqueInputs.filter((v) => !OBJECT_ID_REGEX.test(v)).map((u) => u.toLowerCase());

  const [usersByIds, usersByUsernames] = await Promise.all([
    possibleIds.length > 0
      ? UserModel.find({ _id: { $in: possibleIds } }).select("_id").lean().exec()
      : [],
    possibleUsernames.length > 0
      ? UserModel.find({ username: { $in: possibleUsernames } }).select("_id username").lean().exec()
      : [],
  ]);

  // Build a map: input → resolved userId
  const resolvedMap = new Map<string, string>();
  for (const u of usersByIds) resolvedMap.set(String(u._id), String(u._id));
  for (const u of usersByUsernames) {
    const username = (u as { username?: string }).username?.toLowerCase() ?? "";
    resolvedMap.set(username, String(u._id));
  }

  // Identify found vs not-found
  const resolvedStudentIds: string[] = [];
  for (const v of uniqueInputs) {
    const key = OBJECT_ID_REGEX.test(v) ? v : v.toLowerCase();
    const resolved = resolvedMap.get(key);
    if (resolved) {
      resolvedStudentIds.push(resolved);
    } else {
      result.notFound.push(v);
    }
  }

  // Batch-check existing enrollments in one query
  const existingEnrollments = await EnrollmentModel.find({
    studentId: { $in: resolvedStudentIds },
    batchId: batchMongoId,
  }).select("studentId").lean().exec();
  const alreadyEnrolledSet = new Set(existingEnrollments.map((e) => String(e.studentId)));

  for (const studentId of resolvedStudentIds) {
    if (alreadyEnrolledSet.has(studentId)) {
      result.skipped += 1;
    } else {
      toCreate.push(studentId);
    }
  }

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const defaultCourseId = String((snapshots[0] as { courseId?: string } | undefined)?.courseId ?? "").trim() || undefined;

  for (const studentId of toCreate) {
    try {
      const doc = await EnrollmentModel.create({
        studentId,
        batchId: batchMongoId,
        status: ENROLLMENT_STATUS.ACTIVE,
      });
      // Fire secondary operations in parallel — they're non-critical for enrollment success
      await Promise.allSettled([
        clearBatchEnrollmentExclusion(studentId, batchMongoId),
        createAuditLog("ENROLLMENT_CREATED", createdBy, "Enrollment", batchMongoId),
        cacheDel(CACHE_KEYS.studentCourses(studentId)),
        shouldSkipEnrollmentInvoice(batchMongoId, defaultCourseId).then((skip) => {
          if (!skip) {
            return issueInvoiceForEnrollment({
              enrollmentId: String(doc._id),
              studentId,
              batchId: batchMongoId,
              courseId: defaultCourseId,
              createdBy,
            });
          }
        }),
      ]);
      result.enrolled += 1;
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        result.skipped += 1;
      } else {
        result.errors.push({
          identifier: studentId,
          message: err instanceof Error ? err.message : "Failed to enroll",
        });
      }
    }
  }

  return result;
}

export async function listEnrollmentsByBatch(batchId: string, page = 1, limit = 100) {
  const batch = await findBatchByParam(batchId);
  if (!batch) return { rows: [], total: 0, page: 1, limit };
  const batchMongoId = String((batch as { _id: unknown })._id);
  const humanBatchId = (batch as { batchId?: string }).batchId;

  const effectiveLimit = Math.min(500, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * effectiveLimit;

  const matchValues: unknown[] = [batchMongoId, batchId.trim()];
  if (humanBatchId && humanBatchId !== batchMongoId) matchValues.push(humanBatchId);
  if (OBJECT_ID_REGEX.test(batchMongoId)) {
    try {
      const mongoose = await import("mongoose");
      matchValues.push(new mongoose.default.Types.ObjectId(batchMongoId));
    } catch {
      
    }
  }

  const filter = { batchId: { $in: matchValues } } as Record<string, unknown>;
  const total = await EnrollmentModel.collection.countDocuments(filter);

  const cursor = EnrollmentModel.collection.find(filter);
  const rawEnrollments = await cursor.sort({ enrolledAt: -1 }).skip(skip).limit(effectiveLimit).toArray();
  if (rawEnrollments.length === 0) return { rows: [], total, page, limit: effectiveLimit };

  const enrollments = rawEnrollments.map((e) => ({
    enrollmentId: String((e as { _id: unknown })._id),
    studentId: String(e.studentId),
    batchId: String(e.batchId),
    enrolledAt: e.enrolledAt instanceof Date ? e.enrolledAt : new Date(e.enrolledAt as string | number),
    accessBlocked: !!(e as { accessBlocked?: boolean }).accessBlocked,
    courseAccessBlocked: Object.fromEntries(
      ((e as { courseAccessBlocked?: Map<string, boolean> | Record<string, boolean> }).courseAccessBlocked instanceof Map
        ? (e as { courseAccessBlocked?: Map<string, boolean> }).courseAccessBlocked!.entries()
        : Object.entries(
            (e as { courseAccessBlocked?: Record<string, boolean> }).courseAccessBlocked ?? {}
          )) as Iterable<[string, boolean]>
    ),
  }));
  const userIds = [...new Set(enrollments.map((e) => e.studentId))];
  const users = await UserModel.find({ _id: { $in: userIds } }).select("_id username name").lean().exec();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const rows = enrollments.map((e) => {
    const u = userMap.get(e.studentId);
    return {
      enrollmentId: e.enrollmentId,
      studentId: e.studentId,
      username: (u as { username?: string } | undefined)?.username ?? "",
      name: (u as { name?: string } | undefined)?.name ?? "",
      enrolledAt: e.enrolledAt,
      accessBlocked: e.accessBlocked,
      courseAccessBlocked: e.courseAccessBlocked,
    };
  });
  return { rows, total, page, limit: effectiveLimit };
}

/** Remove a student from a batch (delete enrollment). */
export async function removeEnrollment(batchId: string, studentId: string, performedBy: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);
  const doc = await EnrollmentModel.findOne({ batchId: batchMongoId, studentId }).exec();
  if (!doc) throw new AppError("Enrollment not found", 404);
  await EnrollmentModel.deleteOne({ _id: doc._id }).exec();
  await recordBatchEnrollmentExclusion(studentId, batchMongoId, performedBy);
  await createAuditLog("ENROLLMENT_REMOVED", performedBy, "Enrollment", String(doc._id));
  // Invalidate student's cached course list
  await cacheDel(CACHE_KEYS.studentCourses(studentId));
  return { removed: true };
}

export type BulkRemovalResult = {
  removed: number;
  skipped: number;
  notFound: string[];
};

/** Bulk remove students from a batch by username or user id. */
export async function bulkRemoveEnrollment(
  batchId: string,
  studentUsernamesOrIds: string[],
  performedBy: string
): Promise<BulkRemovalResult> {
  if (!batchId?.trim()) throw new AppError("batchId is required", 400);
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const result: BulkRemovalResult = { removed: 0, skipped: 0, notFound: [] };
  const seen = new Set<string>();

  // ── Batch-resolve all usernames/IDs in 1–2 queries instead of N ──
  const uniqueInputs: string[] = [];
  for (const raw of studentUsernamesOrIds) {
    const v = (raw && String(raw).trim()) || "";
    if (!v || seen.has(v)) continue;
    seen.add(v);
    uniqueInputs.push(v);
  }

  const possibleIds = uniqueInputs.filter((v) => OBJECT_ID_REGEX.test(v));
  const possibleUsernames = uniqueInputs.filter((v) => !OBJECT_ID_REGEX.test(v)).map((u) => u.toLowerCase());

  const [usersByIds, usersByUsernames] = await Promise.all([
    possibleIds.length > 0
      ? UserModel.find({ _id: { $in: possibleIds } }).select("_id").lean().exec()
      : [],
    possibleUsernames.length > 0
      ? UserModel.find({ username: { $in: possibleUsernames } }).select("_id username").lean().exec()
      : [],
  ]);

  const resolvedMap = new Map<string, string>();
  for (const u of usersByIds) resolvedMap.set(String(u._id), String(u._id));
  for (const u of usersByUsernames) {
    const username = (u as { username?: string }).username?.toLowerCase() ?? "";
    resolvedMap.set(username, String(u._id));
  }

  const resolvedStudentIds: string[] = [];
  for (const v of uniqueInputs) {
    const key = OBJECT_ID_REGEX.test(v) ? v : v.toLowerCase();
    const resolved = resolvedMap.get(key);
    if (resolved) {
      resolvedStudentIds.push(resolved);
    } else {
      result.notFound.push(v);
    }
  }

  // Batch-find enrollments to remove
  const enrollments = await EnrollmentModel.find({
    studentId: { $in: resolvedStudentIds },
    batchId: batchMongoId,
  }).select("_id studentId").lean().exec();
  const enrolledStudentIds = new Set(enrollments.map((e) => String(e.studentId)));
  const enrollmentIdsByStudent = new Map(
    enrollments.map((e) => [String(e.studentId), String(e._id)])
  );

  // Identify which students are not enrolled (skip them)
  for (const studentId of resolvedStudentIds) {
    if (!enrolledStudentIds.has(studentId)) {
      result.skipped += 1;
    }
  }

  // Batch-delete all found enrollments
  const idsToDelete = enrollments.map((e) => e._id);
  if (idsToDelete.length > 0) {
    await EnrollmentModel.deleteMany({ _id: { $in: idsToDelete } }).exec();
  }

  // Fire secondary operations in parallel for all removed students
  const removedStudentIds = [...enrolledStudentIds];
  await Promise.allSettled(
    removedStudentIds.flatMap((studentId) => [
      recordBatchEnrollmentExclusion(studentId, batchMongoId, performedBy),
      createAuditLog("ENROLLMENT_REMOVED", performedBy, "Enrollment", enrollmentIdsByStudent.get(studentId) ?? ""),
      cacheDel(CACHE_KEYS.studentCourses(studentId)),
    ])
  );

  result.removed = removedStudentIds.length;
  return result;
}
