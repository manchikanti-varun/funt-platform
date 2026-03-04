
import { BatchModel } from "../models/Batch.model.js";
import { ModuleProgressModel } from "../models/ModuleProgress.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { EnrollmentRequestModel } from "../models/EnrollmentRequest.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { BATCH_STATUS, ENROLLMENT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";

function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

type ModuleSnapshot = {
  order?: number;
  title?: string;
  description?: string;
  content?: string;
  youtubeUrl?: string;
  videoUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
  [k: string]: unknown;
};

type ProgressDoc = {
  moduleOrder: number;
  completedAt?: Date | null;
  contentCompletedAt?: Date | null;
  videoCompletedAt?: Date | null;
  youtubeCompletedAt?: Date | null;
  assignmentCompletedAt?: Date | null;
};

function moduleParts(m: ModuleSnapshot): { hasContent: boolean; hasVideo: boolean; hasYoutube: boolean; hasAssignment: boolean } {
  return {
    hasContent: !!((m.content as string)?.trim?.() ?? ""),
    hasVideo: !!((m.videoUrl as string)?.trim?.() ?? ""),
    hasYoutube: !!((m.youtubeUrl as string)?.trim?.() ?? ""),
    hasAssignment: !!((m.linkedAssignmentId as string)?.trim?.() ?? ""),
  };
}

function isModuleFullyCompleted(parts: ReturnType<typeof moduleParts>, p: ProgressDoc | null): boolean {
  if (!p) return false;
  if (p.completedAt) return true;
  const { hasContent, hasVideo, hasYoutube, hasAssignment } = parts;
  if (hasContent && !p.contentCompletedAt) return false;
  if (hasVideo && !p.videoCompletedAt) return false;
  if (hasYoutube && !p.youtubeCompletedAt) return false;
  if (hasAssignment && !p.assignmentCompletedAt) return false;
  return true;
}

/** Get one course's content from a batch (by courseId when batch has multiple courses). */
export async function getBatchCourseForStudent(studentId: string, batchId: string, courseId?: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  if (snapshots.length === 0) throw new AppError("Batch has no courses", 404);

  const snapshot = (courseId
    ? snapshots.find((s) => (s as { courseId?: string }).courseId === courseId)
    : snapshots[0]) as { modules?: ModuleSnapshot[]; title?: string; description?: string; courseId?: string } | null;
  if (!snapshot) throw new AppError("Course not found in this batch", 404);

  const snapshotCourseId = snapshot.courseId ?? batchMongoId;

  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).exec();

  const hasAccess = !!enrollment;

  const rawModules = snapshot?.modules ?? [];

  let modules: Array<Record<string, unknown> & {
    order: number;
    unlocked: boolean;
    completed: boolean;
    hasContent?: boolean;
    hasVideo?: boolean;
    hasYoutube?: boolean;
    hasAssignment?: boolean;
    contentCompleted?: boolean;
    videoCompleted?: boolean;
    youtubeCompleted?: boolean;
    assignmentCompleted?: boolean;
  }>;

  if (hasAccess) {
    const progressList = await ModuleProgressModel.find(
      snapshots.length > 1
        ? { studentId, batchId: batchMongoId, courseId: snapshotCourseId }
        : { studentId, batchId: batchMongoId, $or: [{ courseId: snapshotCourseId }, { courseId: null }, { courseId: { $exists: false } }] }
    ).lean().exec();
    const progressByOrder = new Map<number, ProgressDoc>();
    for (const p of progressList) {
      progressByOrder.set((p as { moduleOrder: number }).moduleOrder, p as ProgressDoc);
    }
    const completedOrders = new Set<number>();
    modules = rawModules.map((m, idx) => {
      const order = (m.order as number) ?? idx;
      const parts = moduleParts(m as ModuleSnapshot);
      const progress = progressByOrder.get(order) ?? null;
      const completed = isModuleFullyCompleted(parts, progress);
      if (completed) completedOrders.add(order);
      const unlocked = order === 0 || completedOrders.has(order - 1);
      return {
        ...m,
        order,
        unlocked,
        completed,
        hasContent: parts.hasContent,
        hasVideo: parts.hasVideo,
        hasYoutube: parts.hasYoutube,
        hasAssignment: parts.hasAssignment,
        contentCompleted: !!progress?.contentCompletedAt,
        videoCompleted: !!progress?.videoCompletedAt,
        youtubeCompleted: !!progress?.youtubeCompletedAt,
        assignmentCompleted: !!progress?.assignmentCompletedAt,
      };
    });
  } else {
    modules = rawModules.map((m, idx) => ({
      order: (m.order as number) ?? idx,
      title: m.title,
      unlocked: false,
      completed: false,
    }));
  }

  const batchDoc = batch as { _id: unknown; batchId?: string; name: string; zoomLink?: string; trainerId: string; startDate: unknown; endDate?: unknown; status: string };
  return {
    batchId: batchMongoId,
    batchFuntId: batchDoc.batchId,
    name: batchDoc.name,
    hasAccess,
    courseId: snapshotCourseId,
    courseSnapshot: {
      courseId: snapshotCourseId,
      title: snapshot?.title ?? "Course",
      description: snapshot?.description ?? "",
      modules,
    },
    trainerId: batchDoc.trainerId,
    startDate: batchDoc.startDate,
    endDate: batchDoc.endDate,
    zoomLink: batchDoc.zoomLink,
    status: batchDoc.status,
  };
}

