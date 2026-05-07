
import type { Request, Response } from "express";
import { overrideProgress } from "../services/progressOverride.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const overrideProgressHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const performedBy = getUserId(req);
  const { studentId, batchId, chapterOrder, moduleOrder, reason } = req.body ?? {};
  const resolvedChapterOrder = chapterOrder ?? moduleOrder;
  if (!studentId || !batchId || resolvedChapterOrder === undefined) {
    throw new AppError("studentId, batchId, chapterOrder are required", 400);
  }
  const data = await overrideProgress({
    studentId,
    batchId,
    chapterOrder: Number(resolvedChapterOrder),
    reason: reason ?? "Manual override",
    performedBy,
  });
  successRes(res, data, "Progress overridden");
});
