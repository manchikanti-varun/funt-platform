
import { BatchModel } from "../models/Batch.model.js";
import { CourseModel } from "../models/Course.model.js";
import { UserModel } from "../models/User.model.js";
import { BadgeTypeDefinitionModel } from "../models/BadgeTypeDefinition.model.js";
import { BATCH_STATUS, COURSE_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import { generateBatchId } from "../utils/funtIdGenerator.js";
import { resolveStaffUserId, resolveStaffUserIds } from "../utils/resolveStaffUserIds.js";
import type { CoursePaymentMethodCode } from "../utils/coursePaymentMethods.js";

const ENTITY_BATCH = "Batch";

const MONGO_OBJECT_ID_24 = /^[a-fA-F0-9]{24}$/;

type StaffDisplay = { name: string; username: string };
type StaffMap = Map<string, StaffDisplay>;

/** Resolve display names for batch trainer (and similar) from User documents. */
async function staffDisplayByMongoIds(ids: string[]): Promise<StaffMap> {
  const unique = [...new Set(ids.map((x) => String(x ?? "").trim()).filter((x) => MONGO_OBJECT_ID_24.test(x)))];
  const map: StaffMap = new Map();
  if (unique.length === 0) return map;
  const users = await UserModel.find({ _id: { $in: unique } }).select("name username").lean().exec();
  for (const u of users) {
    const id = String((u as { _id: unknown })._id);
    map.set(id, {
      name: (String((u as { name?: string }).name ?? "").trim() || "Unknown") as string,
      username: String((u as { username?: string }).username ?? "").trim(),
    });
  }
  return map;
}

const MAX_MANUAL_UPI_QR_URL_LEN = 500_000;

export function assertManualUpiQrUrl(raw: string): string {
  const t = raw.trim();
  if (!t) throw new AppError("UPI QR value is empty", 400);
  if (t.length > MAX_MANUAL_UPI_QR_URL_LEN) {
    throw new AppError("UPI QR image or URL is too large. Use a smaller image or host the file and paste an https URL.", 400);
  }
  const dataOk = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(t);
  const urlOk = /^https?:\/\//i.test(t);
  if (!dataOk && !urlOk) {
    throw new AppError("UPI QR must be an image (PNG, JPEG, GIF, or WebP as a data URL) or an http(s) URL to the QR image.", 400);
  }
  return t;
}

/** Admin sends INR (rupees); stored on snapshot as paise. */
function allowedPaymentMethodsForCourse(
  pricePaise: number,
  keys: { mongo: string; human: string },
  map: Record<string, { upiManual?: boolean; razorpay?: boolean }> | undefined
): CoursePaymentMethodCode[] {
  if (pricePaise < 100) return [];
  let upi = true;
  let raz = true;
  if (map && Object.keys(map).length > 0) {
    const f = map[keys.mongo] ?? map[keys.human];
    if (f) {
      upi = !!f.upiManual;
      raz = !!f.razorpay;
    }
  }
  if (!upi && !raz) {
    throw new AppError(
      "For each course with a list price of ₹1 or more, choose at least one payment method: manual UPI (QR) and/or Razorpay.",
      400
    );
  }
  const out: CoursePaymentMethodCode[] = [];
  if (upi) out.push("UPI_MANUAL");
  if (raz) out.push("RAZORPAY");
  return out;
}

function rupeesToPaiseFromInput(r: unknown): number {
  const n = Number(r);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(50_000_000, Math.round(n * 100));
}

function normalizeCompletionRewardCoins(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError("completionRewardCoins must be a non-negative integer", 400);
  }
  if (n > 1_000_000) throw new AppError("completionRewardCoins must be at most 1,000,000", 400);
  return n;
}

function normalizeCompletionBadgeTypes(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : (raw == null || raw === "" ? [] : [raw]);
  const out = arr
    .map((x) => String(x ?? "").trim().toUpperCase())
    .filter(Boolean)
    .map((x) => x.replace(/[^A-Z0-9_]/g, "_"))
    .slice(0, 20);
  return [...new Set(out)];
}

