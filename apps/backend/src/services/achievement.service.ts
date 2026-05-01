
import { AchievementModel } from "../models/Achievement.model.js";
import { BadgeTypeDefinitionModel } from "../models/BadgeTypeDefinition.model.js";
import { BADGE_TYPE } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

type AwardMode = "MANUAL" | "AUTO" | "BOTH";
type AutoTrigger = "FIRST_ASSIGNMENT_COMPLETED" | "FIRST_COURSE_COMPLETED" | "FIRST_MODULE_COMPLETED";

const LEGACY_BADGE_META: Record<string, { displayName: string; icon: string; autoTrigger?: AutoTrigger }> = {
  [BADGE_TYPE.FIRST_ASSIGNMENT_SUBMITTED]: {
    displayName: "First Assignment Submitted",
    icon: "award",
    autoTrigger: "FIRST_ASSIGNMENT_COMPLETED",
  },
  [BADGE_TYPE.FIRST_COURSE_COMPLETED]: {
    displayName: "First Course Completed",
    icon: "trophy",
    autoTrigger: "FIRST_COURSE_COMPLETED",
  },
  [BADGE_TYPE.SEVEN_DAY_STREAK]: {
    displayName: "Seven Day Streak",
    icon: "flame",
  },
  [BADGE_TYPE.PERFECT_ATTENDANCE_MONTH]: {
    displayName: "Perfect Attendance (Month)",
    icon: "calendar-check",
  },
  FIRST_MODULE_COMPLETED: {
    displayName: "First Module Completed",
    icon: "book-open",
    autoTrigger: "FIRST_MODULE_COMPLETED",
  },
};

function sanitizeBadgeType(input: string): string {
  const out = String(input ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!out) throw new AppError("badgeType is required", 400);
  if (out.length > 80) throw new AppError("badgeType must be <= 80 chars", 400);
  return out;
}

function normalizeAwardMode(raw: unknown): AwardMode {
  const v = String(raw ?? "MANUAL").trim().toUpperCase();
  if (v === "AUTO" || v === "BOTH" || v === "MANUAL") return v;
  throw new AppError("awardMode must be MANUAL, AUTO, or BOTH", 400);
}

function normalizeAutoTrigger(raw: unknown): AutoTrigger | undefined {
  if (raw == null || raw === "") return undefined;
  const v = String(raw).trim().toUpperCase();
  if (v === "FIRST_ASSIGNMENT_COMPLETED" || v === "FIRST_COURSE_COMPLETED" || v === "FIRST_MODULE_COMPLETED") {
    return v as AutoTrigger;
  }
  throw new AppError("autoTrigger is invalid", 400);
}

async function getBadgeDefinition(badgeType: string) {
  const key = sanitizeBadgeType(badgeType);
  return BadgeTypeDefinitionModel.findOne({ badgeType: key }).lean().exec();
}

async function ensureCanAward(
  badgeType: string,
  context: "manual" | "auto"
): Promise<void> {
  const key = sanitizeBadgeType(badgeType);
  const def = await getBadgeDefinition(key);
  if (def) {
    const mode = String((def as { awardMode?: string }).awardMode ?? "MANUAL").toUpperCase();
    const active = (def as { isActive?: boolean }).isActive !== false;
    if (!active) throw new AppError("Badge is inactive", 400);
    if (context === "manual" && mode === "AUTO") throw new AppError("Badge is auto-awarded only", 400);
    if (context === "auto" && mode === "MANUAL") throw new AppError("Badge is manual-awarded only", 400);
    return;
  }
  // Backward compatibility for existing fixed badges
  if (!Object.values(BADGE_TYPE).includes(key as BADGE_TYPE)) {
    throw new AppError("Invalid badge type", 400);
  }
}

export async function awardBadge(
  studentId: string,
  badgeType: string,
  meta?: Record<string, unknown>,
  context: "manual" | "auto" = "auto"
): Promise<{ awarded: boolean }> {
  const key = sanitizeBadgeType(badgeType);
  await ensureCanAward(key, context);
  const existing = await AchievementModel.findOne({ studentId, badgeType: key }).exec();
  if (existing) return { awarded: false };

  await AchievementModel.create({
    studentId,
    badgeType: key,
    awardedAt: new Date(),
    meta: meta ?? undefined,
  });
  await createAuditLog("BADGE_AWARDED", studentId, "Achievement", `${studentId}:${key}`);
  return { awarded: true };
}

export async function ensureFirstAssignmentBadge(studentId: string): Promise<void> {
  const defs = await BadgeTypeDefinitionModel.find({
    isActive: true,
    autoTrigger: "FIRST_ASSIGNMENT_COMPLETED",
    awardMode: { $in: ["AUTO", "BOTH"] },
  }).lean().exec();
  if (defs.length > 0) {
    await Promise.all(defs.map((d) => awardBadge(studentId, d.badgeType, undefined, "auto")));
    return;
  }
  await awardBadge(studentId, BADGE_TYPE.FIRST_ASSIGNMENT_SUBMITTED, undefined, "auto");
}

