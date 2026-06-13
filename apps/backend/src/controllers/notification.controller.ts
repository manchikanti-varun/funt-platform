import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notification.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

// GET /api/notifications
export const getNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const result = await getNotificationsForUser(userId, page, limit);
  successRes(res, result);
});

// PATCH /api/notifications/:id/read
export const patchMarkRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  await markNotificationRead(req.params.id, userId);
  successRes(res, null, "Notification marked as read");
});

// PATCH /api/notifications/read-all
export const patchMarkAllRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  await markAllNotificationsRead(userId);
  successRes(res, null, "All notifications marked as read");
});
