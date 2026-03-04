
import { GlobalModuleModel } from "../models/GlobalModule.model.js";
import { MODULE_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import { generateModuleId } from "../utils/funtIdGenerator.js";

const ENTITY = "GlobalModule";
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

async function findModuleByParam(id: string) {
  if (!id?.trim()) return null;
  const t = id.trim();
  if (OBJECT_ID_REGEX.test(t)) return GlobalModuleModel.findById(t).exec();
  return GlobalModuleModel.findOne({ moduleId: t }).exec();
}
const MAX_VERSION_SNAPSHOTS = 20;

export interface CreateModuleInput {
  title: string;
  description: string;
  content: string;
  youtubeUrl?: string;
  videoUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
  createdBy: string;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string;
  content?: string;
  youtubeUrl?: string;
  videoUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
}

function nextVersion(current: number): number {
  return Math.round((current + 0.1) * 10) / 10;
}

function contentChanged(
  existing: { title: string; description: string; content: string; youtubeUrl?: string | null; videoUrl?: string | null; resourceLinkUrl?: string | null; linkedAssignmentId?: string | null },
  input: UpdateModuleInput
): boolean {
  if (input.title !== undefined && input.title !== existing.title) return true;
  if (input.description !== undefined && input.description !== existing.description) return true;
  if (input.content !== undefined && input.content !== existing.content) return true;
  if (input.youtubeUrl !== undefined && (input.youtubeUrl || null) !== (existing.youtubeUrl ?? null)) return true;
  if (input.videoUrl !== undefined && (input.videoUrl || null) !== (existing.videoUrl ?? null)) return true;
  if (input.resourceLinkUrl !== undefined && (input.resourceLinkUrl || null) !== ((existing as { resourceLinkUrl?: string | null }).resourceLinkUrl ?? null)) return true;
  if (input.linkedAssignmentId !== undefined && (input.linkedAssignmentId || null) !== (existing.linkedAssignmentId ?? null)) return true;
  return false;
}

export async function createModule(input: CreateModuleInput) {
  if (!input.title?.trim()) throw new AppError("title is required", 400);
  if (!input.description?.trim()) throw new AppError("description is required", 400);
  if (input.content == null) throw new AppError("content is required", 400);

  const moduleId = await generateModuleId();
  const doc = await GlobalModuleModel.create({
    moduleId,
    title: input.title.trim(),
    description: input.description.trim(),
    content: input.content,
    youtubeUrl: input.youtubeUrl?.trim() || undefined,
    videoUrl: input.videoUrl?.trim() || undefined,
    resourceLinkUrl: input.resourceLinkUrl?.trim() || undefined,
    linkedAssignmentId: input.linkedAssignmentId || undefined,
    version: 1,
    status: MODULE_STATUS.ACTIVE,
    createdBy: input.createdBy,
  });

  await createAuditLog("MODULE_CREATED", input.createdBy, ENTITY, String(doc._id));

  return {
    id: String(doc._id),
    moduleId: (doc as { moduleId?: string }).moduleId,
    title: doc.title,
    description: doc.description,
    content: doc.content,
    youtubeUrl: doc.youtubeUrl,
    videoUrl: (doc as { videoUrl?: string }).videoUrl,
    resourceLinkUrl: (doc as { resourceLinkUrl?: string }).resourceLinkUrl,
    linkedAssignmentId: doc.linkedAssignmentId,
    version: doc.version,
    status: doc.status,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listModules(filters?: { status?: string; search?: string }) {
  const query: Record<string, unknown> = {};
  if (filters?.status) query.status = filters.status;
  if (filters?.search?.trim()) {
    const term = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [{ title: { $regex: term, $options: "i" } }, { description: { $regex: term, $options: "i" } }];
  }
  const list = await GlobalModuleModel.find(query)
    .sort({ updatedAt: -1 })
    .lean()
    .exec();
  return list.map((d) => ({
    id: String(d._id),
    moduleId: (d as { moduleId?: string }).moduleId,
    title: d.title,
    description: d.description,
    content: d.content,
    youtubeUrl: d.youtubeUrl,
    videoUrl: (d as { videoUrl?: string }).videoUrl,
    resourceLinkUrl: (d as { resourceLinkUrl?: string }).resourceLinkUrl,
    linkedAssignmentId: d.linkedAssignmentId,
    version: d.version,
    status: d.status,
    createdBy: d.createdBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export type VersionSnapshot = {
  version: number;
  title: string;
  description: string;
  content: string;
  youtubeUrl?: string;
  videoUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
  savedAt: Date;
  savedBy?: string;
};

export async function getModuleById(id: string) {
  const doc = await findModuleByParam(id);
  if (!doc) throw new AppError("Module not found", 404);
  const d = doc.toObject ? doc.toObject() : doc;
  const snapshots = (d as { versionSnapshots?: VersionSnapshot[] }).versionSnapshots ?? [];
  return {
    id: String(d._id),
    moduleId: (d as { moduleId?: string }).moduleId,
    title: d.title,
    description: d.description,
    content: d.content,
    youtubeUrl: d.youtubeUrl,
    videoUrl: (d as { videoUrl?: string }).videoUrl,
    resourceLinkUrl: (d as { resourceLinkUrl?: string }).resourceLinkUrl,
    linkedAssignmentId: d.linkedAssignmentId,
    version: d.version,
    versionSnapshots: snapshots,
    status: d.status,
    createdBy: d.createdBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function updateModule(
  id: string,
  input: UpdateModuleInput,
  performedBy: string
) {
  const existing = await findModuleByParam(id);
  if (!existing) throw new AppError("Module not found", 404);
  if (existing.status === MODULE_STATUS.ARCHIVED) {
    throw new AppError("Cannot update an archived module", 400);
  }

  const shouldBumpVersion = contentChanged(existing, input);
  const newVersion = shouldBumpVersion ? nextVersion(existing.version) : existing.version;
  if (newVersion < existing.version) throw new AppError("Version cannot decrease", 400);

  if (shouldBumpVersion) {
    const snapshots = (existing as { versionSnapshots?: Array<{ version: number; title: string; description: string; content: string; youtubeUrl?: string; videoUrl?: string; resourceLinkUrl?: string; linkedAssignmentId?: string; savedAt: Date; savedBy?: string }> }).versionSnapshots ?? [];
    snapshots.push({
      version: existing.version,
      title: existing.title,
      description: existing.description,
      content: existing.content,
      youtubeUrl: existing.youtubeUrl ?? undefined,
      videoUrl: (existing as { videoUrl?: string }).videoUrl ?? undefined,
      resourceLinkUrl: (existing as { resourceLinkUrl?: string }).resourceLinkUrl ?? undefined,
      linkedAssignmentId: existing.linkedAssignmentId ?? undefined,
      savedAt: new Date(),
      savedBy: performedBy,
    });
    (existing as { versionSnapshots: typeof snapshots }).versionSnapshots = snapshots.slice(-MAX_VERSION_SNAPSHOTS);
  }

  existing.title = input.title !== undefined ? input.title.trim() : existing.title;
  existing.description = input.description !== undefined ? input.description.trim() : existing.description;
  existing.content = input.content !== undefined ? input.content : existing.content;
  existing.youtubeUrl = input.youtubeUrl !== undefined ? input.youtubeUrl.trim() || undefined : existing.youtubeUrl;
  (existing as { videoUrl?: string }).videoUrl = input.videoUrl !== undefined ? input.videoUrl.trim() || undefined : (existing as { videoUrl?: string }).videoUrl;
  (existing as { resourceLinkUrl?: string }).resourceLinkUrl = input.resourceLinkUrl !== undefined ? input.resourceLinkUrl.trim() || undefined : (existing as { resourceLinkUrl?: string }).resourceLinkUrl;
  existing.linkedAssignmentId = input.linkedAssignmentId !== undefined ? input.linkedAssignmentId || undefined : existing.linkedAssignmentId;
  existing.version = newVersion;
  await existing.save();

  await createAuditLog("MODULE_UPDATED", performedBy, ENTITY, String(existing._id));

  return {
    id: String(existing._id),
    moduleId: (existing as { moduleId?: string }).moduleId,
    title: existing.title,
    description: existing.description,
    content: existing.content,
    youtubeUrl: existing.youtubeUrl,
    videoUrl: (existing as { videoUrl?: string }).videoUrl,
    resourceLinkUrl: (existing as { resourceLinkUrl?: string }).resourceLinkUrl,
    linkedAssignmentId: existing.linkedAssignmentId,
    version: existing.version,
    status: existing.status,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  };
}

export async function archiveModule(id: string, performedBy: string) {
  const existing = await findModuleByParam(id);
  if (!existing) throw new AppError("Module not found", 404);
  const doc = await GlobalModuleModel.findByIdAndUpdate(
    existing._id,
    { status: MODULE_STATUS.ARCHIVED },
    { new: true }
  ).exec();
  if (!doc) throw new AppError("Module not found", 404);
  await createAuditLog("MODULE_ARCHIVED", performedBy, ENTITY, String(doc._id));
  return {
    id: String(doc._id),
    moduleId: (doc as { moduleId?: string }).moduleId,
    title: doc.title,
    description: doc.description,
    version: doc.version,
    status: doc.status,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function restoreVersionCopy(id: string, version: number, performedBy: string) {
  const existing = await findModuleByParam(id);
  if (!existing) throw new AppError("Module not found", 404);
  if (existing.status === MODULE_STATUS.ARCHIVED) {
    throw new AppError("Cannot restore version of an archived module", 400);
  }
  const snapshots = (existing as { versionSnapshots?: VersionSnapshot[] }).versionSnapshots ?? [];
  const snapshot = snapshots.find((s) => s.version === version);
  if (!snapshot) throw new AppError("Version copy not found", 404);

  const nextVer = nextVersion(existing.version);
  snapshots.push({
    version: existing.version,
    title: existing.title,
    description: existing.description,
    content: existing.content,
    youtubeUrl: existing.youtubeUrl ?? undefined,
    videoUrl: (existing as { videoUrl?: string }).videoUrl ?? undefined,
    resourceLinkUrl: (existing as { resourceLinkUrl?: string }).resourceLinkUrl ?? undefined,
    linkedAssignmentId: existing.linkedAssignmentId ?? undefined,
    savedAt: new Date(),
    savedBy: performedBy,
  });
  (existing as { versionSnapshots: VersionSnapshot[] }).versionSnapshots = snapshots.slice(-MAX_VERSION_SNAPSHOTS);
  existing.title = snapshot.title;
  existing.description = snapshot.description;
  existing.content = snapshot.content;
  existing.youtubeUrl = snapshot.youtubeUrl ?? undefined;
  (existing as { videoUrl?: string }).videoUrl = snapshot.videoUrl ?? undefined;
  (existing as { resourceLinkUrl?: string }).resourceLinkUrl = snapshot.resourceLinkUrl ?? undefined;
  existing.linkedAssignmentId = snapshot.linkedAssignmentId ?? undefined;
  existing.version = nextVer;
  await existing.save();

  await createAuditLog("MODULE_UPDATED", performedBy, ENTITY, String(existing._id));
  return getModuleById(id);
}

export async function duplicateModule(id: string, performedBy: string) {
  const source = await findModuleByParam(id);
  if (!source) throw new AppError("Module not found", 404);
  const src = source.toObject ? source.toObject() : source;
  const title = `${(src as { title: string }).title.trim().replace(/\s*\(Copy\)\s*$/i, "")} (Copy)`;
  const moduleId = await generateModuleId();
  const doc = await GlobalModuleModel.create({
    moduleId,
    title,
    description: (src as { description: string }).description,
    content: (src as { content: string }).content,
    youtubeUrl: (src as { youtubeUrl?: string }).youtubeUrl ?? undefined,
    videoUrl: (src as { videoUrl?: string }).videoUrl ?? undefined,
    resourceLinkUrl: (src as { resourceLinkUrl?: string }).resourceLinkUrl ?? undefined,
    linkedAssignmentId: (src as { linkedAssignmentId?: string }).linkedAssignmentId ?? undefined,
    version: 1,
    status: MODULE_STATUS.ACTIVE,
    createdBy: performedBy,
  });
  await createAuditLog("MODULE_DUPLICATED", performedBy, ENTITY, String(doc._id));
  return {
    id: String(doc._id),
    moduleId: (doc as { moduleId?: string }).moduleId,
    title: doc.title,
    description: doc.description,
    content: doc.content,
    youtubeUrl: doc.youtubeUrl,
    videoUrl: (doc as { videoUrl?: string }).videoUrl,
    resourceLinkUrl: (doc as { resourceLinkUrl?: string }).resourceLinkUrl,
    linkedAssignmentId: doc.linkedAssignmentId,
    version: doc.version,
    status: doc.status,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
