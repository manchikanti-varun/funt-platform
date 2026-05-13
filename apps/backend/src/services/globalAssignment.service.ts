
import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { GlobalAssignmentSubmissionModel } from "../models/GlobalAssignmentSubmission.model.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.model.js";
import { GlobalModuleModel } from "../models/GlobalModule.model.js";
import { CourseModel } from "../models/Course.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { UserModel } from "../models/User.model.js";
import { ASSIGNMENT_STATUS, SUBMISSION_TYPE, isValidSkillTag } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import { generateAssignmentId } from "../utils/funtIdGenerator.js";
import { resolveStaffUserIds } from "../utils/resolveStaffUserIds.js";

const ENTITY = "GlobalAssignment";
const VALID_SUBMISSION_TYPES = Object.values(SUBMISSION_TYPE);
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function assertCanEditAssignment(performedBy: string, doc: { createdBy?: string; moderatorIds?: string[] }) {
  const createdBy = doc.createdBy ?? "";
  const mods = doc.moderatorIds ?? [];
  if (createdBy !== performedBy && !mods.includes(performedBy)) {
    throw new AppError("Forbidden: only the creator or a moderator can edit this assignment", 403);
  }
}

async function resolveStudentId(usernameOrUserId: string): Promise<string> {
  const v = (usernameOrUserId && String(usernameOrUserId).trim()) || "";
  if (!v) throw new AppError("Student username or user ID is required", 400);
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v).exec();
    if (!user) throw new AppError("Student not found", 404);
    return String(user._id);
  }
  const user = await UserModel.findOne({ username: v.toLowerCase() }).exec();
  if (!user) throw new AppError("Student not found (invalid username)", 404);
  return String(user._id);
}

export interface CreateAssignmentInput {
  title: string;
  instructions: string;
  submissionType: string;
  skillTags: string[];
  type?: "general" | "chapter";
  allowedStudentIds?: string[];
  moderatorIds?: string[];
  createdBy: string;
}

export interface UpdateAssignmentInput {
  title?: string;
  instructions?: string;
  submissionType?: string;
  skillTags?: string[];
  type?: "general" | "chapter";
  allowedStudentIds?: string[];
  moderatorIds?: string[];
}

function validateSubmissionType(value: string): void {
  if (!VALID_SUBMISSION_TYPES.includes(value as typeof SUBMISSION_TYPE[keyof typeof SUBMISSION_TYPE])) {
    throw new AppError(
      `submissionType must be one of: ${VALID_SUBMISSION_TYPES.join(", ")}`,
      400
    );
  }
}

/** Dedupe, trim, validate presets + short custom labels. */
function normalizeSkillTags(raw: unknown): string[] {
  const unique = [...new Set((Array.isArray(raw) ? raw : []).map((t) => String(t).trim()).filter(Boolean))];
  if (unique.length === 0) throw new AppError("skillTags must be a non-empty array", 400);
  const invalid = unique.filter((t) => !isValidSkillTag(t));
  if (invalid.length > 0) throw new AppError(`Invalid skill tags: ${invalid.slice(0, 8).join(", ")}`, 400);
  return unique;
}

export async function createAssignment(input: CreateAssignmentInput) {
  if (!input.title?.trim()) throw new AppError("title is required", 400);
  if (!input.instructions?.trim()) throw new AppError("instructions is required", 400);
  if (!input.submissionType) throw new AppError("submissionType is required", 400);
  validateSubmissionType(input.submissionType);
  const skillTagsNorm = normalizeSkillTags(input.skillTags ?? []);
  const type =
    input.type != null && String(input.type).toLowerCase() === "general" ? "general" : "chapter";
  const allowedStudentIds = Array.isArray(input.allowedStudentIds) ? input.allowedStudentIds : [];
  const moderatorIds =
    Array.isArray(input.moderatorIds) && input.moderatorIds.length > 0
      ? await resolveStaffUserIds(input.moderatorIds)
      : [];

  const assignmentId = await generateAssignmentId();
  const doc = await GlobalAssignmentModel.create({
    assignmentId,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    submissionType: input.submissionType,
    skillTags: skillTagsNorm,
    status: ASSIGNMENT_STATUS.ACTIVE,
    type,
    allowedStudentIds,
    createdBy: input.createdBy,
    moderatorIds,
  });

  await createAuditLog("ASSIGNMENT_CREATED", input.createdBy, ENTITY, String(doc._id));

  return toAssignmentResponse(doc);
}

