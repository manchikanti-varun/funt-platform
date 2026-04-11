import crypto from "crypto";
import { LicenseKeyModel } from "../models/LicenseKey.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { getBatchCourseSnapshots } from "./batch.service.js";
import { createEnrollment } from "./enrollment.service.js";
import { ENROLLMENT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";

function randomKey(): string {
  return `FUNT-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

async function findBatchForCourse(courseId: string, batchId?: string) {
  if (batchId) {
    const b = await BatchModel.findById(batchId).lean().exec();
    if (!b) throw new AppError("Batch not found", 404);
    const snaps = getBatchCourseSnapshots(b as Parameters<typeof getBatchCourseSnapshots>[0]);
    const ok = snaps.some((s) => (s as { courseId?: string }).courseId === courseId);
    if (!ok) throw new AppError("Course is not part of this batch", 400);
    return { batchMongoId: String(b._id), batch: b };
  }
  const batches = await BatchModel.find({
    $or: [{ "courseSnapshots.courseId": courseId }, { "courseSnapshot.courseId": courseId }],
  })
    .lean()
    .exec();
  if (!batches.length) throw new AppError("No batch found for this course. Create a batch first.", 404);
  const b = batches[0];
  return { batchMongoId: String(b._id), batch: b };
}

export async function generateCourseLicenseKey(input: {
  courseId: string;
  batchId?: string;
  createdBy: string;
}) {
  const { batchMongoId } = await findBatchForCourse(input.courseId, input.batchId);
  const key = randomKey();
  const doc = await LicenseKeyModel.create({
    courseId: input.courseId,
    batchId: batchMongoId,
    key,
    createdBy: input.createdBy,
  });
  return { id: String(doc._id), key: doc.key, courseId: doc.courseId, batchId: doc.batchId };
}

export async function redeemLicenseKey(studentId: string, rawKey: string) {
  const key = rawKey.trim();
  if (!key) throw new AppError("License key is required", 400);

  const license = await LicenseKeyModel.findOne({ key }).exec();
  if (!license) throw new AppError("Invalid license key", 400);
  if (license.usedByStudentId) throw new AppError("This license key has already been used", 400);

  const batchId = license.batchId;
  if (!batchId) throw new AppError("License is misconfigured (no batch)", 500);

  const batch = await BatchModel.findById(batchId).lean().exec();
  if (!batch) throw new AppError("Batch no longer exists", 400);

  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const allowed = snaps.some((s) => (s as { courseId?: string }).courseId === license.courseId);
  if (!allowed) throw new AppError("License does not match course offering", 400);

  const existing = await EnrollmentModel.findOne({ studentId, batchId }).exec();
  if (existing && (existing.status === ENROLLMENT_STATUS.ACTIVE || existing.status === ENROLLMENT_STATUS.COMPLETED)) {
    throw new AppError("You are already enrolled in this batch", 400);
  }

  await createEnrollment({
    studentId,
    batchId,
    createdBy: studentId,
  });

  await LicenseKeyModel.updateOne(
    { _id: license._id },
    { $set: { usedByStudentId: studentId, usedAt: new Date() } }
  ).exec();

  return { message: "Enrolled successfully using license key", batchId };
}

/** After payment verification: single-use key is created and marked consumed by this student (audit trail). */
export async function recordLicenseKeyConsumedForPayment(input: {
  studentId: string;
  courseId: string;
  batchMongoId: string;
  createdBy: string;
}): Promise<{ key: string }> {
  const key = randomKey();
  await LicenseKeyModel.create({
    courseId: input.courseId,
    batchId: input.batchMongoId,
    key,
    createdBy: input.createdBy,
    usedByStudentId: input.studentId,
    usedAt: new Date(),
  });
  return { key };
}