async function getAutoAwardableBadgeTypeSet(): Promise<Set<string>> {
  const rows = await BadgeTypeDefinitionModel.find({
    isActive: true,
    awardMode: { $in: ["AUTO", "BOTH"] },
  })
    .select("badgeType")
    .lean()
    .exec();
  return new Set(rows.map((r) => String((r as { badgeType?: string }).badgeType ?? "").trim().toUpperCase()).filter(Boolean));
}

function ensureAllowedCompletionBadges(
  values: Record<string, string | string[]> | undefined,
  allowed: Set<string>
): void {
  if (!values) return;
  for (const raw of Object.values(values)) {
    const list = normalizeCompletionBadgeTypes(raw);
    for (const bt of list) {
      if (!allowed.has(bt)) {
        throw new AppError(`completion badge "${bt}" must be active and configured as AUTO or BOTH`, 400);
      }
    }
  }
}

function assertCanEditBatch(userId: string, batch: { createdBy?: string | null; moderatorIds?: string[] | null; trainerId?: string | null }) {
  const createdBy = batch.createdBy ?? "";
  const mods = batch.moderatorIds ?? [];
  const trainerId = batch.trainerId ?? "";
  if (createdBy !== userId && !mods.includes(userId) && trainerId !== userId) {
    throw new AppError("Forbidden: only the creator, trainer, or a moderator can edit this batch", 403);
  }
}

function assertCanArchiveBatch(userId: string, batch: { createdBy?: string }) {
  if ((batch.createdBy ?? "") !== userId) {
    throw new AppError("Forbidden: only the creator can archive this batch", 403);
  }
}

export interface CreateBatchInput {
  name: string;
  courseIds: string[];
  trainerId: string;
  startDate: Date;
  endDate?: Date;
  zoomLink?: string;
  createdBy: string;
  moderatorIds?: string[];
  /** Keys: course Mongo id or course `courseId` string; values: INR (rupees) list price for enrollment. */
  courseEnrollmentPrices?: Record<string, number>;
  /** Per course (same keys as prices): which checkout methods students may use when list price ≥ ₹1. */
  coursePaymentMethods?: Record<string, { upiManual?: boolean; razorpay?: boolean }>;
  /** Optional batch-level UPI QR (data URL or https) for manual UPI checkout; overrides server env default. */
  manualUpiQrUrl?: string;
  /** Per course (keys: course Mongo id or human `courseId`): FUNT coins credited when a certificate is issued for that course in this batch. */
  courseCompletionRewardCoins?: Record<string, number>;
  /** Per course (keys: course Mongo id or human `courseId`): badge key(s) auto-awarded on completion certificate. */
  courseCompletionBadgeTypes?: Record<string, string | string[]>;
}

export interface UpdateBatchInput {
  name?: string;
  courseIds?: string[];
  trainerId?: string;
  startDate?: Date;
  endDate?: Date;
  zoomLink?: string;
  moderatorIds?: string[];
  courseEnrollmentPrices?: Record<string, number>;
  coursePaymentMethods?: Record<string, { upiManual?: boolean; razorpay?: boolean }>;
  /** Set to null to remove stored QR and fall back to server default (if any). */
  manualUpiQrUrl?: string | null;
  courseCompletionRewardCoins?: Record<string, number>;
  courseCompletionBadgeTypes?: Record<string, string | string[]>;
}

type BatchDoc = {
  _id: unknown;
  batchId?: string | null;
  name: string;
  courseSnapshot?: unknown;
  courseSnapshots?: unknown[] | null;
  trainerId: string;
  startDate: unknown;
  endDate?: unknown;
  zoomLink?: unknown;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string | null;
  moderatorIds?: string[] | null;
  certificatePriceCoins?: number;
  manualUpiQrUrl?: string | null;
};

