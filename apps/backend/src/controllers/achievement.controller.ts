
import type { Request, Response } from "express";
import {
  awardBadgeByAdmin,
  createBadgeDefinition,
  listAchievements,
  listBadgeDefinitionsForAdmin,
  listBadgeTypeDefinitions,
  updateBadgeDefinition,
} from "../services/achievement.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const getMyAchievements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await listAchievements(studentId);
  successRes(res, data);
});

export const getBadgeTypes = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await listBadgeTypeDefinitions();
  successRes(res, data);
});

export const getBadgeDefinitionsForAdmin = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await listBadgeDefinitionsForAdmin();
  successRes(res, data);
});

export const postCreateBadgeDefinition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = getUserId(req);
  const {
    badgeType,
    displayName,
    icon,
    description,
    imageUrl,
    isActive,
    awardMode,
    autoTrigger,
  } = req.body ?? {};
  const data = await createBadgeDefinition(
    { badgeType, displayName, icon, description, imageUrl, isActive, awardMode, autoTrigger },
    actorId
  );
  successRes(res, data, "Badge created", 201);
});

export const patchBadgeDefinition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = getUserId(req);
  const badgeType = req.params.badgeType;
  if (!badgeType) throw new AppError("badgeType is required", 400);
  const {
    displayName,
    icon,
    description,
    imageUrl,
    isActive,
    awardMode,
    autoTrigger,
  } = req.body ?? {};
  const data = await updateBadgeDefinition(
    badgeType,
    { displayName, icon, description, imageUrl, isActive, awardMode, autoTrigger },
    actorId
  );
  successRes(res, data, "Badge updated");
});

export const postAwardBadgeByAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = getUserId(req);
  const { studentId, badgeType, meta } = req.body ?? {};
  if (!studentId || !badgeType) throw new AppError("studentId and badgeType are required", 400);
  const data = await awardBadgeByAdmin(String(studentId), String(badgeType), actorId, meta as Record<string, unknown> | undefined);
  successRes(res, data, data.awarded ? "Badge awarded" : "Badge already exists");
});

export const getUserAchievementsForAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = req.params.userId;
  if (!studentId) throw new AppError("userId is required", 400);
  const data = await listAchievements(studentId);
  successRes(res, data);
});