export async function listAssignments(filters?: { status?: string; search?: string }) {
  const query: Record<string, unknown> = {};
  if (filters?.status) query.status = filters.status;
  if (filters?.search?.trim()) {
    const term = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [{ title: { $regex: term, $options: "i" } }, { instructions: { $regex: term, $options: "i" } }];
  }
  const list = await GlobalAssignmentModel.find(query)
    .sort({ updatedAt: -1 })
    .lean()
    .exec();
  return list.map((d) => toAssignmentResponse(d as Parameters<typeof toAssignmentResponse>[0]));
}

function toAssignmentResponse(d: { _id: unknown; assignmentId?: string | null; title: string; instructions: string; submissionType: string; skillTags: string[]; status: string; type?: string; allowedStudentIds?: string[] | null; createdBy: string; moderatorIds?: string[] | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: String(d._id),
    assignmentId: d.assignmentId ?? undefined,
    title: d.title,
    instructions: d.instructions,
    submissionType: d.submissionType,
    skillTags: d.skillTags,
    status: d.status,
    type: d.type ?? "chapter",
    allowedStudentIds: d.allowedStudentIds ?? [],
    createdBy: d.createdBy,
    moderatorIds: d.moderatorIds ?? [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function findAssignmentByParam(id: string) {
  if (!id?.trim()) return null;
  const t = id.trim();
  if (OBJECT_ID_REGEX.test(t)) return GlobalAssignmentModel.findById(t).exec();
  return GlobalAssignmentModel.findOne({ assignmentId: t }).exec();
}

export async function listPublishedForStudent(studentId: string) {
  const id = (studentId && String(studentId).trim()) || "";
  if (!id) return [];

  let user = await UserModel.findById(id).select("_id username").lean().exec();
  if (!user && id.length > 0) {
    user = await UserModel.findOne({ username: id.toLowerCase() }).select("_id username").lean().exec();
  }
  const uid = user ? String((user as { _id: unknown })._id) : id;
  const uname =
    user && typeof (user as { username?: string }).username === "string"
      ? (user as { username: string }).username.trim().toLowerCase()
      : "";
  const idsToMatch = uname && uname !== uid ? [uid, id, uname] : [uid, id];
  const uniqueIds = [...new Set(idsToMatch)];

  const list = await GlobalAssignmentModel.find({
    type: "general",
    status: { $ne: ASSIGNMENT_STATUS.ARCHIVED },
    allowedStudentIds: { $in: uniqueIds },
  })
    .sort({ updatedAt: -1 })
    .lean()
    .exec();
  return list.map((d) => ({
    id: String(d._id),
    title: d.title,
    instructions: d.instructions,
    submissionType: d.submissionType,
    skillTags: d.skillTags,
    status: d.status,
  }));
}

export async function getAssignmentById(id: string) {
  const doc = await findAssignmentByParam(id);
  if (!doc) throw new AppError("Assignment not found", 404);
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

export async function updateAssignment(
  id: string,
  input: UpdateAssignmentInput,
  performedBy: string
) {
  const existing = await findAssignmentByParam(id);
  if (!existing) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, existing as { createdBy?: string; moderatorIds?: string[] });
  if (existing.status === ASSIGNMENT_STATUS.ARCHIVED) {
    throw new AppError("Cannot update an archived assignment", 400);
  }

  if (input.submissionType !== undefined) validateSubmissionType(input.submissionType);

  if (input.title !== undefined) existing.title = input.title.trim();
  if (input.instructions !== undefined) existing.instructions = input.instructions.trim();
  if (input.submissionType !== undefined) existing.submissionType = input.submissionType as typeof SUBMISSION_TYPE[keyof typeof SUBMISSION_TYPE];
  if (input.skillTags !== undefined) existing.skillTags = normalizeSkillTags(input.skillTags);
  if (input.type !== undefined)
    (existing as { type?: string }).type =
      String(input.type).toLowerCase() === "general" ? "general" : "chapter";
  if (input.allowedStudentIds !== undefined) (existing as { allowedStudentIds?: string[] }).allowedStudentIds = Array.isArray(input.allowedStudentIds) ? input.allowedStudentIds : [];
  if (input.moderatorIds !== undefined) {
    (existing as { moderatorIds?: string[] }).moderatorIds = Array.isArray(input.moderatorIds)
      ? input.moderatorIds.length > 0
        ? await resolveStaffUserIds(input.moderatorIds)
        : []
      : [];
  }
  await existing.save();

  await createAuditLog("ASSIGNMENT_UPDATED", performedBy, ENTITY, id);

  return toAssignmentResponse(existing as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

export async function archiveAssignment(id: string, performedBy: string) {
  const existing = await findAssignmentByParam(id);
  if (!existing) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, existing as { createdBy?: string; moderatorIds?: string[] });
  const doc = await GlobalAssignmentModel.findByIdAndUpdate(
    existing._id,
    { status: ASSIGNMENT_STATUS.ARCHIVED },
    { new: true }
  ).exec();
  if (!doc) throw new AppError("Assignment not found", 404);
  await createAuditLog("ASSIGNMENT_ARCHIVED", performedBy, ENTITY, String(doc._id));
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

export async function unarchiveAssignment(id: string, performedBy: string) {
  const existing = await findAssignmentByParam(id);
  if (!existing) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, existing as { createdBy?: string; moderatorIds?: string[] });
  if (existing.status !== ASSIGNMENT_STATUS.ARCHIVED) {
    throw new AppError("Assignment is not archived", 400);
  }
  const doc = await GlobalAssignmentModel.findByIdAndUpdate(
    existing._id,
    { status: ASSIGNMENT_STATUS.ACTIVE },
    { new: true }
  ).exec();
  if (!doc) throw new AppError("Assignment not found", 404);
  await createAuditLog("ASSIGNMENT_UNARCHIVED", performedBy, ENTITY, String(doc._id));
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

/**
 * Hard-delete a global assignment from the library.
 *
 * Refuses with a clear breakdown if anything still depends on it:
 *  - any submission (general assignments use `GlobalAssignmentSubmission`,
 *    chapter assignments use `AssignmentSubmission` keyed by `assignmentId`),
 *  - any global chapter that links to it via `linkedAssignmentId`,
 *  - any course / batch chapter snapshot that links to it.
 *
 * The caller should archive the assignment instead in that case.
 */
export async function deleteAssignment(id: string, performedBy: string) {
  const existing = await findAssignmentByParam(id);
  if (!existing) throw new AppError("Assignment not found", 404);

  const docId = String(existing._id);
  const assignmentHumanId = (existing as { assignmentId?: string }).assignmentId ?? "";

  // Submissions can reference assignments by either the Mongo ObjectId or
  // the human-readable assignmentId (depending on which entity created the
  // record), so we match both.
  const idsToMatch = [docId, assignmentHumanId].filter(Boolean);

  const [
    globalSubmissions,
    chapterSubmissions,
    chapterRefs,
    courseSnapshotRefs,
    batchSnapshotRefs,
  ] = await Promise.all([
    GlobalAssignmentSubmissionModel.countDocuments({ assignmentId: { $in: idsToMatch } }).exec(),
    AssignmentSubmissionModel.countDocuments({ assignmentId: { $in: idsToMatch } }).exec(),
    GlobalModuleModel.countDocuments({ linkedAssignmentId: { $in: idsToMatch } }).exec(),
    CourseModel.countDocuments({ "modules.linkedAssignmentId": { $in: idsToMatch } }).exec(),
    BatchModel.countDocuments({ "courseSnapshots.modules.linkedAssignmentId": { $in: idsToMatch } }).exec(),
  ]);

  const totalSubmissions = globalSubmissions + chapterSubmissions;
  const blockers: string[] = [];
  if (totalSubmissions > 0) blockers.push(`${totalSubmissions} submission${totalSubmissions === 1 ? "" : "s"}`);
  if (chapterRefs > 0) blockers.push(`${chapterRefs} chapter${chapterRefs === 1 ? "" : "s"} linked to it`);
  if (courseSnapshotRefs > 0) blockers.push(`${courseSnapshotRefs} course${courseSnapshotRefs === 1 ? "" : "s"} include it`);
  if (batchSnapshotRefs > 0) blockers.push(`${batchSnapshotRefs} batch${batchSnapshotRefs === 1 ? "" : "es"} include it`);

  if (blockers.length > 0) {
    throw new AppError(
      `Cannot delete assignment — still in use by ${blockers.join(", ")}. Archive it instead.`,
      409
    );
  }

  await GlobalAssignmentModel.deleteOne({ _id: existing._id }).exec();
  await createAuditLog("ASSIGNMENT_DELETED", performedBy, ENTITY, docId, {
    assignmentId: assignmentHumanId,
    title: existing.title,
  });
  return { id: docId, assignmentId: assignmentHumanId, title: existing.title, deleted: true };
}

export async function duplicateAssignment(id: string, performedBy: string) {
  const source = await findAssignmentByParam(id);
  if (!source) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, source as { createdBy?: string; moderatorIds?: string[] });
  const src = source as { type?: string; allowedStudentIds?: string[]; moderatorIds?: string[] };
  const title = `${source.title.trim().replace(/\s*\(Copy\)\s*$/i, "")} (Copy)`;
  const assignmentId = await generateAssignmentId();
  const doc = await GlobalAssignmentModel.create({
    assignmentId,
    title,
    instructions: source.instructions,
    submissionType: source.submissionType,
    skillTags: source.skillTags ?? [],
    status: ASSIGNMENT_STATUS.ACTIVE,
    type: src.type ?? "chapter",
    allowedStudentIds: src.allowedStudentIds ?? [],
    createdBy: performedBy,
    moderatorIds: [],
  });
  await createAuditLog("ASSIGNMENT_DUPLICATED", performedBy, ENTITY, String(doc._id));
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

export async function addAllowedStudent(assignmentId: string, usernameOrUserId: string, performedBy: string) {
  const doc = await findAssignmentByParam(assignmentId);
  if (!doc) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, doc as { createdBy?: string; moderatorIds?: string[] });
  const studentId = await resolveStudentId(usernameOrUserId);
  const user = await UserModel.findById(studentId).select("username").lean().exec();
  const uname =
    user && typeof (user as { username?: string }).username === "string"
      ? (user as { username: string }).username.trim().toLowerCase()
      : "";
  const allowed = (doc as { allowedStudentIds?: string[] }).allowedStudentIds ?? [];
  const toAdd = uname && uname !== studentId ? [studentId, uname] : [studentId];
  const nextAllowed = [...allowed];
  for (const v of toAdd) {
    if (!nextAllowed.includes(v)) nextAllowed.push(v);
  }
  if (nextAllowed.length === allowed.length) return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
  (doc as { allowedStudentIds: string[] }).allowedStudentIds = nextAllowed;
  await doc.save();
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

/** Remove one student from allowed list (by _id or username; removes matching entries). */
export async function removeAllowedStudent(assignmentId: string, studentIdOrUsername: string, performedBy: string) {
  const doc = await findAssignmentByParam(assignmentId);
  if (!doc) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, doc as { createdBy?: string; moderatorIds?: string[] });
  let uid: string;
  let uname = "";
  try {
    uid = await resolveStudentId(studentIdOrUsername);
    const user = await UserModel.findById(uid).select("username").lean().exec();
    uname =
      user && typeof (user as { username?: string }).username === "string"
        ? (user as { username: string }).username.trim().toLowerCase()
        : "";
  } catch {
    uid = studentIdOrUsername;
  }
  const toRemove = uname && uname !== uid ? [uid, uname, studentIdOrUsername] : [uid, studentIdOrUsername];
  const allowed = (doc as { allowedStudentIds?: string[] }).allowedStudentIds ?? [];
  (doc as { allowedStudentIds: string[] }).allowedStudentIds = allowed.filter((id) => !toRemove.includes(id));
  await doc.save();
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

/** Bulk add students by usernames or user IDs (JSON array or CSV line). */
export async function bulkAddAllowedStudents(
  assignmentId: string,
  identifiers: string[],
  performedBy: string
): Promise<{ added: number; skipped: number; notFound: string[] }> {
  const doc = await findAssignmentByParam(assignmentId);
  if (!doc) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, doc as { createdBy?: string; moderatorIds?: string[] });
  const allowed = new Set((doc as { allowedStudentIds?: string[] }).allowedStudentIds ?? []);
  const result = { added: 0, skipped: 0, notFound: [] as string[] };
  for (const raw of identifiers) {
    const v = (raw && String(raw).trim()) || "";
    if (!v) continue;
    try {
      const studentId = await resolveStudentId(v);
      const user = await UserModel.findById(studentId).select("username").lean().exec();
      const uname =
        user && typeof (user as { username?: string }).username === "string"
          ? (user as { username: string }).username.trim().toLowerCase()
          : "";
      const toAdd = uname && uname !== studentId ? [studentId, uname] : [studentId];
      const already = toAdd.every((x) => allowed.has(x));
      if (already) {
        result.skipped += 1;
        continue;
      }
      for (const x of toAdd) allowed.add(x);
      result.added += 1;
    } catch {
      result.notFound.push(v);
    }
  }
  (doc as { allowedStudentIds: string[] }).allowedStudentIds = Array.from(allowed);
  await doc.save();
  return result;
}

/** List allowed students (id, username, name) for an assignment.
 * allowedStudentIds may contain MongoDB _id (24-char hex) or username. */
export async function listAllowedStudents(assignmentId: string) {
  const doc = await findAssignmentByParam(assignmentId);
  if (!doc) throw new AppError("Assignment not found", 404);
  const ids = (doc as { allowedStudentIds?: string[] }).allowedStudentIds ?? [];
  if (ids.length === 0) return [];
  const objectIds = ids.filter((id) => OBJECT_ID_REGEX.test(String(id)));
  const usernames = ids
    .filter((id) => !OBJECT_ID_REGEX.test(String(id)))
    .map((s) => String(s).toLowerCase());
  const conditions: { _id?: { $in: string[] }; username?: { $in: string[] } }[] = [];
  if (objectIds.length) conditions.push({ _id: { $in: objectIds } });
  if (usernames.length) conditions.push({ username: { $in: usernames } });
  if (conditions.length === 0) return [];
  const users = await UserModel.find(conditions.length === 1 ? conditions[0] : { $or: conditions })
    .select("_id username name")
    .lean()
    .exec();
  const seen = new Set<string>();
  return users
    .filter((u) => {
      const id = String(u._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((u) => ({
      id: String(u._id),
      username: (u as { username?: string }).username ?? "",
      name: (u as { name?: string }).name ?? "",
    }));
}
