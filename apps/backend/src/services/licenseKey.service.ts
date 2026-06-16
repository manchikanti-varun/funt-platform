import crypto from "crypto";
import mongoose, { type ClientSession } from "mongoose";
import { LicenseKeyModel } from "../models/LicenseKey.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { CourseModel } from "../models/Course.model.js";
import { UserModel } from "../models/User.model.js";
import { getBatchCourseSnapshots } from "./batch.service.js";
import { createEnrollment } from "./enrollment.service.js";
import { createAuditLog } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { unlockMilestonesByLicenseKey } from "./learningPlan.service.js";
import { ENROLLMENT_STATUS, LICENSE_KEY_TYPE } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";

const MAX_KEYS_PER_REQUEST = 100;

function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type BatchLean = {
  _id: unknown;
  name?: string;
  batchId?: string | null;
  courseSnapshots?: unknown[] | null;
  courseSnapshot?: unknown | null;
};

function titleFromBatchSnapshot(batch: BatchLean | undefined, courseId: string): string | null {
  if (!batch) return null;
  const cid = String(courseId ?? "").trim();
  if (!cid) return null;
  const snaps = getBatchCourseSnapshots(batch as never);
  const snap = snaps.find((s) => {
    const sc = String((s as { courseId?: string }).courseId ?? "").trim();
    return sc === cid;
  });
  const t = (snap as { title?: string } | undefined)?.title?.trim();
  return t || null;
}

/** Super Admin audit: do not expose full secret in lists. */
export function maskLicenseKey(key: string): string {
  const t = key.trim();
  if (t.length < 12) return "••••";
  return `FUNT-…${t.slice(-6)}`;
}