export async function ensureFirstCourseCompletedBadge(studentId: string, batchId: string): Promise<void> {
  const defs = await BadgeTypeDefinitionModel.find({
    isActive: true,
    autoTrigger: "FIRST_COURSE_COMPLETED",
    awardMode: { $in: ["AUTO", "BOTH"] },
  }).lean().exec();
  if (defs.length > 0) {
    await Promise.all(defs.map((d) => awardBadge(studentId, d.badgeType, { batchId }, "auto")));
    return;
  }
  await awardBadge(studentId, BADGE_TYPE.FIRST_COURSE_COMPLETED, { batchId }, "auto");
}

export async function ensureFirstModuleCompletedBadge(studentId: string, batchId: string, moduleOrder: number): Promise<void> {
  const defs = await BadgeTypeDefinitionModel.find({
    isActive: true,
    autoTrigger: "FIRST_MODULE_COMPLETED",
    awardMode: { $in: ["AUTO", "BOTH"] },
  }).lean().exec();
  if (defs.length > 0) {
    await Promise.all(defs.map((d) => awardBadge(studentId, d.badgeType, { batchId, moduleOrder }, "auto")));
    return;
  }
  await awardBadge(studentId, "FIRST_MODULE_COMPLETED", { batchId, moduleOrder }, "auto");
}

export async function ensurePerfectAttendanceMonthBadge(studentId: string, batchId: string, month: string): Promise<void> {
  await awardBadge(studentId, BADGE_TYPE.PERFECT_ATTENDANCE_MONTH, { batchId, month }, "auto");
}

export async function ensureSevenDayStreakBadge(studentId: string): Promise<void> {
  await awardBadge(studentId, BADGE_TYPE.SEVEN_DAY_STREAK, undefined, "auto");
}

export async function listBadgeTypeDefinitions() {
  const list = await BadgeTypeDefinitionModel.find({ isActive: true }).sort({ updatedAt: -1 }).lean().exec();
  const merged = [
    ...Object.entries(LEGACY_BADGE_META)
      .filter(([badgeType]) => !list.some((d) => d.badgeType === badgeType))
      .map(([badgeType, m]) => ({
        badgeType,
        displayName: m.displayName,
        icon: m.icon,
        description: "",
        imageUrl: "",
        isActive: true,
        awardMode: m.autoTrigger ? "AUTO" : "MANUAL",
        autoTrigger: m.autoTrigger,
      })),
    ...list,
  ];
  return merged.map((d) => ({
    badgeType: d.badgeType,
    displayName: d.displayName,
    icon: d.icon,
    description: (d as { description?: string }).description ?? "",
    imageUrl: (d as { imageUrl?: string }).imageUrl ?? "",
    isActive: (d as { isActive?: boolean }).isActive !== false,
    awardMode: (d as { awardMode?: string }).awardMode ?? "MANUAL",
    autoTrigger: (d as { autoTrigger?: string }).autoTrigger ?? undefined,
  }));
}