/** List courses the student is enrolled in (one entry per course in each batch; batch can have multiple courses). */
export async function getMyCoursesForStudent(studentId: string) {
  const enrollments = await EnrollmentModel.find({
    studentId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  })
    .sort({ enrolledAt: -1 })
    .lean()
    .exec();
  const batchIds = enrollments.map((e) => e.batchId);
  const batches = await BatchModel.find({ _id: { $in: batchIds } }).lean().exec();
  const result: Array<{
    courseId: string;
    courseTitle: string;
    description?: string;
    moduleCount: number;
    batchId: string;
  }> = [];
  for (const batch of batches) {
    const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    for (const snap of snapshots) {
      const s = snap as { courseId?: string; title?: string; description?: string; modules?: unknown[] };
      const courseId = s?.courseId ?? String(batch._id);
      result.push({
        courseId,
        courseTitle: s?.title ?? "Course",
        description: s?.description,
        moduleCount: Array.isArray(s?.modules) ? s.modules.length : 0,
        batchId: String(batch._id),
      });
    }
  }
  return result;
}

export async function getCourseForStudentByCourseId(studentId: string, courseId: string, batchId?: string) {
  const normalizedCourseId = typeof courseId === "string" ? courseId.split("&")[0].trim() : "";
  if (!normalizedCourseId) throw new AppError("Course not found", 404);

  let batches = await BatchModel.find({
    $or: [{ "courseSnapshots.courseId": normalizedCourseId }, { "courseSnapshot.courseId": normalizedCourseId }],
  }).lean().exec();
  if (!batches.length && normalizedCourseId) {
    const batchById = await findBatchByParam(normalizedCourseId);
    if (batchById) batches = [batchById];
  }
  if (!batches.length) throw new AppError("Course not found", 404);

  if (batchId) batches = batches.filter((b) => String(b._id) === batchId);

  const batchIds = batches.map((b) => String(b._id));
  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: { $in: batchIds },
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).exec();

  const resolvedBatchId = enrollment ? enrollment.batchId : String(batches[0]._id);
  const data = await getBatchCourseForStudent(studentId, resolvedBatchId, normalizedCourseId);

  let hasPendingRequest = false;
  if (!data.hasAccess) {
    const pending = await EnrollmentRequestModel.findOne({
      studentId,
      batchId: { $in: batchIds },
      status: "PENDING",
    }).exec();
    hasPendingRequest = !!pending;
  }

  return { ...data, courseId: normalizedCourseId, hasPendingRequest };
}

export async function listCoursesForExplore() {
  const batches = await BatchModel.find({ status: { $ne: BATCH_STATUS.ARCHIVED } })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  const byCourseId = new Map<string, { batchId: string; courseTitle: string; description?: string; moduleCount: number }>();
  for (const batch of batches) {
    const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    for (const snap of snapshots) {
      const s = snap as { courseId?: string; title?: string; description?: string; modules?: unknown[] };
      const courseId = s?.courseId ?? String(batch._id);
      if (byCourseId.has(courseId)) continue;
      byCourseId.set(courseId, {
        batchId: String(batch._id),
        courseTitle: s?.title ?? "Course",
        description: s?.description,
        moduleCount: Array.isArray(s?.modules) ? s.modules.length : 0,
      });
    }
  }
  return Array.from(byCourseId.entries()).map(([courseId, v]) => ({
    courseId,
    courseTitle: v.courseTitle,
    description: v.description,
    moduleCount: v.moduleCount,
    batchId: v.batchId,
  }));
}