export function getBatchCourseSnapshots(doc: BatchDoc): unknown[] {
  const snapshots = (doc as { courseSnapshots?: unknown[] }).courseSnapshots;
  if (Array.isArray(snapshots) && snapshots.length > 0) return snapshots;
  const single = (doc as { courseSnapshot?: unknown }).courseSnapshot;
  if (single) return [single];
  return [];
}

export async function getModuleAssignmentOverrides(
  batchId: string,
  courseId: string | undefined,
  moduleOrder: number
): Promise<{ title?: string; instructions?: string; submissionType?: string; skillTags?: string[] } | null> {
  const batch = await findBatchByParam(batchId);
  if (!batch) return null;
  const snapshots = getBatchCourseSnapshots(batch as unknown as BatchDoc);
  const modSchema = {} as { modules?: Array<{ linkedAssignmentTitleOverride?: string; linkedAssignmentInstructionsOverride?: string; linkedAssignmentSubmissionTypeOverride?: string; linkedAssignmentSkillTagsOverride?: string[] }> };
  const snapshot = courseId
    ? (snapshots.find((s) => (s as { courseId?: string }).courseId === courseId) as typeof modSchema)
    : (snapshots[0] as typeof modSchema);
  if (!snapshot?.modules || moduleOrder < 0 || moduleOrder >= snapshot.modules.length) return null;
  const mod = snapshot.modules[moduleOrder];
  return {
    title: mod?.linkedAssignmentTitleOverride?.trim() || undefined,
    instructions: mod?.linkedAssignmentInstructionsOverride ?? undefined,
    submissionType: mod?.linkedAssignmentSubmissionTypeOverride?.trim() || undefined,
    skillTags: Array.isArray(mod?.linkedAssignmentSkillTagsOverride) ? mod.linkedAssignmentSkillTagsOverride : undefined,
  };
}

