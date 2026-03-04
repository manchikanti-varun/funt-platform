
import type { Request, Response } from "express";
import { listAchievements, listBadgeTypeDefinitions } from "../services/achievement.service.js";
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