export type ModulePart = "content" | "video" | "youtube";

export async function markModulePartComplete(
  studentId: string,
  batchId: string,
  moduleOrder: number,
  part: ModulePart,
  courseId?: string
) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snapshot = (courseId ? snapshots.find((s) => (s as { courseId?: string }).courseId === courseId) : snapshots[0]) as { courseId?: string; modules?: ModuleSnapshot[] } | undefined;
  if (!snapshot) throw new AppError("Course not found in batch", 404);
  const snapshotCourseId = snapshot.courseId ?? batchMongoId;

  const rawModules = snapshot?.modules ?? [];
  if (moduleOrder < 0 || moduleOrder >= rawModules.length) throw new AppError("Module not found in batch", 404);

  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).exec();
  if (!enrollment) throw new AppError("You are not enrolled in this batch", 403);

  const mod = rawModules[moduleOrder] as ModuleSnapshot;
  const parts = moduleParts(mod);
  const field = part === "content" ? "contentCompletedAt" : part === "video" ? "videoCompletedAt" : "youtubeCompletedAt";
  const hasPart = part === "content" ? parts.hasContent : part === "video" ? parts.hasVideo : parts.hasYoutube;
  if (!hasPart) throw new AppError(`This module has no ${part} to complete`, 400);

  const now = new Date();
  const filter = { studentId, batchId: batchMongoId, courseId: snapshotCourseId, moduleOrder };
  const update = { $set: { studentId, batchId: batchMongoId, courseId: snapshotCourseId, moduleOrder, [field]: now, completedBy: studentId, isManualOverride: false } };
  let updated: unknown;
  try {
    updated = await ModuleProgressModel.findOneAndUpdate(filter, update, { upsert: true, new: true }).lean().exec();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const fallbackFilter = { studentId, batchId: batchMongoId, moduleOrder };
      updated = await ModuleProgressModel.findOneAndUpdate(fallbackFilter, update, { new: true }).lean().exec();
    } else {
      throw err;
    }
  }

  const progress = updated as unknown as ProgressDoc;
  const allDone =
    (!parts.hasContent || !!progress.contentCompletedAt) &&
    (!parts.hasVideo || !!progress.videoCompletedAt) &&
    (!parts.hasYoutube || !!progress.youtubeCompletedAt) &&
    (!parts.hasAssignment || !!progress.assignmentCompletedAt);
  if (allDone) {
    await ModuleProgressModel.updateOne(
      { studentId, batchId: batchMongoId, moduleOrder },
      { $set: { completedAt: now } }
    ).exec();
  }

  return { batchId: batchMongoId, courseId: snapshotCourseId, moduleOrder, part, completed: true, moduleCompleted: allDone };
}

export async function markModuleComplete(studentId: string, batchId: string, moduleOrder: number, courseId?: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snapshot = (courseId ? snapshots.find((s) => (s as { courseId?: string }).courseId === courseId) : snapshots[0]) as { courseId?: string; modules?: unknown[] } | undefined;
  if (!snapshot) throw new AppError("Course not found in batch", 404);
  const snapshotCourseId = snapshot.courseId ?? batchMongoId;

  const modules = snapshot?.modules ?? [];
  if (moduleOrder < 0 || moduleOrder >= modules.length) throw new AppError("Module not found in batch", 404);

  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).exec();
  if (!enrollment) throw new AppError("You are not enrolled in this batch", 403);

  const now = new Date();
  const filter = { studentId, batchId: batchMongoId, courseId: snapshotCourseId, moduleOrder };
  const update = {
    $set: {
      studentId,
      batchId: batchMongoId,
      courseId: snapshotCourseId,
      moduleOrder,
      completedAt: now,
      completedBy: studentId,
      isManualOverride: false,
    },
  };
  try {
    await ModuleProgressModel.findOneAndUpdate(filter, update, { upsert: true }).exec();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      await ModuleProgressModel.findOneAndUpdate(
        { studentId, batchId: batchMongoId, moduleOrder },
        update
      ).exec();
    } else {
      throw err;
    }
  }

  return { batchId: batchMongoId, courseId: snapshotCourseId, moduleOrder, completed: true };
}
