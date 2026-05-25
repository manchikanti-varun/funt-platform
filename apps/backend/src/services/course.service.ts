
import { CourseModel } from "../models/Course.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { GlobalModuleModel } from "../models/GlobalModule.model.js";
import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { COURSE_STATUS, MODULE_STATUS, SUBMISSION_TYPE, SKILL_TAG } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import { generateCourseId } from "../utils/funtIdGenerator.js";
import { resolveStaffUserIds } from "../utils/resolveStaffUserIds.js";
import { assertHeaderImageUrl } from "../utils/headerImageUrl.js";
import { getBatchCourseSnapshots } from "./batch.service.js";

const ENTITY_COURSE = "Course";
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function decodeEncodedRichText(input: string | undefined | null): string {
  let out = (input ?? "").replace(/&nbsp;/gi, " ").replace(/\u00a0/g, " ");
  // Keep literal tag examples visible; decode < > only for fully escaped HTML payloads.
  for (let i = 0; i < 2; i += 1) {
    const next = out
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, "&");
    if (next === out) break;
    out = next;
  }
  const hasRealHtml = /<[a-z][\s\S]*>/i.test(out);
  const looksLikeEscapedHtml = /&lt;\s*(?:p|h[1-6]|ul|ol|li|blockquote|pre|code|a|img|hr|div|span|strong|em|u|s|br)\b/i.test(out);
  if (!hasRealHtml && looksLikeEscapedHtml) {
    for (let i = 0; i < 2; i += 1) {
      const next = out
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, "&");
      if (next === out) break;
      out = next;
    }
  }
  out = out.replace(/\bclassName=/gi, "class=");
  out = out.replace(
    /^\s*<div\b[^>]*\bclass=(["'])[^"']*\b(?:ql-editor|rte-prosemirror)\b[^"']*\1[^>]*>([\s\S]*?)<\/div>\s*$/i,
    "$2"
  );
  return out;
}

export async function findCourseByParam(id: string) {
  if (!id?.trim()) return null;
  const t = id.trim();
  if (OBJECT_ID_REGEX.test(t)) return CourseModel.findById(t).exec();
  return CourseModel.findOne({ courseId: t }).exec();
}

async function assertCanEditCourseAsync(
  userId: string,
  course: { _id: unknown; createdBy: string; moderatorIds?: string[] | null }
): Promise<void> {
  const mods = course.moderatorIds ?? [];
  if (course.createdBy === userId || mods.includes(userId)) return;
  const mongoId = String(course._id);
  const humanId = (course as { courseId?: string }).courseId;
  const courseIds = [mongoId, ...(humanId ? [humanId] : [])];
  const batches = await BatchModel.find({
    $or: [
      { "courseSnapshots.courseId": { $in: courseIds } },
      { "courseSnapshot.courseId": { $in: courseIds } },
    ],
  })
    .select("createdBy moderatorIds")
    .lean()
    .exec();
  for (const b of batches) {
    const createdBy = (b as { createdBy?: string }).createdBy ?? "";
    const moderatorIds = (b as { moderatorIds?: string[] }).moderatorIds ?? [];
    if (createdBy === userId || moderatorIds.includes(userId)) return;
  }
  throw new AppError("Forbidden: only the creator, a course moderator, or a batch moderator can edit this course", 403);
}

function assertCanArchiveCourse(userId: string, course: { createdBy: string }) {
  if (course.createdBy !== userId) {
    throw new AppError("Forbidden: only the creator can archive this course", 403);
  }
}

export interface CreateCourseInput {
  title: string;
  description: string;
  durationText?: string;
  headerImageUrl?: string;
  isDemo?: boolean;
  globalChapterIds: string[];
  createdBy: string;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  durationText?: string;
  headerImageUrl?: string | null;
  isDemo?: boolean;
  moderatorIds?: string[];
}

export interface UpdateCourseModuleInput {
  title?: string;
  description?: string;
  content?: string;
  youtubeUrl?: string;
  videoUrl?: string;
    resourceLinkUrl?: string;
  linkedAssignmentId?: string;
    linkedAssignmentTitleOverride?: string;
    linkedAssignmentInstructionsOverride?: string;
    linkedAssignmentSubmissionTypeOverride?: string;
    linkedAssignmentSkillTagsOverride?: string[];
  /** XP awarded when a student fully completes this module (captured on new batches from this snapshot). */
  xpReward?: number;
}

