
import { BatchModel } from "../models/Batch.model.js";
import { CourseModel } from "../models/Course.model.js";
import { ChapterProgressModel } from "../models/ModuleProgress.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { UserModel } from "../models/User.model.js";
import { EnrollmentRequestModel } from "../models/EnrollmentRequest.model.js";
import { LicenseKeyModel } from "../models/LicenseKey.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { normalizeAllowedPaymentMethods, formatPaymentMethodsLabel } from "../utils/coursePaymentMethods.js";
import { getLatestCoursePaymentState } from "./paymentSubmission.service.js";
import { BATCH_STATUS, ENROLLMENT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";
import { resolveHeaderImageDisplayUrl } from "../utils/headerImageUrl.js";
import { ensureFirstModuleCompletedBadge } from "./achievement.service.js";

function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

/**
 * Returns true when the student enrolled in this batch via a license key.
 * License key enrollments bypass the payment gate — the key itself IS the proof of purchase.
 */
async function hasLicenseKeyEnrollment(studentId: string, batchId: string): Promise<boolean> {
  const exists = await LicenseKeyModel.exists({
    batchId,
    usedByStudentId: studentId,
  }).exec();
  return !!exists;
}

async function loadCourseHeaderImageMap(courseIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(courseIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const byMongo = unique.filter((x) => OBJECT_ID_REGEX.test(x));
  const byHuman = unique.filter((x) => !OBJECT_ID_REGEX.test(x));
  const courses = await CourseModel.find({
    $or: [
      ...(byMongo.length ? [{ _id: { $in: byMongo } }] : []),
      ...(byHuman.length ? [{ courseId: { $in: byHuman } }] : []),
    ],
  })
    .select("courseId headerImageUrl")
    .lean()
    .exec();
  for (const c of courses) {
    const url = String((c as { headerImageUrl?: string }).headerImageUrl ?? "").trim();
    if (!url) continue;
    const human = String((c as { courseId?: string }).courseId ?? "").trim();
    if (human) map.set(human, url);
    map.set(String(c._id), url);
  }
  return map;
}

function resolveCourseHeaderImageUrl(
  courseId: string,
  snapshotUrl: string | undefined,
  catalog: Map<string, string>
): string | undefined {
  const fromCatalog = catalog.get(courseId.trim());
  const raw = fromCatalog || String(snapshotUrl ?? "").trim();
  if (!raw) return undefined;
  return resolveHeaderImageDisplayUrl(raw);
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
  xpReward?: unknown;
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

function isCourseBlockedInEnrollment(enrollment: unknown, courseId: string): boolean {
  if (!enrollment || !courseId) return false;
  const raw = (enrollment as { courseAccessBlocked?: unknown }).courseAccessBlocked;
  if (raw instanceof Map) return !!raw.get(courseId);
  if (raw && typeof raw === "object") {
    return !!(raw as Record<string, boolean>)[courseId];
  }
  return false;
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

  const blocked = !!(enrollment as { accessBlocked?: boolean } | null)?.accessBlocked;
  const courseBlocked = isCourseBlockedInEnrollment(
    enrollment as ({ courseAccessBlocked?: Map<string, boolean> | Record<string, boolean> } & Record<string, unknown>) | null,
    snapshotCourseId
  );
  const enrollmentPriceInPaise = Math.max(
    0,
    Math.floor(Number((snapshot as { enrollmentPriceInPaise?: number }).enrollmentPriceInPaise ?? 0))
  );
  let hasVerifiedCoursePayment = false;
  if (!!enrollment && !blocked && enrollmentPriceInPaise >= 100) {
    const payState = await getLatestCoursePaymentState(studentId, batchMongoId, snapshotCourseId);
    hasVerifiedCoursePayment = payState?.status === "VERIFIED";
    // License key enrollment bypasses payment requirement
    if (!hasVerifiedCoursePayment) {
      hasVerifiedCoursePayment = await hasLicenseKeyEnrollment(studentId, batchMongoId);
    }
  }
  const hasAccess = !!enrollment && !blocked && !courseBlocked && (enrollmentPriceInPaise < 100 || hasVerifiedCoursePayment);

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
    const progressList = await ChapterProgressModel.find(
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

  const batchDoc = batch as {
    _id: unknown;
    batchId?: string;
    name: string;
    zoomLink?: string;
    trainerId: string;
    startDate: unknown;
    endDate?: unknown;
    status: string;
    certificatePriceCoins?: number;
    visibility?: "PUBLIC" | "PRIVATE";
  };
  const catalogHeaders = await loadCourseHeaderImageMap([snapshotCourseId]);
  const courseHeaderImageUrl = resolveCourseHeaderImageUrl(
    snapshotCourseId,
    String((snapshot as { headerImageUrl?: string })?.headerImageUrl ?? "").trim() || undefined,
    catalogHeaders
  );
  const tid = String(batchDoc.trainerId ?? "").trim();
  let trainerName: string | undefined;
  let trainerUsername: string | undefined;
  if (/^[a-fA-F0-9]{24}$/.test(tid)) {
    const tu = await UserModel.findById(tid).select("name username").lean().exec();
    if (tu) {
      trainerName = String((tu as { name?: string }).name ?? "").trim() || undefined;
      trainerUsername = String((tu as { username?: string }).username ?? "").trim() || undefined;
    }
  }
  return {
    batchId: batchMongoId,
    batchFuntId: batchDoc.batchId,
    name: batchDoc.name,
    hasAccess,
    /** True when student is enrolled but an admin disabled LMS access for this enrollment. */
    accessBlocked: blocked || courseBlocked,
    /** True when an enrollment row exists (active/completed), regardless of block. */
    isEnrolled: !!enrollment,
    courseId: snapshotCourseId,
    certificatePriceCoins: Math.max(0, Math.floor(Number(batchDoc.certificatePriceCoins ?? 0))),
    visibility: batchDoc.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    headerImageUrl: courseHeaderImageUrl,
    courseSnapshot: {
      courseId: snapshotCourseId,
      title: snapshot?.title ?? "Course",
      description: snapshot?.description ?? "",
      modules,
      chapters: modules,
    },
    trainerId: batchDoc.trainerId,
    ...(trainerName ? { trainerName, trainerUsername } : {}),
    startDate: batchDoc.startDate,
    endDate: batchDoc.endDate,
    zoomLink: batchDoc.zoomLink,
    status: batchDoc.status,
  };
}

async function computeProgressPercent(
  studentId: string,
  batchMongoId: string,
  snapshotCourseId: string,
  rawModules: ModuleSnapshot[],
  snapshotsLength: number
): Promise<number> {
  if (rawModules.length === 0) return 0;
  const progressList = await ChapterProgressModel.find(
    snapshotsLength > 1
      ? { studentId, batchId: batchMongoId, courseId: snapshotCourseId }
      : { studentId, batchId: batchMongoId, $or: [{ courseId: snapshotCourseId }, { courseId: null }, { courseId: { $exists: false } }] }
  )
    .lean()
    .exec();
  const progressByOrder = new Map<number, ProgressDoc>();
  for (const p of progressList) {
    progressByOrder.set((p as { moduleOrder: number }).moduleOrder, p as ProgressDoc);
  }
  let completed = 0;
  rawModules.forEach((m, idx) => {
    const order = (m.order as number) ?? idx;
    const parts = moduleParts(m as ModuleSnapshot);
    const progress = progressByOrder.get(order) ?? null;
    if (isModuleFullyCompleted(parts, progress)) completed += 1;
  });
  return Math.round((completed / rawModules.length) * 100);
}

const DEFAULT_MODULE_XP = 40;

function xpAwardForModuleSnapshot(m: ModuleSnapshot): number {
  const raw = m.xpReward;
  if (raw === undefined || raw === null) return DEFAULT_MODULE_XP;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MODULE_XP;
  return Math.min(100_000, n);
}

async function awardChapterXp(studentId: string, amount: number) {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < 1) return;
  await UserModel.updateOne({ _id: studentId }, { $inc: { studentXp: n } }).exec();
}

/** XP-only award (e.g. approved assignment). Course completion level is increased when a certificate is issued. */
export async function awardStudentXp(studentId: string, amount: number) {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < 1) return;
  await UserModel.updateOne({ _id: studentId }, { $inc: { studentXp: n } }).exec();
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
  const batchById = new Map(batches.map((b) => [String(b._id), b]));
  const result: Array<{
    courseId: string;
    courseTitle: string;
    description?: string;
    chapterCount: number;
    moduleCount: number;
    batchId: string;
    progressPercent: number;
    accessBlocked: boolean;
    courseHeaderImageUrl?: string;
    isDemo?: boolean;
  }> = [];

  for (const e of enrollments) {
    const batch = batchById.get(e.batchId);
    if (!batch) continue;
    const blocked = !!(e as { accessBlocked?: boolean }).accessBlocked;
    const courseBlockMapRaw = (e as { courseAccessBlocked?: unknown }).courseAccessBlocked;
    const courseBlockMap =
      courseBlockMapRaw instanceof Map
        ? courseBlockMapRaw
        : courseBlockMapRaw && typeof courseBlockMapRaw === "object"
          ? new Map(Object.entries(courseBlockMapRaw as Record<string, boolean>))
          : new Map<string, boolean>();
    const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    for (const snap of snapshots) {
      const s = snap as { courseId?: string; title?: string; description?: string; modules?: ModuleSnapshot[] };
      const courseId = s?.courseId ?? String(batch._id);
      const courseBlocked = !!courseBlockMap.get(courseId);
      const modules = Array.isArray(s?.modules) ? s.modules : [];
      const enrollmentPriceInPaise = Math.max(0, Math.floor(Number((s as { enrollmentPriceInPaise?: number }).enrollmentPriceInPaise ?? 0)));
      const payState =
        !blocked && !courseBlocked && enrollmentPriceInPaise >= 100
          ? await getLatestCoursePaymentState(studentId, String(batch._id), courseId)
          : null;
      // License key enrollment bypasses the payment gate
      const licenseAccess =
        enrollmentPriceInPaise >= 100 && !payState
          ? await hasLicenseKeyEnrollment(studentId, String(batch._id))
          : false;
      const hasCourseAccess = !blocked && !courseBlocked && (enrollmentPriceInPaise < 100 || payState?.status === "VERIFIED" || licenseAccess);
      if (!hasCourseAccess) continue;

      const isAdminBlocked = blocked || courseBlocked;
      const pct = await computeProgressPercent(studentId, String(batch._id), courseId, modules, snapshots.length);
      result.push({
        courseId,
        courseTitle: s?.title ?? "Course",
        description: s?.description,
        chapterCount: modules.length,
        moduleCount: modules.length,
        batchId: String(batch._id),
        progressPercent: pct,
        accessBlocked: isAdminBlocked,
        courseHeaderImageUrl: String((s as { headerImageUrl?: string }).headerImageUrl ?? "").trim() || undefined,
        isDemo: !!(s as { isDemo?: boolean }).isDemo,
      });
    }
  }
  const catalog = await loadCourseHeaderImageMap(result.map((r) => r.courseId));
  return result.map((r) => ({
    ...r,
    courseHeaderImageUrl: resolveCourseHeaderImageUrl(
      r.courseId,
      r.courseHeaderImageUrl,
      catalog
    ),
  }));
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
  if (!batches.length) {
    throw new AppError("Course not found in this batch", 404);
  }

  const batchIds = batches.map((b) => String(b._id));
  const enrolledStatuses = { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] };
  let enrollment = null;
  const queryBatchId = batchId?.trim();
  if (queryBatchId && batchIds.includes(queryBatchId)) {
    enrollment = await EnrollmentModel.findOne({
      studentId,
      batchId: queryBatchId,
      status: enrolledStatuses,
    }).exec();
  }
  if (!enrollment) {
    enrollment = await EnrollmentModel.findOne({
      studentId,
      batchId: { $in: batchIds },
      status: enrolledStatuses,
    })
      .sort({ enrolledAt: -1 })
      .exec();
  }

  const resolvedBatchId = enrollment ? enrollment.batchId : String(batches[0]._id);
  const data = await getBatchCourseForStudent(studentId, resolvedBatchId, normalizedCourseId);

  let hasPendingRequest = false;
  let hasPendingCoursePaymentFlag = false;
  let hasRejectedCoursePayment = false;
  let coursePaymentRejectReason: string | undefined;
  /** Do not mix payment / request messaging with admin access block — student must see “blocked by admin” only. */
  if (!data.hasAccess && !data.accessBlocked) {
    const pending = await EnrollmentRequestModel.findOne({
      studentId,
      batchId: { $in: batchIds },
      status: "PENDING",
      $or: [
        { requestedCourseId: normalizedCourseId },
        { requestedCourseId: { $exists: false } },
        { requestedCourseId: "" },
        { requestedCourseId: null },
      ],
    }).exec();
    hasPendingRequest = !!pending;
    const payState = await getLatestCoursePaymentState(studentId, resolvedBatchId, normalizedCourseId);
    hasPendingCoursePaymentFlag = payState?.status === "PENDING";
    hasRejectedCoursePayment = payState?.status === "REJECTED";
    coursePaymentRejectReason = payState?.rejectReason;
  }

  return {
    ...data,
    courseId: normalizedCourseId,
    hasPendingRequest,
    hasPendingCoursePayment: hasPendingCoursePaymentFlag,
    hasRejectedCoursePayment,
    coursePaymentRejectReason,
  };
}

export async function listCoursesForExplore() {
  const batches = await BatchModel.find({
    status: { $ne: BATCH_STATUS.ARCHIVED },
    $or: [{ visibility: "PUBLIC" }, { visibility: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  const byBatchCourseKey = new Map<
    string,
    {
      batchId: string;
      batchName?: string;
      courseTitle: string;
      description?: string;
      chapterCount: number;
      moduleCount: number;
      enrollmentPriceInPaise: number;
      paymentOptionsLabel: string;
      courseHeaderImageUrl?: string;
      isDemo?: boolean;
      durationText?: string;
      ageGroup?: string;
      certification?: string;
      paymentNote?: string;
      learningOutcomes: string[];
      overview?: string;
      pricingTiers: unknown[];
    }
  >();
  for (const batch of batches) {
    const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    for (const snap of snapshots) {
      const s = snap as { courseId?: string; title?: string; description?: string; modules?: unknown[] };
      const courseId = s?.courseId ?? String(batch._id);
      const batchId = String(batch._id);
      const rowKey = `${batchId}::${courseId}`;
      if (byBatchCourseKey.has(rowKey)) continue;
      const enrollmentPriceInPaise = Math.max(0, Math.floor(Number((s as { enrollmentPriceInPaise?: number }).enrollmentPriceInPaise ?? 0)));
      const allowed =
        enrollmentPriceInPaise >= 100
          ? normalizeAllowedPaymentMethods((s as { allowedPaymentMethods?: unknown }).allowedPaymentMethods)
          : [];
      byBatchCourseKey.set(rowKey, {
        batchId,
        batchName: String((batch as { name?: string }).name ?? "").trim() || undefined,
        courseTitle: s?.title ?? "Course",
        description: s?.description,
        chapterCount: Array.isArray(s?.modules) ? s.modules.length : 0,
        moduleCount: Array.isArray(s?.modules) ? s.modules.length : 0,
        enrollmentPriceInPaise,
        paymentOptionsLabel: enrollmentPriceInPaise >= 100 ? formatPaymentMethodsLabel(allowed) : "—",
        courseHeaderImageUrl: String((s as { headerImageUrl?: string }).headerImageUrl ?? "").trim() || undefined,
        isDemo: !!(s as { isDemo?: boolean }).isDemo,
        durationText: String((s as { durationText?: string }).durationText ?? "").trim() || undefined,
        ageGroup: String((s as { ageGroup?: string }).ageGroup ?? "").trim() || undefined,
        certification: String((s as { certification?: string }).certification ?? "").trim() || undefined,
        paymentNote: String((s as { paymentNote?: string }).paymentNote ?? "").trim() || undefined,
        learningOutcomes: Array.isArray((s as { learningOutcomes?: string[] }).learningOutcomes) ? (s as { learningOutcomes: string[] }).learningOutcomes : [],
        overview: String((s as { overview?: string }).overview ?? "").trim() || undefined,
        pricingTiers: Array.isArray((s as { pricingTiers?: unknown[] }).pricingTiers) ? (s as { pricingTiers: unknown[] }).pricingTiers : [],
      });
    }
  }
  const catalog = await loadCourseHeaderImageMap(
    Array.from(byBatchCourseKey.entries()).map(([key]) => key.split("::")[1] ?? "")
  );
  return Array.from(byBatchCourseKey.entries()).map(([key, v]) => {
    const courseId = key.split("::")[1] ?? "";
    return {
      courseId,
      courseTitle: v.courseTitle,
      description: v.description,
      chapterCount: v.chapterCount,
      moduleCount: v.moduleCount,
      batchId: v.batchId,
      batchName: v.batchName,
      enrollmentPriceInPaise: v.enrollmentPriceInPaise,
      paymentOptionsLabel: v.paymentOptionsLabel,
      courseHeaderImageUrl: resolveCourseHeaderImageUrl(courseId, v.courseHeaderImageUrl, catalog),
      isDemo: v.isDemo,
      durationText: v.durationText,
      ageGroup: v.ageGroup,
      certification: v.certification,
      paymentNote: v.paymentNote,
      learningOutcomes: v.learningOutcomes,
      overview: v.overview,
      pricingTiers: v.pricingTiers,
    };
  });
}

export type ChapterPart = "content" | "video" | "youtube";
export type ModulePart = ChapterPart;

export async function markChapterPartComplete(
  studentId: string,
  batchId: string,
  chapterOrder: number,
  part: ChapterPart,
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
  if (chapterOrder < 0 || chapterOrder >= rawModules.length) throw new AppError("Chapter not found in batch", 404);

  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).exec();
  if (!enrollment) throw new AppError("You are not enrolled in this batch", 403);
  if ((enrollment as { accessBlocked?: boolean }).accessBlocked) {
    throw new AppError("Access to this course has been disabled", 403);
  }
  if (
    isCourseBlockedInEnrollment(
      enrollment,
      snapshotCourseId
    )
  ) {
    throw new AppError("Access to this course has been disabled", 403);
  }

  const mod = rawModules[chapterOrder] as ModuleSnapshot;
  const parts = moduleParts(mod);
  const field = part === "content" ? "contentCompletedAt" : part === "video" ? "videoCompletedAt" : "youtubeCompletedAt";
  const hasPart = part === "content" ? parts.hasContent : part === "video" ? parts.hasVideo : parts.hasYoutube;
  if (!hasPart) throw new AppError(`This chapter has no ${part} to complete`, 400);

  const filter = { studentId, batchId: batchMongoId, courseId: snapshotCourseId, moduleOrder: chapterOrder };
  const prevProgress = await ChapterProgressModel.findOne(filter).lean().exec();

  const now = new Date();
  const update = {
    $set: {
      studentId,
      batchId: batchMongoId,
      courseId: snapshotCourseId,
      moduleOrder: chapterOrder,
      [field]: now,
      completedBy: studentId,
      isManualOverride: false,
    },
  };
  let updated: unknown;
  try {
    updated = await ChapterProgressModel.findOneAndUpdate(filter, update, { upsert: true, new: true }).lean().exec();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const fallbackFilter = { studentId, batchId: batchMongoId, moduleOrder: chapterOrder };
      updated = await ChapterProgressModel.findOneAndUpdate(fallbackFilter, update, { new: true }).lean().exec();
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
    await ChapterProgressModel.updateOne(
      { studentId, batchId: batchMongoId, moduleOrder: chapterOrder },
      { $set: { completedAt: now } }
    ).exec();
    if (!(prevProgress as ProgressDoc | null)?.completedAt) {
      await awardChapterXp(studentId, xpAwardForModuleSnapshot(mod));
      await ensureFirstModuleCompletedBadge(studentId, batchMongoId, chapterOrder).catch(() => {});
    }
  }

  return {
    batchId: batchMongoId,
    courseId: snapshotCourseId,
    chapterOrder,
    moduleOrder: chapterOrder,
    part,
    completed: true,
    chapterCompleted: allDone,
    moduleCompleted: allDone,
  };
}

export async function markChapterComplete(studentId: string, batchId: string, chapterOrder: number, courseId?: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snapshot = (courseId ? snapshots.find((s) => (s as { courseId?: string }).courseId === courseId) : snapshots[0]) as { courseId?: string; modules?: unknown[] } | undefined;
  if (!snapshot) throw new AppError("Course not found in batch", 404);
  const snapshotCourseId = snapshot.courseId ?? batchMongoId;

  const modules = snapshot?.modules ?? [];
  if (chapterOrder < 0 || chapterOrder >= modules.length) throw new AppError("Chapter not found in batch", 404);

  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).exec();
  if (!enrollment) throw new AppError("You are not enrolled in this batch", 403);
  if ((enrollment as { accessBlocked?: boolean }).accessBlocked) {
    throw new AppError("Access to this course has been disabled", 403);
  }
  if (
    isCourseBlockedInEnrollment(
      enrollment,
      snapshotCourseId
    )
  ) {
    throw new AppError("Access to this course has been disabled", 403);
  }

  const before = await ChapterProgressModel.findOne({
    studentId,
    batchId: batchMongoId,
    courseId: snapshotCourseId,
    moduleOrder: chapterOrder,
  })
    .lean()
    .exec();

  const now = new Date();
  const filter = { studentId, batchId: batchMongoId, courseId: snapshotCourseId, moduleOrder: chapterOrder };
  const update = {
    $set: {
      studentId,
      batchId: batchMongoId,
      courseId: snapshotCourseId,
      moduleOrder: chapterOrder,
      completedAt: now,
      completedBy: studentId,
      isManualOverride: false,
    },
  };
  try {
    await ChapterProgressModel.findOneAndUpdate(filter, update, { upsert: true }).exec();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      await ChapterProgressModel.findOneAndUpdate(
        { studentId, batchId: batchMongoId, moduleOrder: chapterOrder },
        update
      ).exec();
    } else {
      throw err;
    }
  }

  const wasComplete = !!(before as ProgressDoc | null)?.completedAt;
  if (!wasComplete) {
    const modSnap = modules[chapterOrder] as ModuleSnapshot;
    await awardChapterXp(studentId, xpAwardForModuleSnapshot(modSnap));
    await ensureFirstModuleCompletedBadge(studentId, batchMongoId, chapterOrder).catch(() => {});
  }

  return { batchId: batchMongoId, courseId: snapshotCourseId, chapterOrder, moduleOrder: chapterOrder, completed: true };
}

export async function markModulePartComplete(
  studentId: string,
  batchId: string,
  moduleOrder: number,
  part: ModulePart,
  courseId?: string
) {
  return markChapterPartComplete(studentId, batchId, moduleOrder, part, courseId);
}

export async function markModuleComplete(studentId: string, batchId: string, moduleOrder: number, courseId?: string) {
  return markChapterComplete(studentId, batchId, moduleOrder, courseId);
}
