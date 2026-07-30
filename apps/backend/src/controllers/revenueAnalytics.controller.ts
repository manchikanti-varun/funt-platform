import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { getRevenueAnalytics } from "../services/revenueAnalytics.service.js";

/** GET /api/admin/analytics/revenue?months=6 */
export const getRevenueAnalyticsHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const months = req.query.months ? Number(req.query.months) : undefined;
  const data = await getRevenueAnalytics({ months });
  successRes(res, data);
});
