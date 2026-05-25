import { BatchModel } from "../models/Batch.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { UserModel } from "../models/User.model.js";
import { BATCH_STATUS, ENROLLMENT_STATUS, ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";

function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

type BatchSnapshotSource = {
  courseSnapshots?: unknown[] | null;
  courseSnapshot?: unknown;
};

function getSnapshotsFromBatch(batch: BatchSnapshotSource): unknown[] {
  const snapshots = batch.courseSnapshots;
  if (Array.isArray(snapshots) && snapshots.length > 0) return snapshots;
  const single = batch.courseSnapshot;
  if (single) return [single];
  return [];
}

/** True when the batch includes at least one demo course snapshot. */
export function batchHasDemoCourses(batch: BatchSnapshotSource): boolean {
  return getSnapshotsFromBatch(batch).some((s) => !!(s as { isDemo?: boolean }).isDemo);
}

function snapshotForCourse(batch: BatchSnapshotSource, courseId?: string) {
  const snapshots = getSnapshotsFromBatch(batch);
  const cid = String(courseId ?? "").trim();
  if (cid) {
    return snapshots.find((s) => String((s as { courseId?: string }).courseId ?? "").trim() === cid);
  }
  return snapshots[0];
}

/** Do not issue invoices for demo courses (fee is always ₹0). */
export async function shouldSkipEnrollmentInvoice(batchMongoId: string, courseId?: string): Promise<boolean> {
  const batch = await BatchModel.findById(batchMongoId).lean().exec();
  if (!batch) return false;
  const snap = snapshotForCourse(batch, courseId);
  if (!snap) return batchHasDemoCourses(batch);
  return !!(snap as { isDemo?: boolean }).isDemo;
}

/** Active batches that contain a demo course — students are auto-enrolled when added to the batch. */
export async function listBatchesWithDemoCourses() {
  return BatchModel.find({
    status: BATCH_STATUS.ACTIVE,
    $or: [{ "courseSnapshots.isDemo": true }, { "courseSnapshot.isDemo": true }],
  })
    .lean()
    .exec();
}

/** Idempotent: enroll one student in every active batch that has demo courses (no invoice). */
export async function ensureDemoEnrollmentsForStudent(studentId: string): Promise<number> {
  const sid = String(studentId ?? "").trim();
  if (!sid) return 0;
  const batches = await listBatchesWithDemoCourses();
  let created = 0;
  for (const batch of batches) {
    const batchMongoId = String(batch._id);
    const existing = await EnrollmentModel.findOne({ studentId: sid, batchId: batchMongoId }).exec();
    if (existing) continue;
    try {
      await EnrollmentModel.create({
        studentId: sid,
        batchId: batchMongoId,
        status: ENROLLMENT_STATUS.ACTIVE,
      });
      created += 1;
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
  return created;
}

/** Enroll all active students in a batch that has demo courses (e.g. demo course added to batch). */
export async function syncAllStudentsToDemoBatch(
  batchMongoId: string,
  performedBy: string
): Promise<{ enrolled: number; skipped: number }> {
  const batch = await BatchModel.findById(batchMongoId).lean().exec();
  if (!batch) return { enrolled: 0, skipped: 0 };
  if (!batchHasDemoCourses(batch)) return { enrolled: 0, skipped: 0 };

  const students = await UserModel.find({
    roles: ROLE.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
  })
    .select("_id")
    .lean()
    .exec();

  let enrolled = 0;
  let skipped = 0;
  for (const s of students) {
    const studentId = String(s._id);
    const existing = await EnrollmentModel.findOne({ studentId, batchId: batchMongoId }).exec();
    if (existing) {
      skipped += 1;
      continue;
    }
    try {
      const doc = await EnrollmentModel.create({
        studentId,
        batchId: batchMongoId,
        status: ENROLLMENT_STATUS.ACTIVE,
      });
      await createAuditLog("ENROLLMENT_CREATED", performedBy, "Enrollment", String(doc._id));
      enrolled += 1;
    } catch (err) {
      if (isDuplicateKeyError(err)) skipped += 1;
      else throw err;
    }
  }
  return { enrolled, skipped };
}
