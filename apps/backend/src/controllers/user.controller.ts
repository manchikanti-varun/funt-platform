
import type { Request, Response } from "express";
import { UserModel } from "../models/User.model.js";
import { ROLE } from "@funt-platform/constants";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  const includeLoginHistory = req.query.include === "loginHistory";
  const select = includeLoginHistory ? "+loginHistory" : "-passwordHash -loginHistory";
  const user = await UserModel.findById(req.user.userId)
    .select(select)
    .lean()
    .exec();
  if (!user) throw new AppError("User not found", 404);
  const loginHistory = (user as { loginHistory?: Array<{ timestamp: Date; userAgent?: string; ip?: string }> }).loginHistory ?? [];
  const lastLogin = loginHistory.length > 0 ? loginHistory[0] : null;
  const recentLogins = loginHistory.slice(0, 10).map((e) => ({ timestamp: e.timestamp, userAgent: e.userAgent, ip: e.ip }));
  res.status(200).json({
    success: true,
    data: {
      id: String(user._id),
      funtId: user.funtId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      roles: user.roles,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...(includeLoginHistory ? { lastLogin, loginHistory: recentLogins } : {}),
    },
  });
});

export const getQr = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  const targetId = req.params.id;
  const userId = req.user.userId;
  const isAdmin =
    req.user.roles?.includes(ROLE.ADMIN) || req.user.roles?.includes(ROLE.SUPER_ADMIN);
  if (targetId !== userId && !isAdmin) {
    throw new AppError("You can only get QR for your own profile", 403);
  }
  const user = await UserModel.findById(targetId ?? userId)
    .select("funtId")
    .lean()
    .exec();
  if (!user) throw new AppError("User not found", 404);
  res.status(200).json({ success: true, data: { funtId: user.funtId } });
});
