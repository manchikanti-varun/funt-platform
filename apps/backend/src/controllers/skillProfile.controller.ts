/**
 * Skill profile controller – get skill radar for student.
 */

import type { Request, Response } from "express";
import { calculateSkillProfile } from "../services/skillProfile.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const getMySkillProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await calculateSkillProfile(studentId);
  successRes(res, data);
});

export const getSkillProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const targetStudentId = req.params.studentId ?? req.query.studentId;
  if (!targetStudentId) throw new AppError("studentId is required", 400);
  const userId = getUserId(req);
  const isAdmin = req.user?.roles?.includes(ROLE.ADMIN) || req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (!isAdmin && userId !== targetStudentId) {
    throw new AppError("You can only view your own skill profile", 403);
  }
  const data = await calculateSkillProfile(String(targetStudentId));
  successRes(res, data);
});