function toBatchResponse(doc: BatchDoc, listView = false, staff?: StaffMap) {
  const courseSnapshots = getBatchCourseSnapshots(doc);
  const courseSnapshot = courseSnapshots[0] ?? null;
  const qr = (doc as { manualUpiQrUrl?: string | null }).manualUpiQrUrl?.trim();
  const tid = String(doc.trainerId ?? "").trim();
  const trainer = tid && staff?.get(tid);
  return {
    id: String(doc._id),
    batchId: doc.batchId ?? undefined,
    name: doc.name,
    courseSnapshots,
    courseSnapshot,
    trainerId: tid,
    ...(trainer ? { trainerName: trainer.name, trainerUsername: trainer.username } : {}),
    startDate: doc.startDate instanceof Date ? doc.startDate : new Date(doc.startDate as string | number),
    endDate: doc.endDate == null ? undefined : (doc.endDate instanceof Date ? doc.endDate : new Date(doc.endDate as string | number)),
    zoomLink: doc.zoomLink == null ? undefined : String(doc.zoomLink),
    status: doc.status,
    createdBy: doc.createdBy ?? undefined,
    moderatorIds: doc.moderatorIds ?? [],
    certificatePriceCoins: Math.max(0, Math.floor(Number((doc as { certificatePriceCoins?: number }).certificatePriceCoins ?? 0))),
    ...(listView || !qr ? {} : { manualUpiQrUrl: qr }),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function copyCourseToSnapshot(course: { _id: unknown; courseId?: string | null; title: string; description: string; durationText?: string; modules: unknown[]; version: number }) {
  return {
    courseId: course.courseId ?? String(course._id),
    title: course.title,
    description: course.description,
    durationText: course.durationText ?? "",
    modules: JSON.parse(JSON.stringify(course.modules)),
    version: course.version,
    enrollmentPriceInPaise: 0,
    completionRewardCoins: 0,
    completionBadgeTypes: [],
  };
}

export async function createBatch(input: CreateBatchInput) {
  if (!input.name?.trim()) throw new AppError("name is required", 400);
  if (!Array.isArray(input.courseIds) || input.courseIds.length === 0) throw new AppError("At least one courseId is required", 400);
  if (!input.trainerId) throw new AppError("trainerId is required", 400);
  if (!input.startDate) throw new AppError("startDate is required", 400);

  const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
  const byMongo = input.courseIds.filter((x) => OBJECT_ID_REGEX.test(String(x).trim()));
  const byHuman = input.courseIds.filter((x) => !OBJECT_ID_REGEX.test(String(x).trim()));
  const courses = await CourseModel.find({
    $or: [
      ...(byMongo.length ? [{ _id: { $in: byMongo } }] : []),
      ...(byHuman.length ? [{ courseId: { $in: byHuman } }] : []),
    ],
  }).lean().exec();
  const foundMongo = new Set(courses.map((c) => String(c._id)));
  const foundHuman = new Set(courses.map((c) => (c as { courseId?: string }).courseId).filter(Boolean));
  const missing = input.courseIds.filter((id) => !foundMongo.has(id) && !foundHuman.has(id));
  if (missing.length > 0) throw new AppError(`Course(s) not found: ${missing.join(", ")}`, 404);

  for (const course of courses) {
    if (course.status === COURSE_STATUS.ARCHIVED) {
      throw new AppError("Cannot create batch from an archived course", 400);
    }
    if (!course.modules || course.modules.length === 0) {
      throw new AppError(`Course "${(course as { title?: string }).title ?? course._id}" has no modules`, 400);
    }
  }

  const orderByInput = new Map(input.courseIds.map((id, i) => [id, i]));
  const getOrder = (c: { _id: unknown; courseId?: string }) =>
    orderByInput.get(String(c._id)) ?? orderByInput.get((c as { courseId?: string }).courseId ?? "") ?? 0;
  const priceMap = input.courseEnrollmentPrices ?? {};
  const rewardMap = input.courseCompletionRewardCoins ?? {};
  const badgeMap = input.courseCompletionBadgeTypes ?? {};
  const allowedBadges = await getAutoAwardableBadgeTypeSet();
  ensureAllowedCompletionBadges(input.courseCompletionBadgeTypes, allowedBadges);
  const courseSnapshots = courses
    .sort((a, b) => getOrder(a as { _id: unknown; courseId?: string }) - getOrder(b as { _id: unknown; courseId?: string }))
    .map((c) => {
      const snap = copyCourseToSnapshot(c as Parameters<typeof copyCourseToSnapshot>[0]);
      const mongo = String((c as { _id: unknown })._id);
      const human = (c as { courseId?: string }).courseId ?? "";
      const rupee = priceMap[mongo] ?? priceMap[human] ?? 0;
      const enrollmentPriceInPaise = rupeesToPaiseFromInput(rupee);
      const allowedPaymentMethods = allowedPaymentMethodsForCourse(
        enrollmentPriceInPaise,
        { mongo, human },
        input.coursePaymentMethods
      );
      const completionRewardCoins = normalizeCompletionRewardCoins(rewardMap[mongo] ?? rewardMap[human] ?? 0);
      const completionBadgeTypes = normalizeCompletionBadgeTypes(badgeMap[mongo] ?? badgeMap[human] ?? []);
      return { ...snap, enrollmentPriceInPaise, allowedPaymentMethods, completionRewardCoins, completionBadgeTypes };
    });

  const batchId = await generateBatchId();

  const trainerId = await resolveStaffUserId(input.trainerId);
  const moderatorIds =
    Array.isArray(input.moderatorIds) && input.moderatorIds.length > 0
      ? await resolveStaffUserIds(input.moderatorIds)
      : [];

  const manualUpiQrUrl =
    input.manualUpiQrUrl != null && String(input.manualUpiQrUrl).trim()
      ? assertManualUpiQrUrl(String(input.manualUpiQrUrl))
      : undefined;

  const doc = await BatchModel.create({
    batchId,
    name: input.name.trim(),
    courseSnapshots,
    trainerId,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    zoomLink: input.zoomLink?.trim() || undefined,
    status: BATCH_STATUS.ACTIVE,
    createdBy: input.createdBy,
    moderatorIds,
    certificatePriceCoins: 0,
    ...(manualUpiQrUrl ? { manualUpiQrUrl } : {}),
  });

  await createAuditLog("BATCH_CREATED", input.createdBy, ENTITY_BATCH, String(doc._id));
  const staff = await staffDisplayByMongoIds([String(doc.trainerId)]);
  return toBatchResponse(doc as unknown as BatchDoc, false, staff);
}

export async function listBatches(filters?: { status?: string; trainerId?: string; search?: string; assignedToUserId?: string }) {
  const main: Record<string, unknown> = {};
  if (filters?.status) main.status = filters.status;
  if (filters?.assignedToUserId) {
    main.$or = [
      { trainerId: filters.assignedToUserId },
      { moderatorIds: filters.assignedToUserId },
    ];
  } else if (filters?.trainerId) {
    main.trainerId = filters.trainerId;
  }
  let query: Record<string, unknown> = main;
  if (filters?.search?.trim()) {
    const term = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query = {
      $and: [
        main,
        { $or: [ { name: { $regex: term, $options: "i" } }, { batchId: { $regex: term, $options: "i" } } ] },
      ],
    };
  }
  const list = await BatchModel.find(query).sort({ createdAt: -1 }).lean().exec();
  const staff = await staffDisplayByMongoIds(list.map((d) => String((d as BatchDoc).trainerId ?? "")));
  return list.map((d) => toBatchResponse(d as unknown as Parameters<typeof toBatchResponse>[0], true, staff));
}

export async function listAllBatchesForExplore() {
  const list = await BatchModel.find({}).sort({ createdAt: -1 }).lean().exec();
  const staff = await staffDisplayByMongoIds(list.map((d) => String((d as BatchDoc).trainerId ?? "")));
  return list.map((d) => toBatchResponse(d as unknown as Parameters<typeof toBatchResponse>[0], true, staff));
}

const BATCH_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
export async function findBatchByParam(id: string) {
  if (!id?.trim()) return null;
  const t = id.trim();
  if (BATCH_OBJECT_ID_REGEX.test(t)) return BatchModel.findById(t).lean().exec();
  return BatchModel.findOne({ batchId: t }).lean().exec();
}

export async function getBatchById(id: string) {
  const doc = await findBatchByParam(id);
  if (!doc) throw new AppError("Batch not found", 404);
  const staff = await staffDisplayByMongoIds([String((doc as BatchDoc).trainerId ?? "")]);
  return toBatchResponse(doc as unknown as Parameters<typeof toBatchResponse>[0], false, staff);
}

export async function updateBatch(id: string, input: UpdateBatchInput, performedBy: string) {
  const allowedBadges =
    input.courseCompletionBadgeTypes !== undefined ? await getAutoAwardableBadgeTypeSet() : undefined;
  if (allowedBadges) ensureAllowedCompletionBadges(input.courseCompletionBadgeTypes, allowedBadges);
  const existing = await findBatchByParam(id);
  if (!existing) throw new AppError("Batch not found", 404);
  const doc = await BatchModel.findById(existing._id).exec();
  if (!doc) throw new AppError("Batch not found", 404);
  assertCanEditBatch(performedBy, doc as { createdBy?: string; moderatorIds?: string[] });
  const hadTrainer = doc.trainerId;
  if (input.name !== undefined) doc.name = input.name.trim();
  if (input.trainerId !== undefined) doc.trainerId = await resolveStaffUserId(input.trainerId);
  if (input.startDate !== undefined) doc.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) doc.endDate = input.endDate ? new Date(input.endDate) : undefined;
  if (input.zoomLink !== undefined) doc.zoomLink = input.zoomLink?.trim() || undefined;
  if (input.moderatorIds !== undefined) {
    (doc as { moderatorIds?: string[] }).moderatorIds = Array.isArray(input.moderatorIds)
      ? await resolveStaffUserIds(input.moderatorIds)
      : [];
  }
  if (input.manualUpiQrUrl !== undefined) {
    if (input.manualUpiQrUrl === null || input.manualUpiQrUrl === "") {
      (doc as { manualUpiQrUrl?: string }).manualUpiQrUrl = "";
    } else {
      (doc as { manualUpiQrUrl?: string }).manualUpiQrUrl = assertManualUpiQrUrl(String(input.manualUpiQrUrl));
    }
  }
  if (
    (input.courseEnrollmentPrices !== undefined ||
      input.coursePaymentMethods !== undefined ||
      input.courseCompletionRewardCoins !== undefined ||
      input.courseCompletionBadgeTypes !== undefined) &&
    input.courseIds === undefined
  ) {
    const snaps = JSON.parse(JSON.stringify(getBatchCourseSnapshots(doc as unknown as BatchDoc))) as Array<{
      courseId?: string;
      enrollmentPriceInPaise?: number;
      allowedPaymentMethods?: CoursePaymentMethodCode[];
      completionRewardCoins?: number;
      completionBadgeTypes?: string[];
    }>;
    const priceMap = input.courseEnrollmentPrices ?? {};
    const rewardMap = input.courseCompletionRewardCoins ?? {};
    const badgeMap = input.courseCompletionBadgeTypes ?? {};
    const pm = input.coursePaymentMethods;
    for (const s of snaps) {
      const cid = String(s.courseId ?? "");
      if (!cid) continue;
      const raw = priceMap[cid];
      if (raw !== undefined && raw !== null && Number.isFinite(Number(raw))) {
        s.enrollmentPriceInPaise = rupeesToPaiseFromInput(raw);
      }
      const paise = Math.max(0, Math.floor(Number(s.enrollmentPriceInPaise ?? 0)));
      if (pm !== undefined) {
        const mongo = cid;
        const human = cid;
        s.allowedPaymentMethods = allowedPaymentMethodsForCourse(paise, { mongo, human }, pm);
      } else if (input.courseEnrollmentPrices !== undefined && paise < 100) {
        s.allowedPaymentMethods = [];
      }
      if (input.courseCompletionRewardCoins !== undefined) {
        const r = rewardMap[cid];
        if (r !== undefined && r !== null && Number.isFinite(Number(r))) {
          s.completionRewardCoins = normalizeCompletionRewardCoins(r);
        }
      }
      if (input.courseCompletionBadgeTypes !== undefined) {
        const b = badgeMap[cid];
        if (b !== undefined) s.completionBadgeTypes = normalizeCompletionBadgeTypes(b);
      }
    }
    (doc as { courseSnapshots?: unknown[] }).courseSnapshots = snaps;
  }
  if (input.courseIds !== undefined) {
    if (!Array.isArray(input.courseIds) || input.courseIds.length === 0) throw new AppError("At least one courseId is required", 400);
    const byMongo = input.courseIds.filter((x) => BATCH_OBJECT_ID_REGEX.test(String(x).trim()));
    const byHuman = input.courseIds.filter((x) => !BATCH_OBJECT_ID_REGEX.test(String(x).trim()));
    const courses = await CourseModel.find({
      $or: [
        ...(byMongo.length ? [{ _id: { $in: byMongo } }] : []),
        ...(byHuman.length ? [{ courseId: { $in: byHuman } }] : []),
      ],
    }).lean().exec();
    const foundMongo = new Set(courses.map((c) => String(c._id)));
    const foundHuman = new Set(courses.map((c) => (c as { courseId?: string }).courseId).filter(Boolean));
    const missing = input.courseIds.filter((id) => !foundMongo.has(id) && !foundHuman.has(id));
    if (missing.length > 0) throw new AppError(`Course(s) not found: ${missing.join(", ")}`, 404);
    for (const course of courses) {
      if (course.status === COURSE_STATUS.ARCHIVED) throw new AppError("Cannot assign an archived course to a batch", 400);
      if (!course.modules || course.modules.length === 0) throw new AppError("A course has no modules", 400);
    }
    const orderByInput = new Map(input.courseIds.map((cid, i) => [cid, i]));
    const getOrder = (c: { _id: unknown; courseId?: string }) =>
      orderByInput.get(String(c._id)) ?? orderByInput.get((c as { courseId?: string }).courseId ?? "") ?? 0;
    const priceMap = input.courseEnrollmentPrices ?? {};
    const rewardMap = input.courseCompletionRewardCoins ?? {};
    const badgeMap = input.courseCompletionBadgeTypes ?? {};
    const oldSnaps = getBatchCourseSnapshots(doc as unknown as BatchDoc) as Array<{
      courseId?: string;
      enrollmentPriceInPaise?: number;
      allowedPaymentMethods?: CoursePaymentMethodCode[];
      completionRewardCoins?: number;
      completionBadgeTypes?: string[];
    }>;
    const oldPaiseByCourseId = new Map(
      oldSnaps.map((s) => [String(s.courseId ?? ""), Math.max(0, Math.floor(Number(s.enrollmentPriceInPaise ?? 0)))])
    );
    const oldMethodsByCourseId = new Map(
      oldSnaps.map((s) => [String(s.courseId ?? ""), s.allowedPaymentMethods])
    );
    const oldRewardByCourseId = new Map(
      oldSnaps.map((s) => [String(s.courseId ?? ""), Math.max(0, Math.floor(Number(s.completionRewardCoins ?? 0)))])
    );
    const oldBadgesByCourseId = new Map(
      oldSnaps.map((s) => [String(s.courseId ?? ""), normalizeCompletionBadgeTypes(s.completionBadgeTypes ?? [])])
    );
    const pm = input.coursePaymentMethods;
    const courseSnapshots = courses
      .sort((a, b) => getOrder(a as { _id: unknown; courseId?: string }) - getOrder(b as { _id: unknown; courseId?: string }))
      .map((c) => {
        const snap = copyCourseToSnapshot(c as Parameters<typeof copyCourseToSnapshot>[0]);
        const mongo = String((c as { _id: unknown })._id);
        const human = (c as { courseId?: string }).courseId ?? "";
        const rupeeInput = priceMap[mongo] ?? priceMap[human];
        const paise =
          rupeeInput !== undefined && rupeeInput !== null && Number.isFinite(Number(rupeeInput))
            ? rupeesToPaiseFromInput(rupeeInput)
            : oldPaiseByCourseId.get(String(snap.courseId)) ?? 0;
        const prevMethods = oldMethodsByCourseId.get(String(snap.courseId));
        let allowedPaymentMethods: CoursePaymentMethodCode[];
        if (pm !== undefined) {
          allowedPaymentMethods = allowedPaymentMethodsForCourse(paise, { mongo, human }, pm);
        } else if (paise < 100) {
          allowedPaymentMethods = [];
        } else if (Array.isArray(prevMethods) && prevMethods.length > 0) {
          const kept = (prevMethods as string[]).filter((x) => x === "UPI_MANUAL" || x === "RAZORPAY") as CoursePaymentMethodCode[];
          allowedPaymentMethods =
            kept.length > 0 ? ([...new Set(kept)] as CoursePaymentMethodCode[]) : allowedPaymentMethodsForCourse(paise, { mongo, human }, undefined);
        } else {
          allowedPaymentMethods = allowedPaymentMethodsForCourse(paise, { mongo, human }, undefined);
        }
        const rewardInput = rewardMap[mongo] ?? rewardMap[human];
        const completionRewardCoins =
          rewardInput !== undefined && rewardInput !== null && Number.isFinite(Number(rewardInput))
            ? normalizeCompletionRewardCoins(rewardInput)
            : normalizeCompletionRewardCoins(oldRewardByCourseId.get(String(snap.courseId)) ?? 0);
        const badgeInput = badgeMap[mongo] ?? badgeMap[human];
        const completionBadgeTypes =
          badgeInput !== undefined
            ? normalizeCompletionBadgeTypes(badgeInput)
            : normalizeCompletionBadgeTypes(oldBadgesByCourseId.get(String(snap.courseId)) ?? []);
        return { ...snap, enrollmentPriceInPaise: paise, allowedPaymentMethods, completionRewardCoins, completionBadgeTypes };
      });
    (doc as { courseSnapshots?: unknown[] }).courseSnapshots = courseSnapshots;
  }
  await doc.save();
  await createAuditLog("BATCH_UPDATED", performedBy, ENTITY_BATCH, String(doc._id));
  if (input.trainerId !== undefined && input.trainerId !== hadTrainer) {
    await createAuditLog("TRAINER_ASSIGNED", performedBy, ENTITY_BATCH, String(doc._id));
  }
  const staff = await staffDisplayByMongoIds([String(doc.trainerId)]);
  return toBatchResponse(doc as unknown as BatchDoc, false, staff);
}

export interface DuplicateBatchInput {
  name?: string;
  trainerId?: string;
  performedBy: string;
}

export async function duplicateBatch(sourceId: string, input: DuplicateBatchInput) {
  const source = await findBatchByParam(sourceId);
  if (!source) throw new AppError("Batch not found", 404);
  const src = source as BatchDoc;
  assertCanEditBatch(input.performedBy, src);
  const courseSnapshots = JSON.parse(JSON.stringify(getBatchCourseSnapshots(src)));
  if (courseSnapshots.length === 0) throw new AppError("Batch has no courses to duplicate", 400);
  const batchId = await generateBatchId();
  const sourceDoc = source as { createdBy?: string };
  const trainerId =
    input.trainerId !== undefined ? await resolveStaffUserId(input.trainerId) : source.trainerId;
  const dupQr = (source as { manualUpiQrUrl?: string }).manualUpiQrUrl?.trim();
  const doc = await BatchModel.create({
    batchId,
    name: input.name?.trim() ?? `${source.name} (Copy)`,
    courseSnapshots,
    trainerId,
    startDate: source.startDate,
    endDate: source.endDate,
    zoomLink: source.zoomLink,
    status: BATCH_STATUS.ACTIVE,
    createdBy: input.performedBy ?? sourceDoc.createdBy,
    certificatePriceCoins: Math.max(0, Math.floor(Number((src as { certificatePriceCoins?: number }).certificatePriceCoins ?? 0))),
    ...(dupQr ? { manualUpiQrUrl: dupQr } : {}),
  });
  await createAuditLog("BATCH_DUPLICATED", input.performedBy, ENTITY_BATCH, String(doc._id));
  const staff = await staffDisplayByMongoIds([String(doc.trainerId)]);
  return toBatchResponse(doc as unknown as BatchDoc, false, staff);
}

export async function archiveBatch(id: string, performedBy: string) {
  const existing = await findBatchByParam(id);
  if (!existing) throw new AppError("Batch not found", 404);
  assertCanArchiveBatch(performedBy, existing as { createdBy?: string });
  const doc = await BatchModel.findByIdAndUpdate(
    existing._id,
    { status: BATCH_STATUS.ARCHIVED },
    { new: true }
  ).exec();
  if (!doc) throw new AppError("Batch not found", 404);
  await createAuditLog("BATCH_ARCHIVED", performedBy, ENTITY_BATCH, String(doc._id));
  const staff = await staffDisplayByMongoIds([String((doc as BatchDoc).trainerId ?? "")]);
  return toBatchResponse(doc as unknown as BatchDoc, false, staff);
}
