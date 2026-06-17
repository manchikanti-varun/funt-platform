import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import { getProfileForAdmin } from "../services/profile.service.js";

function redactProfileForParentView<T extends { user?: { email?: string; mobile?: string } }>(payload: T): T {
  if (!payload.user) return payload;
  return {
    ...payload,
    user: {
      ...payload.user,
      email: "",
      mobile: "",
    },
  };
}

export const getParentStudentProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentUserId = req.parentDelegateStudentId;
  if (!studentUserId?.trim()) {
    throw new AppError("Parent session required", 401);
  }
  const raw = await getProfileForAdmin(studentUserId.trim(), false);
  const data = redactProfileForParentView(raw);
  successRes(res, data);
});
