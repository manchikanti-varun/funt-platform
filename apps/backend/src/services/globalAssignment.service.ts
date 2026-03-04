/**
 * Global Assignment service – CRUD, soft archive, access (general type), moderators.
 */

import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { UserModel } from "../models/User.model.js";
import { ASSIGNMENT_STATUS, SUBMISSION_TYPE, SKILL_TAG } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import { generateAssignmentId } from "../utils/funtIdGenerator.js";

const ENTITY = "GlobalAssignment";
const VALID_SUBMISSION_TYPES = Object.values(SUBMISSION_TYPE);
const VALID_SKILL_TAGS = Object.values(SKILL_TAG);
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function assertCanEditAssignment(performedBy: string, doc: { createdBy?: string; moderatorIds?: string[] }) {
  const createdBy = doc.createdBy ?? "";
  const mods = doc.moderatorIds ?? [];
  if (createdBy !== performedBy && !mods.includes(performedBy)) {
    throw new AppError("Forbidden: only the creator or a moderator can edit this assignment", 403);
  }
}

async function resolveStudentId(funtIdOrUserId: string): Promise<string> {
  const v = (funtIdOrUserId && String(funtIdOrUserId).trim()) || "";
  if (!v) throw new AppError("Student FUNT ID or user ID is required", 400);
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v).exec();
    if (!user) throw new AppError("Student not found", 404);
    return String(user._id);
  }
  const user = await UserModel.findOne({ funtId: v }).exec();
  if (!user) throw new AppError("Student not found (invalid FUNT ID)", 404);
  return String(user._id);
}

export interface CreateAssignmentInput {
  title: string;
  instructions: string;
  submissionType: string;
  skillTags: string[];
  type?: "general" | "module";
  allowedStudentIds?: string[];
  moderatorIds?: string[];
  createdBy: string;
}

export interface UpdateAssignmentInput {
  title?: string;
  instructions?: string;
  submissionType?: string;
  skillTags?: string[];
  type?: "general" | "module";
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

function validateSkillTags(arr: string[]): void {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new AppError("skillTags must be a non-empty array", 400);
  }
  const invalid = arr.filter((t) => !VALID_SKILL_TAGS.includes(t as typeof SKILL_TAG[keyof typeof SKILL_TAG]));
  if (invalid.length > 0) {
    throw new AppError(
      `skillTags must only include: ${VALID_SKILL_TAGS.join(", ")}`,
      400
    );
  }
}

