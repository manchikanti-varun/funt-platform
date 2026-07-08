import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { getChatAnalytics } from "../services/chatAnalytics.service.js";

export const getChatAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as "today" | "week" | "month") || "week";
  const data = await getChatAnalytics(period);
  successRes(res, data);
});
