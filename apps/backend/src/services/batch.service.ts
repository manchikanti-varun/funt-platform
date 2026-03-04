/**
 * Batch service – snapshot-based. Batch holds full courseSnapshot copy.
 */

import { BatchModel } from "../models/Batch.model.js";
import { CourseModel } from "../models/Course.model.js";
import { BATCH_STATUS, COURSE_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import { generateBatchId } from "../utils/funtIdGenerator.js";

const ENTITY_BATCH = "Batch";

/** Creator, assigned trainer, or moderator can edit/duplicate; only creator can archive. */
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
}

export interface UpdateBatchInput {
  name?: string;
  courseIds?: string[];
  trainerId?: string;
  startDate?: Date;
  endDate?: Date;
  zoomLink?: string;
  moderatorIds?: string[];
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
};

/** Normalize to array: use courseSnapshots if present, else [courseSnapshot] for legacy. */
export function getBatchCourseSnapshots(doc: BatchDoc): unknown[] {
  const snapshots = (doc as { courseSnapshots?: unknown[] }).courseSnapshots;
  if (Array.isArray(snapshots) && snapshots.length > 0) return snapshots;
  const single = (doc as { courseSnapshot?: unknown }).courseSnapshot;
  if (single) return [single];
  return [];
}

/** Get assignment overrides for a module in a batch (from course copy). */
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

function toBatchResponse(doc: BatchDoc) {
  const courseSnapshots = getBatchCourseSnapshots(doc);
  const courseSnapshot = courseSnapshots[0] ?? null;
  return {
    id: String(doc._id),
    batchId: doc.batchId ?? undefined,
    name: doc.name,
    courseSnapshots,
    courseSnapshot,
    trainerId: doc.trainerId,
    startDate: doc.startDate instanceof Date ? doc.startDate : new Date(doc.startDate as string | number),
    endDate: doc.endDate == null ? undefined : (doc.endDate instanceof Date ? doc.endDate : new Date(doc.endDate as string | number)),
    zoomLink: doc.zoomLink == null ? undefined : String(doc.zoomLink),
    status: doc.status,
    createdBy: doc.createdBy ?? undefined,
    moderatorIds: doc.moderatorIds ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function copyCourseToSnapshot(course: { _id: unknown; courseId?: string | null; title: string; description: string; modules: unknown[]; version: number }) {
  return {
    courseId: course.courseId ?? String(course._id),
    title: course.title,
    description: course.description,
    modules: JSON.parse(JSON.stringify(course.modules)),
    version: course.version,
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
  const courseSnapshots = courses
    .sort((a, b) => getOrder(a as { _id: unknown; courseId?: string }) - getOrder(b as { _id: unknown; courseId?: string }))
    .map((c) => copyCourseToSnapshot(c as Parameters<typeof copyCourseToSnapshot>[0]));

  const batchId = await generateBatchId();

  const doc = await BatchModel.create({
    batchId,
    name: input.name.trim(),
    courseSnapshots,
    trainerId: input.trainerId,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    zoomLink: input.zoomLink?.trim() || undefined,
    status: BATCH_STATUS.ACTIVE,
    createdBy: input.createdBy,
    moderatorIds: Array.isArray(input.moderatorIds) ? input.moderatorIds : [],
  });

  await createAuditLog("BATCH_CREATED", input.createdBy, ENTITY_BATCH, String(doc._id));
  return toBatchResponse(doc as unknown as BatchDoc);
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
  return list.map((d) => toBatchResponse(d as unknown as Parameters<typeof toBatchResponse>[0]));
}

/** All batches for student explore – no status or access filter; includes batches student is not enrolled in. */
export async function listAllBatchesForExplore() {
  const list = await BatchModel.find({}).sort({ createdAt: -1 }).lean().exec();
  return list.map((d) => toBatchResponse(d as unknown as Parameters<typeof toBatchResponse>[0]));
}

const BATCH_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
/** Resolve batch by MongoDB _id or human batchId (e.g. BT-26-00001). */
export async function findBatchByParam(id: string) {
  if (!id?.trim()) return null;
  const t = id.trim();
  if (BATCH_OBJECT_ID_REGEX.test(t)) return BatchModel.findById(t).lean().exec();
  return BatchModel.findOne({ batchId: t }).lean().exec();
}

export async function getBatchById(id: string) {
  const doc = await findBatchByParam(id);
  if (!doc) throw new AppError("Batch not found", 404);
  return toBatchResponse(doc as unknown as Parameters<typeof toBatchResponse>[0]);
}

export async function updateBatch(id: string, input: UpdateBatchInput, performedBy: string) {
  const existing = await findBatchByParam(id);
  if (!existing) throw new AppError("Batch not found", 404);
  const doc = await BatchModel.findById(existing._id).exec();
  if (!doc) throw new AppError("Batch not found", 404);
  assertCanEditBatch(performedBy, doc as { createdBy?: string; moderatorIds?: string[] });
  const hadTrainer = doc.trainerId;
  if (input.name !== undefined) doc.name = input.name.trim();
  if (input.trainerId !== undefined) doc.trainerId = input.trainerId;
  if (input.startDate !== undefined) doc.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) doc.endDate = input.endDate ? new Date(input.endDate) : undefined;
  if (input.zoomLink !== undefined) doc.zoomLink = input.zoomLink?.trim() || undefined;
  if (input.moderatorIds !== undefined) (doc as { moderatorIds?: string[] }).moderatorIds = Array.isArray(input.moderatorIds) ? input.moderatorIds : [];
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
    const courseSnapshots = courses
      .sort((a, b) => getOrder(a as { _id: unknown; courseId?: string }) - getOrder(b as { _id: unknown; courseId?: string }))
      .map((c) => copyCourseToSnapshot(c as Parameters<typeof copyCourseToSnapshot>[0]));
    (doc as { courseSnapshots?: unknown[] }).courseSnapshots = courseSnapshots;
  }
  await doc.save();
  await createAuditLog("BATCH_UPDATED", performedBy, ENTITY_BATCH, String(doc._id));
  if (input.trainerId !== undefined && input.trainerId !== hadTrainer) {
    await createAuditLog("TRAINER_ASSIGNED", performedBy, ENTITY_BATCH, String(doc._id));
  }
  return toBatchResponse(doc as unknown as BatchDoc);
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
  const doc = await BatchModel.create({
    batchId,
    name: input.name?.trim() ?? `${source.name} (Copy)`,
    courseSnapshots,
    trainerId: input.trainerId ?? source.trainerId,
    startDate: source.startDate,
    endDate: source.endDate,
    zoomLink: source.zoomLink,
    status: BATCH_STATUS.ACTIVE,
    createdBy: input.performedBy ?? sourceDoc.createdBy,
  });
  await createAuditLog("BATCH_DUPLICATED", input.performedBy, ENTITY_BATCH, String(doc._id));
  return toBatchResponse(doc as unknown as BatchDoc);
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
  return toBatchResponse(doc as unknown as BatchDoc);
}