function toCourseResponse(doc: {
  _id: unknown;
  courseId?: string | null;
  title: string;
  description: string;
  durationText?: string;
  headerImageUrl?: string;
  isDemo?: boolean;
  modules: unknown[];
  version: number;
  status: string;
  createdBy: string;
  moderatorIds?: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const headerImage = String(doc.headerImageUrl ?? "").trim() || undefined;
  return {
    id: String(doc._id),
    courseId: doc.courseId ?? undefined,
    title: doc.title,
    description: doc.description,
    durationText: doc.durationText ?? "",
    ...(headerImage ? { headerImageUrl: headerImage } : {}),
    ...((doc as { isDemo?: boolean }).isDemo ? { isDemo: true } : {}),
    modules: doc.modules,
    version: doc.version,
    status: doc.status,
    createdBy: doc.createdBy,
    moderatorIds: doc.moderatorIds ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function syncCourseIsDemoToBatchSnapshots(courseIds: string[], isDemo: boolean, performedBy: string) {
  if (!courseIds.length) return;
  const idSet = new Set(courseIds);
  const batches = await BatchModel.find({
    $or: [
      { "courseSnapshots.courseId": { $in: courseIds } },
      { "courseSnapshot.courseId": { $in: courseIds } },
    ],
  }).exec();
  const { syncAllStudentsToDemoBatch } = await import("./demoEnrollment.service.js");
  for (const batch of batches) {
    const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    let dirty = false;
    for (const snap of snapshots) {
      const cid = String((snap as { courseId?: string }).courseId ?? "").trim();
      if (!cid || !idSet.has(cid)) continue;
      if (!!(snap as { isDemo?: boolean }).isDemo !== isDemo) {
        (snap as { isDemo?: boolean }).isDemo = isDemo;
        dirty = true;
      }
      if (isDemo) {
        (snap as { enrollmentPriceInPaise?: number }).enrollmentPriceInPaise = 0;
        (snap as { allowedPaymentMethods?: unknown }).allowedPaymentMethods = [];
        dirty = true;
      }
    }
    if (!dirty) continue;
    if (snapshots.length === 1) {
      (batch as { courseSnapshot?: unknown; courseSnapshots?: unknown[] }).courseSnapshot = snapshots[0];
      (batch as { courseSnapshots?: unknown[] }).courseSnapshots = undefined;
    } else {
      (batch as { courseSnapshots?: unknown[] }).courseSnapshots = snapshots;
      (batch as { courseSnapshot?: unknown }).courseSnapshot = undefined;
    }
    await batch.save();
    if (isDemo) {
      await syncAllStudentsToDemoBatch(String(batch._id), performedBy);
    }
  }
}

async function syncCourseHeaderImageToBatchSnapshots(courseIds: string[], headerImageUrl: string | undefined) {
  if (!courseIds.length) return;
  const idSet = new Set(courseIds);
  const batches = await BatchModel.find({
    $or: [
      { "courseSnapshots.courseId": { $in: courseIds } },
      { "courseSnapshot.courseId": { $in: courseIds } },
    ],
  }).exec();
  for (const batch of batches) {
    const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    let dirty = false;
    for (const snap of snapshots) {
      const cid = String((snap as { courseId?: string }).courseId ?? "").trim();
      if (!cid || !idSet.has(cid)) continue;
      const next = headerImageUrl ?? "";
      const prev = String((snap as { headerImageUrl?: string }).headerImageUrl ?? "").trim();
      if (prev !== next) {
        (snap as { headerImageUrl?: string }).headerImageUrl = next || undefined;
        dirty = true;
      }
    }
    if (!dirty) continue;
    if (snapshots.length === 1) {
      (batch as { courseSnapshot?: unknown; courseSnapshots?: unknown[] }).courseSnapshot = snapshots[0];
      (batch as { courseSnapshots?: unknown[] }).courseSnapshots = undefined;
    } else {
      (batch as { courseSnapshots?: unknown[] }).courseSnapshots = snapshots;
      (batch as { courseSnapshot?: unknown }).courseSnapshot = undefined;
    }
    await batch.save();
  }
}

export async function createCourse(input: CreateCourseInput) {
  if (!input.title?.trim()) throw new AppError("title is required", 400);
  if (!input.description?.trim()) throw new AppError("description is required", 400);
  if (!Array.isArray(input.globalChapterIds) || input.globalChapterIds.length === 0) {
    throw new AppError("At least one global chapter is required", 400);
  }

  const ids = input.globalChapterIds.map((x) => x.trim()).filter(Boolean);
  const byObjectId = ids.filter((x) => OBJECT_ID_REGEX.test(x));
  const byModuleId = ids.filter((x) => !OBJECT_ID_REGEX.test(x));
  const globalModules = await GlobalModuleModel.find({
    $or: [
      ...(byObjectId.length ? [{ _id: { $in: byObjectId } }] : []),
      ...(byModuleId.length ? [{ moduleId: { $in: byModuleId } }] : []),
    ],
  }).exec();

  const foundByMongo = new Set(globalModules.map((m) => String(m._id)));
  const foundByHuman = new Set(globalModules.map((m) => (m as { moduleId?: string }).moduleId).filter(Boolean));
  const missing = ids.filter((id) => !foundByMongo.has(id) && !foundByHuman.has(id));
  if (missing.length > 0) throw new AppError(`Global chapter(s) not found: ${missing.join(", ")}`, 400);

  const archived = globalModules.filter((m) => m.status === MODULE_STATUS.ARCHIVED);
  if (archived.length > 0) throw new AppError("Cannot add archived global chapters to a course", 400);

  const orderByInput = new Map(ids.map((id, i) => [id, i]));
  const getModuleOrder = (m: { _id: unknown; moduleId?: string }) =>
    orderByInput.get(String(m._id)) ?? orderByInput.get((m as { moduleId?: string }).moduleId ?? "") ?? 0;

  const assignmentIds = [...new Set(globalModules.map((m) => m.linkedAssignmentId).filter(Boolean))] as string[];
  const assignmentById = new Map<string, string>();
  if (assignmentIds.length > 0) {
    const byAObj = assignmentIds.filter((x) => OBJECT_ID_REGEX.test(x));
    const byAHuman = assignmentIds.filter((x) => !OBJECT_ID_REGEX.test(x));
    const assignments = await GlobalAssignmentModel.find({
      $or: [
        ...(byAObj.length ? [{ _id: { $in: byAObj } }] : []),
        ...(byAHuman.length ? [{ assignmentId: { $in: byAHuman } }] : []),
      ],
    })
      .select("_id assignmentId")
      .lean()
      .exec();
    for (const a of assignments) {
      const aid = String(a._id);
      const human = (a as { assignmentId?: string }).assignmentId;
      assignmentById.set(aid, human ?? aid);
      if (human) assignmentById.set(human, human);
    }
  }

  const snapshots = globalModules
    .map((m) => {
      const humanModuleId = (m as { moduleId?: string }).moduleId ?? String(m._id);
      const linkedAssignmentId = m.linkedAssignmentId ? (assignmentById.get(m.linkedAssignmentId) ?? m.linkedAssignmentId) : undefined;
      return {
        originalGlobalModuleId: humanModuleId,
        title: m.title,
        description: m.description,
        content: m.content,
        youtubeUrl: m.youtubeUrl ?? undefined,
        videoUrl: (m as { videoUrl?: string }).videoUrl ?? undefined,
        resourceLinkUrl: (m as { resourceLinkUrl?: string }).resourceLinkUrl ?? undefined,
        versionAtSnapshot: m.version,
        linkedAssignmentId,
        order: getModuleOrder(m as { _id: unknown; moduleId?: string }),
        xpReward: 40,
      };
    })
    .sort((a, b) => a.order - b.order);

  const normalizedDescription = decodeEncodedRichText(input.description);
  const normalizedDurationText = String(input.durationText ?? "").trim();
  const headerImageUrl =
    input.headerImageUrl != null && String(input.headerImageUrl).trim()
      ? assertHeaderImageUrl(String(input.headerImageUrl))
      : undefined;
  const courseId = await generateCourseId();
  const doc = await CourseModel.create({
    courseId,
    title: input.title.trim(),
    description: normalizedDescription.trim(),
    durationText: normalizedDurationText,
    ...(headerImageUrl ? { headerImageUrl } : {}),
    ...(input.isDemo ? { isDemo: true } : {}),
    modules: snapshots,
    version: 1,
    status: COURSE_STATUS.ACTIVE,
    createdBy: input.createdBy,
  });

  await createAuditLog("COURSE_CREATED", input.createdBy, ENTITY_COURSE, String(doc._id));
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

export async function listCourses(filters?: { status?: string; search?: string }) {
  const query: Record<string, unknown> = {};
  if (filters?.status) query.status = filters.status;
  if (filters?.search?.trim()) {
    const term = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [{ title: { $regex: term, $options: "i" } }, { description: { $regex: term, $options: "i" } }];
  }
  const list = await CourseModel.find(query).sort({ updatedAt: -1 }).lean().exec();
  return list.map((d) => toCourseResponse(d as unknown as Parameters<typeof toCourseResponse>[0]));
}

export async function getCourseById(id: string) {
  const doc = await findCourseByParam(id);
  if (!doc) throw new AppError("Course not found", 404);
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

export async function updateCourse(id: string, input: UpdateCourseInput, performedBy: string) {
  const doc = await findCourseByParam(id);
  if (!doc) throw new AppError("Course not found", 404);
  await assertCanEditCourseAsync(performedBy, doc);
  if (doc.status === COURSE_STATUS.ARCHIVED) {
    throw new AppError("Cannot update an archived course", 400);
  }
  if (input.title !== undefined) doc.title = input.title.trim();
  if (input.description !== undefined) doc.description = decodeEncodedRichText(input.description).trim();
  if (input.durationText !== undefined) (doc as { durationText?: string }).durationText = String(input.durationText).trim();
  if (input.headerImageUrl !== undefined) {
    if (input.headerImageUrl === null || input.headerImageUrl === "") {
      (doc as { headerImageUrl?: string }).headerImageUrl = "";
    } else {
      (doc as { headerImageUrl?: string }).headerImageUrl = assertHeaderImageUrl(String(input.headerImageUrl));
    }
  }
  if (input.isDemo !== undefined) {
    (doc as { isDemo?: boolean }).isDemo = !!input.isDemo;
  }
  if (input.moderatorIds !== undefined) {
    doc.moderatorIds = Array.isArray(input.moderatorIds)
      ? input.moderatorIds.length > 0
        ? await resolveStaffUserIds(input.moderatorIds)
        : []
      : [];
  }
  await doc.save();
  if (input.headerImageUrl !== undefined || input.isDemo !== undefined) {
    const humanId = (doc as { courseId?: string }).courseId;
    const ids = [String(doc._id), ...(humanId ? [humanId] : [])];
    if (input.headerImageUrl !== undefined) {
      const syncedUrl = String((doc as { headerImageUrl?: string }).headerImageUrl ?? "").trim() || undefined;
      await syncCourseHeaderImageToBatchSnapshots(ids, syncedUrl);
    }
    if (input.isDemo !== undefined) {
      await syncCourseIsDemoToBatchSnapshots(ids, !!(doc as { isDemo?: boolean }).isDemo, performedBy);
    }
  }
  await createAuditLog("COURSE_UPDATED", performedBy, ENTITY_COURSE, String(doc._id));
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

export async function updateCourseModule(
  id: string,
  moduleIndex: number,
  input: UpdateCourseModuleInput,
  performedBy: string
) {
  const doc = await findCourseByParam(id);
  if (!doc) throw new AppError("Course not found", 404);
  await assertCanEditCourseAsync(performedBy, doc);
  if (doc.status === COURSE_STATUS.ARCHIVED) {
    throw new AppError("Cannot update an archived course", 400);
  }
  const modules = doc.modules as Array<{
    originalGlobalModuleId: string;
    title: string;
    description: string;
    content: string;
    youtubeUrl?: string;
    videoUrl?: string;
    versionAtSnapshot: number;
    linkedAssignmentId?: string;
    order: number;
  }>;
  if (moduleIndex < 0 || moduleIndex >= modules.length) {
    throw new AppError("Module index out of range", 400);
  }
  const mod = { ...modules[moduleIndex] } as (typeof modules)[number];
  if (input.title !== undefined) mod.title = input.title.trim();
  if (input.description !== undefined) mod.description = decodeEncodedRichText(input.description).trim();
  if (input.content !== undefined) mod.content = decodeEncodedRichText(input.content);
  if (input.youtubeUrl !== undefined) mod.youtubeUrl = input.youtubeUrl?.trim() || undefined;
  if (input.videoUrl !== undefined) mod.videoUrl = input.videoUrl?.trim() || undefined;
  if (input.resourceLinkUrl !== undefined) (mod as { resourceLinkUrl?: string }).resourceLinkUrl = input.resourceLinkUrl?.trim() || undefined;
  if (input.linkedAssignmentId !== undefined) mod.linkedAssignmentId = input.linkedAssignmentId?.trim() || undefined;
  if (input.linkedAssignmentTitleOverride !== undefined) (mod as { linkedAssignmentTitleOverride?: string }).linkedAssignmentTitleOverride = input.linkedAssignmentTitleOverride?.trim() || undefined;
  if (input.linkedAssignmentInstructionsOverride !== undefined) {
    const normalized = decodeEncodedRichText(input.linkedAssignmentInstructionsOverride);
    (mod as { linkedAssignmentInstructionsOverride?: string }).linkedAssignmentInstructionsOverride = normalized || undefined;
  }
  if (input.linkedAssignmentSubmissionTypeOverride !== undefined) {
    const v = input.linkedAssignmentSubmissionTypeOverride?.trim();
    if (v && !Object.values(SUBMISSION_TYPE).includes(v as (typeof SUBMISSION_TYPE)[keyof typeof SUBMISSION_TYPE])) {
      throw new AppError(`linkedAssignmentSubmissionTypeOverride must be one of: ${Object.values(SUBMISSION_TYPE).join(", ")}`, 400);
    }
    (mod as { linkedAssignmentSubmissionTypeOverride?: string }).linkedAssignmentSubmissionTypeOverride = v || undefined;
  }
  if (input.linkedAssignmentSkillTagsOverride !== undefined) {
    const arr = Array.isArray(input.linkedAssignmentSkillTagsOverride) ? input.linkedAssignmentSkillTagsOverride : undefined;
    if (arr && arr.length > 0) {
      const valid = new Set(Object.values(SKILL_TAG));
      const invalid = arr.filter((t) => !valid.has(t as (typeof SKILL_TAG)[keyof typeof SKILL_TAG]));
      if (invalid.length > 0) throw new AppError(`linkedAssignmentSkillTagsOverride must only include: ${Object.values(SKILL_TAG).join(", ")}`, 400);
    }
    (mod as { linkedAssignmentSkillTagsOverride?: string[] }).linkedAssignmentSkillTagsOverride = arr;
  }
  if (input.xpReward !== undefined) {
    const x = Math.floor(Number(input.xpReward));
    if (!Number.isFinite(x) || x < 0 || x > 100_000) {
      throw new AppError("xpReward must be an integer from 0 to 100,000", 400);
    }
    (mod as { xpReward?: number }).xpReward = x;
  }
  modules[moduleIndex] = mod;
  doc.set("modules", modules);
  await doc.save();
  await createAuditLog("COURSE_UPDATED", performedBy, ENTITY_COURSE, String(doc._id));
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

export interface ReorderModulesInput {
  orderedModuleIndices: number[];
}

export async function reorderModules(id: string, input: ReorderModulesInput, performedBy: string) {
  const doc = await findCourseByParam(id);
  if (!doc) throw new AppError("Course not found", 404);
  await assertCanEditCourseAsync(performedBy, doc);
  if (doc.status === COURSE_STATUS.ARCHIVED) {
    throw new AppError("Cannot reorder modules in an archived course", 400);
  }
  const indices = input.orderedModuleIndices;
  if (!Array.isArray(indices) || indices.length !== doc.modules.length) {
    throw new AppError("orderedModuleIndices must be an array of length equal to module count", 400);
  }
  const sorted = [...doc.modules];
  const reordered = indices.map((i) => sorted[i]).filter(Boolean);
  if (reordered.length !== doc.modules.length) {
    throw new AppError("Invalid orderedModuleIndices", 400);
  }
  const newModules = reordered.map((m, idx) => {
    const s = m as unknown as Record<string, unknown>;
    return { ...s, order: idx };
  });
  doc.set("modules", newModules);
  await doc.save();
  await createAuditLog("COURSE_UPDATED", performedBy, ENTITY_COURSE, String(doc._id));
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

export async function duplicateCourse(id: string, performedBy: string) {
  const source = await findCourseByParam(id);
  if (!source) throw new AppError("Course not found", 404);
  await assertCanEditCourseAsync(performedBy, source);
  const courseId = await generateCourseId();
  const dupHeader = String((source as { headerImageUrl?: string }).headerImageUrl ?? "").trim() || undefined;
  const doc = await CourseModel.create({
    courseId,
    title: `${source.title} (Copy)`,
    description: source.description,
    ...(dupHeader ? { headerImageUrl: dupHeader } : {}),
    ...((source as { isDemo?: boolean }).isDemo ? { isDemo: true } : {}),
    modules: source.modules,
    version: 1,
    status: COURSE_STATUS.ACTIVE,
    createdBy: performedBy,
  });
  await createAuditLog("COURSE_DUPLICATED", performedBy, ENTITY_COURSE, String(doc._id));
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

export async function archiveCourse(id: string, performedBy: string) {
  const existing = await findCourseByParam(id);
  if (!existing) throw new AppError("Course not found", 404);
  assertCanArchiveCourse(performedBy, existing);
  const doc = await CourseModel.findByIdAndUpdate(
    existing._id,
    { status: COURSE_STATUS.ARCHIVED },
    { new: true }
  ).exec();
  if (!doc) throw new AppError("Course not found", 404);
  await createAuditLog("COURSE_ARCHIVED", performedBy, ENTITY_COURSE, String(doc._id));
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

export async function unarchiveCourse(id: string, performedBy: string) {
  const existing = await findCourseByParam(id);
  if (!existing) throw new AppError("Course not found", 404);
  assertCanArchiveCourse(performedBy, existing);
  if (existing.status !== COURSE_STATUS.ARCHIVED) {
    throw new AppError("Course is not archived", 400);
  }
  const doc = await CourseModel.findByIdAndUpdate(
    existing._id,
    { status: COURSE_STATUS.ACTIVE },
    { new: true }
  ).exec();
  if (!doc) throw new AppError("Course not found", 404);
  await createAuditLog("COURSE_UNARCHIVED", performedBy, ENTITY_COURSE, String(doc._id));
  return toCourseResponse(doc as unknown as Parameters<typeof toCourseResponse>[0]);
}

/**
 * Hard-delete a course from the library.
 *
 * Refuses if any batch's `courseSnapshots` / `courseSnapshot` still references
 * this course — batches embed their own snapshot at creation time, so the
 * source course can be removed from the library without affecting them; we
 * still err on the side of safety and require the operator to first remove or
 * archive batches that derive from it.
 */
export async function deleteCourse(id: string, performedBy: string) {
  const existing = await findCourseByParam(id);
  if (!existing) throw new AppError("Course not found", 404);

  const mongoId = String(existing._id);
  const humanId = (existing as { courseId?: string }).courseId;
  const courseIds = [mongoId, ...(humanId ? [humanId] : [])];

  const dependentBatchCount = await BatchModel.countDocuments({
    $or: [
      { "courseSnapshots.courseId": { $in: courseIds } },
      { "courseSnapshot.courseId": { $in: courseIds } },
    ],
  }).exec();

  if (dependentBatchCount > 0) {
    throw new AppError(
      `Cannot delete course — ${dependentBatchCount} batch${dependentBatchCount === 1 ? "" : "es"} still derive from it. Archive the course (or delete the batches) instead.`,
      409
    );
  }

  await CourseModel.deleteOne({ _id: existing._id }).exec();
  await createAuditLog("COURSE_DELETED", performedBy, ENTITY_COURSE, mongoId, {
    courseId: humanId,
    title: existing.title,
  });
  return { id: mongoId, courseId: humanId, title: existing.title, deleted: true };
}
