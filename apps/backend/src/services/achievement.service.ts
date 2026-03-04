
import { AchievementModel } from "../models/Achievement.model.js";
import { BadgeTypeDefinitionModel } from "../models/BadgeTypeDefinition.model.js";
import { BADGE_TYPE } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

export async function awardBadge(
  studentId: string,
  badgeType: string,
  meta?: Record<string, unknown>
): Promise<{ awarded: boolean }> {
  if (!Object.values(BADGE_TYPE).includes(badgeType as BADGE_TYPE)) {
    throw new AppError("Invalid badge type", 400);
  }
  const existing = await AchievementModel.findOne({ studentId, badgeType }).exec();
  if (existing) return { awarded: false };

  await AchievementModel.create({
    studentId,
    badgeType,
    awardedAt: new Date(),
    meta: meta ?? undefined,
  });
  await createAuditLog("BADGE_AWARDED", studentId, "Achievement", `${studentId}:${badgeType}`);
  return { awarded: true };
}

export async function ensureFirstAssignmentBadge(studentId: string): Promise<void> {
  await awardBadge(studentId, BADGE_TYPE.FIRST_ASSIGNMENT_SUBMITTED);
}

export async function ensureFirstCourseCompletedBadge(studentId: string, batchId: string): Promise<void> {
  await awardBadge(studentId, BADGE_TYPE.FIRST_COURSE_COMPLETED, { batchId });
}

export async function ensurePerfectAttendanceMonthBadge(studentId: string, batchId: string, month: string): Promise<void> {
  await awardBadge(studentId, BADGE_TYPE.PERFECT_ATTENDANCE_MONTH, { batchId, month });
}

export async function ensureSevenDayStreakBadge(studentId: string): Promise<void> {
  await awardBadge(studentId, BADGE_TYPE.SEVEN_DAY_STREAK);
}

export async function listBadgeTypeDefinitions() {
  const list = await BadgeTypeDefinitionModel.find({}).lean().exec();
  return list.map((d) => ({
    badgeType: d.badgeType,
    displayName: d.displayName,
    icon: d.icon,
  }));
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
      displayName: def?.displayName ?? d.badgeType.replace(/_/g, " "),
      icon: def?.icon ?? "star",
      awardedAt: d.awardedAt,
      meta: d.meta,
    };
  });
}