function randomKey(): string {
  return `FUNT-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

async function insertUniqueLicenseKey(input: {
  courseId: string;
  batchMongoId: string;
  createdBy: string;
}): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const key = randomKey();
    try {
      await LicenseKeyModel.create({
        courseId: input.courseId,
        batchId: input.batchMongoId,
        key,
        createdBy: input.createdBy,
      });
      return key;
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11000) continue;
      throw err;
    }
  }
  throw new AppError("Could not allocate a unique license key", 500);
}

async function findBatchForCourse(courseId: string, batchId?: string) {
  if (batchId?.trim()) {
    const b = await BatchModel.findById(batchId.trim()).lean().exec();
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
  if (batches.length > 1) {
    throw new AppError(
      "Multiple batches include this course. Select the batch (cohort) the keys should enroll students into, then try again.",
      400
    );
  }

  const b = batches[0];
  return { batchMongoId: String(b._id), batch: b };
}

/**
 * Create one or many single-use license keys for the same course + batch (up to {@link MAX_KEYS_PER_REQUEST} per request).
 */
export async function generateCourseLicenseKeys(input: {
  courseId: string;
  batchId?: string;
  createdBy: string;
  /** Defaults to 1. Max {@link MAX_KEYS_PER_REQUEST}. */
  count?: number;
}): Promise<{ keys: string[]; courseId: string; batchId: string }> {
  const n = Math.min(Math.max(Math.floor(Number(input.count) || 1), 1), MAX_KEYS_PER_REQUEST);
  const { batchMongoId } = await findBatchForCourse(input.courseId, input.batchId);
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    keys.push(
      await insertUniqueLicenseKey({
        courseId: input.courseId,
        batchMongoId,
        createdBy: input.createdBy,
      })
    );
  }
  return { keys: shuffleArray(keys), courseId: input.courseId, batchId: batchMongoId };
}

/**
 * Create license key(s) for a specific milestone. When redeemed, unlocks that milestone directly (bypasses progression).
 */
export async function generateMilestoneLicenseKeys(input: {
  courseId: string;
  batchId: string;
  milestoneId: string;
  createdBy: string;
  count?: number;
}): Promise<{ keys: string[]; courseId: string; batchId: string; milestoneId: string }> {
  const n = Math.min(Math.max(Math.floor(Number(input.count) || 1), 1), MAX_KEYS_PER_REQUEST);
  const batch = await BatchModel.findById(input.batchId).lean().exec();
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String(batch._id);

  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const key = randomKey();
    await LicenseKeyModel.create({
      courseId: input.courseId,
      batchId: batchMongoId,
      key,
      createdBy: input.createdBy,
      licenseType: LICENSE_KEY_TYPE.MILESTONE_ACCESS,
      targetMilestoneIds: [input.milestoneId],
    });
    keys.push(key);
  }
  return { keys: shuffleArray(keys), courseId: input.courseId, batchId: batchMongoId, milestoneId: input.milestoneId };
}

/**
 * Create license key(s) for full program access. When redeemed, unlocks ALL milestones (bypasses progression).
 */
export async function generateFullPlanLicenseKeys(input: {
  courseId: string;
  batchId: string;
  createdBy: string;
  count?: number;
}): Promise<{ keys: string[]; courseId: string; batchId: string }> {
  const n = Math.min(Math.max(Math.floor(Number(input.count) || 1), 1), MAX_KEYS_PER_REQUEST);
  const batch = await BatchModel.findById(input.batchId).lean().exec();
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String(batch._id);

  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const key = randomKey();
    await LicenseKeyModel.create({
      courseId: input.courseId,
      batchId: batchMongoId,
      key,
      createdBy: input.createdBy,
      licenseType: LICENSE_KEY_TYPE.FULL_PLAN_ACCESS,
      targetMilestoneIds: [],
    });
    keys.push(key);
  }
  return { keys: shuffleArray(keys), courseId: input.courseId, batchId: batchMongoId };
}

export async function listLicenseKeyAudit(input: {
  page: number;
  limit: number;
  usedOnly?: boolean;
}): Promise<{
  rows: Array<{
    id: string;
    keyMasked: string;
    key: string;
    courseId: string;
    courseTitle: string | null;
    batchId: string | null;
    batchName: string | null;
    batchCode: string | null;
    createdByUserId: string;
    createdByName: string;
    createdByUsername: string;
    createdAt: string;
    usedByStudentId: string | null;
    usedByName: string | null;
    usedByUsername: string | null;
    usedAt: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const limit = Math.min(Math.max(input.limit, 1), 100);
  const page = Math.max(input.page, 1);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (input.usedOnly) {
    filter.usedByStudentId = { $exists: true, $nin: [null, ""] };
  }

  const [total, docs] = await Promise.all([
    LicenseKeyModel.countDocuments(filter),
    LicenseKeyModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
  ]);

  const userIds = new Set<string>();
  for (const d of docs) {
    userIds.add(String(d.createdBy));
    if (d.usedByStudentId) userIds.add(String(d.usedByStudentId));
  }
  const users = await UserModel.find({ _id: { $in: [...userIds] } })
    .select("name username")
    .lean()
    .exec();
  const umap = new Map(users.map((u) => [String(u._id), u as { name?: string; username?: string }]));

  const canonicalCourseIds = [...new Set(docs.map((d) => d.courseId).filter(Boolean))] as string[];
  const objectIds = canonicalCourseIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const courses = await CourseModel.find({
    $or: [
      { courseId: { $in: canonicalCourseIds } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
    ],
  })
    .select("title courseId")
    .lean()
    .exec();

  const titleByKey = new Map<string, string>();
  for (const c of courses) {
    const doc = c as { _id: unknown; title?: string; courseId?: string };
    const title = doc.title?.trim() || "";
    if (doc.courseId) titleByKey.set(String(doc.courseId), title);
    titleByKey.set(String(doc._id), title);
  }

  const rawBatchKeys = [...new Set(docs.map((d) => d.batchId).filter(Boolean).map((x) => String(x)))] as string[];
  const batchObjectIds: mongoose.Types.ObjectId[] = [];
  const batchHumanIds: string[] = [];
  for (const key of rawBatchKeys) {
    if (mongoose.Types.ObjectId.isValid(key) && new mongoose.Types.ObjectId(key).toString() === key) {
      batchObjectIds.push(new mongoose.Types.ObjectId(key));
    } else {
      batchHumanIds.push(key);
    }
  }
  const batchOr: Record<string, unknown>[] = [];
  if (batchObjectIds.length) batchOr.push({ _id: { $in: batchObjectIds } });
  if (batchHumanIds.length) batchOr.push({ batchId: { $in: batchHumanIds } });

  const batches =
    batchOr.length > 0
      ? await BatchModel.find({ $or: batchOr })
          .select("name batchId courseSnapshots courseSnapshot")
          .lean()
          .exec()
      : [];

  const batchMap = new Map<string, BatchLean>();
  for (const b of batches as BatchLean[]) {
    const lean = b;
    batchMap.set(String(lean._id), lean);
    if (lean.batchId) batchMap.set(String(lean.batchId), lean);
  }

  const rows = docs.map((d) => {
    const creator = umap.get(String(d.createdBy));
    const used = d.usedByStudentId ? umap.get(String(d.usedByStudentId)) : undefined;
    const batch = d.batchId ? batchMap.get(String(d.batchId)) : undefined;
    const fromCourseDoc = (titleByKey.get(String(d.courseId)) ?? "").trim();
    const fromSnapshot = titleFromBatchSnapshot(batch, String(d.courseId));
    const courseTitle = (fromCourseDoc || fromSnapshot || null) as string | null;

    return {
      id: String(d._id),
      keyMasked: maskLicenseKey(String(d.key)),
      key: String(d.key),
      courseId: d.courseId,
      courseTitle: courseTitle || null,
      batchId: d.batchId ? String(d.batchId) : null,
      batchName: batch?.name?.trim() ? batch.name.trim() : null,
      batchCode: batch?.batchId ? String(batch.batchId) : null,
      createdByUserId: String(d.createdBy),
      createdByName: creator?.name?.trim() || "—",
      createdByUsername: creator?.username?.trim() || "—",
      createdAt: d.createdAt ? new Date(d.createdAt as Date).toISOString() : "",
      usedByStudentId: d.usedByStudentId ? String(d.usedByStudentId) : null,
      usedByName: used?.name?.trim() ?? null,
      usedByUsername: used?.username?.trim() ?? null,
      usedAt: d.usedAt ? new Date(d.usedAt as Date).toISOString() : null,
    };
  });

  return { rows, total, page, limit };
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
  const alreadyEnrolled = existing && (existing.status === ENROLLMENT_STATUS.ACTIVE || existing.status === ENROLLMENT_STATUS.COMPLETED);
  const licenseType = (license as { licenseType?: string }).licenseType;
  const targetMilestoneIds = (license as { targetMilestoneIds?: string[] }).targetMilestoneIds ?? [];
  const isMilestoneKey = licenseType && licenseType !== LICENSE_KEY_TYPE.COURSE_ACCESS;

  // If already enrolled and this is a course-level key, reject
  if (alreadyEnrolled && !isMilestoneKey) {
    throw new AppError("You are already enrolled in this batch", 400);
  }

  // If not enrolled, create enrollment
  if (!alreadyEnrolled) {
    await createEnrollment({
      studentId,
      batchId,
      createdBy: studentId,
    });
  }

  await LicenseKeyModel.updateOne(
    { _id: license._id },
    { $set: { usedByStudentId: studentId, usedAt: new Date() } }
  ).exec();

  // Audit: license redeemed
  await createAuditLog("LICENSE_KEY_REDEEMED", studentId, "LicenseKey", String(license._id), {
    courseId: license.courseId,
    batchId,
    licenseType: licenseType ?? LICENSE_KEY_TYPE.COURSE_ACCESS,
  }).catch(() => {});

  // Notify student
  const courseName = titleFromBatchSnapshot(batch as BatchLean | undefined, String(license.courseId)) ?? "Course";
  await createNotification({
    userId: studentId,
    title: "License Key Redeemed ✅",
    body: `You've been enrolled in ${courseName} using your license key.`,
    type: "LICENSE_KEY_REDEEMED",
    referenceId: String(license._id),
  }).catch(() => {});

  // ── Learning Plan: unlock milestones if this is a milestone-type license key ──
  if (isMilestoneKey && license.courseId) {
    try {
      await unlockMilestonesByLicenseKey(
        studentId,
        batchId,
        license.courseId,
        String(license._id),
        String(license.key),
        licenseType === LICENSE_KEY_TYPE.FULL_PLAN_ACCESS ? [] : targetMilestoneIds
      );
    } catch (lpErr) {
      console.error(
        `[LP_LICENSE_UNLOCK_FAILED] studentId=${studentId} licenseId=${String(license._id)}`,
        lpErr instanceof Error ? lpErr.message : lpErr
      );
      // Non-blocking: enrollment succeeded, license marked used. Milestone unlock can be retried by admin.
    }
  }

  return { message: "Enrolled successfully using license key", batchId };
}

/** After payment verification: single-use key is created and marked consumed by this student (audit trail). */
export async function recordLicenseKeyConsumedForPayment(input: {
  studentId: string;
  courseId: string;
  batchMongoId: string;
  createdBy: string;
  session?: ClientSession;
}): Promise<{ key: string }> {
  const key = randomKey();
  await LicenseKeyModel.create(
    [
      {
        courseId: input.courseId,
        batchId: input.batchMongoId,
        key,
        createdBy: input.createdBy,
        usedByStudentId: input.studentId,
        usedAt: new Date(),
      },
    ],
    input.session ? { session: input.session } : undefined
  );
  return { key };
}
