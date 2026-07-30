import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import { getBatchAnalytics } from "../services/batchAnalytics.service.js";

/** GET /api/admin/analytics/batch/:batchId */
export const getBatchAnalyticsHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = req.params.batchId;
  if (!batchId) throw new AppError("batchId is required", 400);
  const data = await getBatchAnalytics(batchId);
  successRes(res, data);
});