export async function createAssignment(input: CreateAssignmentInput) {
  if (!input.title?.trim()) throw new AppError("title is required", 400);
  if (!input.instructions?.trim()) throw new AppError("instructions is required", 400);
  if (!input.submissionType) throw new AppError("submissionType is required", 400);
  validateSubmissionType(input.submissionType);
  validateSkillTags(input.skillTags ?? []);
  const type =
    input.type != null && String(input.type).toLowerCase() === "general" ? "general" : "module";
  const allowedStudentIds = Array.isArray(input.allowedStudentIds) ? input.allowedStudentIds : [];
  const moderatorIds = Array.isArray(input.moderatorIds) ? input.moderatorIds : [];

  const assignmentId = await generateAssignmentId();
  const doc = await GlobalAssignmentModel.create({
    assignmentId,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    submissionType: input.submissionType,
    skillTags: input.skillTags,
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
    type: d.type ?? "module",
    allowedStudentIds: d.allowedStudentIds ?? [],
    createdBy: d.createdBy,
    moderatorIds: d.moderatorIds ?? [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** Resolve assignment by MongoDB _id or human assignmentId (e.g. ASG-26-00001). */
export async function findAssignmentByParam(id: string) {
  if (!id?.trim()) return null;
  const t = id.trim();
  if (OBJECT_ID_REGEX.test(t)) return GlobalAssignmentModel.findById(t).exec();
  return GlobalAssignmentModel.findOne({ assignmentId: t }).exec();
}

/** Published general assignments for a student (only those where student is in allowedStudentIds).
 * Matches by both user _id and funtId so access works whether admins stored id or FUNT ID.
 * Shows assignments that are not archived (ACTIVE or legacy DRAFT/PUBLISHED/DUE/CLOSED). */
export async function listPublishedForStudent(studentId: string) {
  const id = (studentId && String(studentId).trim()) || "";
  if (!id) return [];

  let user = await UserModel.findById(id).select("_id funtId").lean().exec();
  if (!user && id.length > 0) {
    user = await UserModel.findOne({ funtId: id }).select("_id funtId").lean().exec();
  }
  const uid = user ? String((user as { _id: unknown })._id) : id;
  const funtId = user && typeof (user as { funtId?: string }).funtId === "string" ? (user as { funtId: string }).funtId.trim() : "";
  const idsToMatch = funtId && funtId !== uid ? [uid, id, funtId] : [uid, id];
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
  if (input.skillTags !== undefined) validateSkillTags(input.skillTags);

  if (input.title !== undefined) existing.title = input.title.trim();
  if (input.instructions !== undefined) existing.instructions = input.instructions.trim();
  if (input.submissionType !== undefined) existing.submissionType = input.submissionType as typeof SUBMISSION_TYPE[keyof typeof SUBMISSION_TYPE];
  if (input.skillTags !== undefined) existing.skillTags = input.skillTags as typeof SKILL_TAG[keyof typeof SKILL_TAG][];
  if (input.type !== undefined)
    (existing as { type?: string }).type =
      String(input.type).toLowerCase() === "general" ? "general" : "module";
  if (input.allowedStudentIds !== undefined) (existing as { allowedStudentIds?: string[] }).allowedStudentIds = Array.isArray(input.allowedStudentIds) ? input.allowedStudentIds : [];
  if (input.moderatorIds !== undefined) (existing as { moderatorIds?: string[] }).moderatorIds = Array.isArray(input.moderatorIds) ? input.moderatorIds : [];
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
    type: src.type ?? "module",
    allowedStudentIds: src.allowedStudentIds ?? [],
    createdBy: performedBy,
    moderatorIds: [],
  });
  await createAuditLog("ASSIGNMENT_DUPLICATED", performedBy, ENTITY, String(doc._id));
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

/** Add one student to allowed list (by FUNT ID or user ID). For type=general only.
 * Stores both user _id and funtId so student list matches whether JWT sends id or funtId. */
export async function addAllowedStudent(assignmentId: string, funtIdOrUserId: string, performedBy: string) {
  const doc = await findAssignmentByParam(assignmentId);
  if (!doc) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, doc as { createdBy?: string; moderatorIds?: string[] });
  const studentId = await resolveStudentId(funtIdOrUserId);
  const user = await UserModel.findById(studentId).select("funtId").lean().exec();
  const funtId = user && typeof (user as { funtId?: string }).funtId === "string" ? (user as { funtId: string }).funtId.trim() : "";
  const allowed = (doc as { allowedStudentIds?: string[] }).allowedStudentIds ?? [];
  const toAdd = funtId && funtId !== studentId ? [studentId, funtId] : [studentId];
  const nextAllowed = [...allowed];
  for (const v of toAdd) {
    if (!nextAllowed.includes(v)) nextAllowed.push(v);
  }
  if (nextAllowed.length === allowed.length) return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
  (doc as { allowedStudentIds: string[] }).allowedStudentIds = nextAllowed;
  await doc.save();
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

/** Remove one student from allowed list (by _id or FUNT ID; removes both from array). */
export async function removeAllowedStudent(assignmentId: string, studentIdOrFuntId: string, performedBy: string) {
  const doc = await findAssignmentByParam(assignmentId);
  if (!doc) throw new AppError("Assignment not found", 404);
  assertCanEditAssignment(performedBy, doc as { createdBy?: string; moderatorIds?: string[] });
  let uid: string;
  let funtId = "";
  try {
    uid = await resolveStudentId(studentIdOrFuntId);
    const user = await UserModel.findById(uid).select("funtId").lean().exec();
    funtId = user && typeof (user as { funtId?: string }).funtId === "string" ? (user as { funtId: string }).funtId.trim() : "";
  } catch {
    uid = studentIdOrFuntId;
  }
  const toRemove = funtId && funtId !== uid ? [uid, funtId, studentIdOrFuntId] : [uid, studentIdOrFuntId];
  const allowed = (doc as { allowedStudentIds?: string[] }).allowedStudentIds ?? [];
  (doc as { allowedStudentIds: string[] }).allowedStudentIds = allowed.filter((id) => !toRemove.includes(id));
  await doc.save();
  return toAssignmentResponse(doc as unknown as Parameters<typeof toAssignmentResponse>[0]);
}

/** Bulk add students by FUNT IDs or user IDs (JSON array or CSV line). */
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
      if (allowed.has(studentId)) {
        result.skipped += 1;
        continue;
      }
      allowed.add(studentId);
      result.added += 1;
    } catch {
      result.notFound.push(v);
    }
  }
  (doc as { allowedStudentIds: string[] }).allowedStudentIds = Array.from(allowed);
  await doc.save();
  return result;
}

/** List allowed students (id, funtId, name) for an assignment.
 * allowedStudentIds may contain MongoDB _id (24-char hex) or FUNT ID; query by both. */
export async function listAllowedStudents(assignmentId: string) {
  const doc = await findAssignmentByParam(assignmentId);
  if (!doc) throw new AppError("Assignment not found", 404);
  const ids = (doc as { allowedStudentIds?: string[] }).allowedStudentIds ?? [];
  if (ids.length === 0) return [];
  const objectIds = ids.filter((id) => OBJECT_ID_REGEX.test(String(id)));
  const funtIds = ids.filter((id) => !OBJECT_ID_REGEX.test(String(id)));
  const conditions: { _id?: { $in: string[] }; funtId?: { $in: string[] } }[] = [];
  if (objectIds.length) conditions.push({ _id: { $in: objectIds } });
  if (funtIds.length) conditions.push({ funtId: { $in: funtIds } });
  if (conditions.length === 0) return [];
  const users = await UserModel.find(conditions.length === 1 ? conditions[0] : { $or: conditions })
    .select("_id funtId name")
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
      funtId: (u as { funtId?: string }).funtId ?? "",
      name: (u as { name?: string }).name ?? "",
    }));
}