export async function listBadgeDefinitionsForAdmin() {
  const list = await BadgeTypeDefinitionModel.find({}).sort({ updatedAt: -1 }).lean().exec();
  return list.map((d) => ({
    badgeType: d.badgeType,
    displayName: d.displayName,
    icon: d.icon,
    description: (d as { description?: string }).description ?? "",
    imageUrl: (d as { imageUrl?: string }).imageUrl ?? "",
    isActive: (d as { isActive?: boolean }).isActive !== false,
    awardMode: (d as { awardMode?: string }).awardMode ?? "MANUAL",
    autoTrigger: (d as { autoTrigger?: string }).autoTrigger ?? undefined,
    createdBy: (d as { createdBy?: string }).createdBy ?? undefined,
    updatedBy: (d as { updatedBy?: string }).updatedBy ?? undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export interface UpsertBadgeDefinitionInput {
  badgeType?: string;
  displayName?: string;
  icon?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  awardMode?: string;
  autoTrigger?: string;
}

export async function createBadgeDefinition(input: UpsertBadgeDefinitionInput, actorId: string) {
  const badgeType = sanitizeBadgeType(input.badgeType ?? "");
  const displayName = String(input.displayName ?? "").trim();
  const icon = String(input.icon ?? "").trim() || "award";
  if (!displayName) throw new AppError("displayName is required", 400);
  const awardMode = normalizeAwardMode(input.awardMode);
  const autoTrigger = normalizeAutoTrigger(input.autoTrigger);
  if (awardMode === "AUTO" && !autoTrigger) {
    throw new AppError("autoTrigger is required when awardMode is AUTO", 400);
  }
  const doc = await BadgeTypeDefinitionModel.create({
    badgeType,
    displayName,
    icon,
    description: String(input.description ?? "").trim(),
    imageUrl: String(input.imageUrl ?? "").trim(),
    isActive: input.isActive !== false,
    awardMode,
    autoTrigger,
    createdBy: actorId,
    updatedBy: actorId,
  });
  await createAuditLog("BADGE_AWARDED", actorId, "BadgeTypeDefinition", badgeType);
  return {
    badgeType: doc.badgeType,
    displayName: doc.displayName,
    icon: doc.icon,
    description: (doc as { description?: string }).description ?? "",
    imageUrl: (doc as { imageUrl?: string }).imageUrl ?? "",
    isActive: (doc as { isActive?: boolean }).isActive !== false,
    awardMode: (doc as { awardMode?: string }).awardMode ?? "MANUAL",
    autoTrigger: (doc as { autoTrigger?: string }).autoTrigger ?? undefined,
  };
}

export async function updateBadgeDefinition(badgeType: string, input: UpsertBadgeDefinitionInput, actorId: string) {
  const key = sanitizeBadgeType(badgeType);
  const doc = await BadgeTypeDefinitionModel.findOne({ badgeType: key }).exec();
  if (!doc) throw new AppError("Badge definition not found", 404);
  if (input.displayName !== undefined) {
    const v = String(input.displayName).trim();
    if (!v) throw new AppError("displayName cannot be empty", 400);
    doc.displayName = v;
  }
  if (input.icon !== undefined) doc.icon = String(input.icon).trim() || "award";
  if (input.description !== undefined) (doc as { description?: string }).description = String(input.description).trim();
  if (input.imageUrl !== undefined) (doc as { imageUrl?: string }).imageUrl = String(input.imageUrl).trim();
  if (input.isActive !== undefined) (doc as { isActive?: boolean }).isActive = !!input.isActive;
  if (input.awardMode !== undefined) (doc as { awardMode?: string }).awardMode = normalizeAwardMode(input.awardMode);
  if (input.autoTrigger !== undefined) (doc as { autoTrigger?: string }).autoTrigger = normalizeAutoTrigger(input.autoTrigger);
  const mode = String((doc as { awardMode?: string }).awardMode ?? "MANUAL").toUpperCase();
  const trigger = (doc as { autoTrigger?: string }).autoTrigger;
  if (mode === "AUTO" && !trigger) {
    throw new AppError("autoTrigger is required when awardMode is AUTO", 400);
  }
  (doc as { updatedBy?: string }).updatedBy = actorId;
  await doc.save();
  await createAuditLog("BADGE_AWARDED", actorId, "BadgeTypeDefinition", key);
  return {
    badgeType: doc.badgeType,
    displayName: doc.displayName,
    icon: doc.icon,
    description: (doc as { description?: string }).description ?? "",
    imageUrl: (doc as { imageUrl?: string }).imageUrl ?? "",
    isActive: (doc as { isActive?: boolean }).isActive !== false,
    awardMode: (doc as { awardMode?: string }).awardMode ?? "MANUAL",
    autoTrigger: (doc as { autoTrigger?: string }).autoTrigger ?? undefined,
  };
}

export async function awardBadgeByAdmin(
  studentId: string,
  badgeType: string,
  actorId: string,
  meta?: Record<string, unknown>
): Promise<{ awarded: boolean }> {
  const awarded = await awardBadge(studentId, badgeType, { ...(meta ?? {}), awardedBy: actorId }, "manual");
  if (awarded.awarded) {
    await createAuditLog("BADGE_AWARDED", actorId, "Achievement", `${studentId}:${sanitizeBadgeType(badgeType)}`);
  }
  return awarded;
}

export async function listAchievements(studentId: string) {
  const list = await AchievementModel.find({ studentId }).sort({ awardedAt: -1 }).lean().exec();
  const definitions = await BadgeTypeDefinitionModel.find({}).lean().exec();
  const defMap = new Map(definitions.map((d) => [d.badgeType, d]));

  return list.map((d) => {
    const def = defMap.get(d.badgeType);
    return {
      id: String(d._id),
      studentId: d.studentId,
      badgeType: d.badgeType,
      displayName: def?.displayName ?? LEGACY_BADGE_META[d.badgeType]?.displayName ?? d.badgeType.replace(/_/g, " "),
      icon: def?.icon ?? LEGACY_BADGE_META[d.badgeType]?.icon ?? "star",
      description: (def as { description?: string } | undefined)?.description ?? "",
      imageUrl: (def as { imageUrl?: string } | undefined)?.imageUrl ?? "",
      awardedAt: d.awardedAt,
      meta: d.meta,
    };
  });
}
