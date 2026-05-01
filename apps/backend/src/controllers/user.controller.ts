
import type { Request, Response } from "express";
import { UserModel } from "../models/User.model.js";
import { getSpendableBalance } from "../services/coinBalance.service.js";
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
  const u = user as {
    username?: string;
    age?: number;
    address?: string;
    grade?: string;
    gradeOther?: string;
    schoolName?: string;
    city?: string;
    studentXp?: number;
    studentLevel?: number;
    funtCoins?: number;
  };
  let spendableCoins = u.funtCoins ?? 0;
  try {
    spendableCoins = await getSpendableBalance(String(user._id));
  } catch {
    spendableCoins = u.funtCoins ?? 0;
  }
  res.status(200).json({
    success: true,
    data: {
      id: String(user._id),
      username: u.username,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      age: u.age,
      address: u.address,
      grade: u.grade,
      gradeOther: u.gradeOther,
      schoolName: u.schoolName,
      city: u.city,
      studentXp: u.studentXp ?? 0,
      studentLevel: u.studentLevel ?? 1,
      funtCoins: spendableCoins,
      roles: user.roles,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...(includeLoginHistory ? { lastLogin, loginHistory: recentLogins } : {}),
    },
  });
});

export const patchMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  const body = req.body as {
    name?: string;
    username?: string;
    email?: string;
    mobile?: string;
    address?: string;
    city?: string;
    schoolName?: string;
    age?: number;
    grade?: string;
    gradeOther?: string;
  };
  if (body.username !== undefined || body.email !== undefined || body.mobile !== undefined) {
    throw new AppError("Username, email, and mobile can only be changed by Admin or Super Admin", 403);
  }
  const allowed: Record<string, unknown> = {};
  if (body.name != null) allowed.name = String(body.name).trim();
  if (body.address != null) allowed.address = String(body.address).trim();
  if (body.city != null) allowed.city = String(body.city).trim();
  if (body.schoolName != null) allowed.schoolName = String(body.schoolName).trim();
  if (body.age !== undefined && body.age !== null) {
    const a = Math.floor(Number(body.age));
    if (!Number.isFinite(a) || a < 7 || a > 120) throw new AppError("Age must be between 7 and 120", 400);
    allowed.age = a;
  }
  if (body.grade !== undefined) allowed.grade = body.grade === null || body.grade === "" ? "" : String(body.grade).trim();
  if (body.gradeOther !== undefined) {
    allowed.gradeOther = body.gradeOther === null || body.gradeOther === "" ? "" : String(body.gradeOther).trim();
  }
  if (Object.keys(allowed).length === 0) throw new AppError("No valid fields to update", 400);
  const user = await UserModel.findByIdAndUpdate(req.user.userId, { $set: allowed }, { new: true })
    .select("-passwordHash -loginHistory")
    .lean()
    .exec();
  if (!user) throw new AppError("User not found", 404);
  res.status(200).json({ success: true, data: user });
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
    .select("username")
    .lean()
    .exec();
  if (!user) throw new AppError("User not found", 404);
  res.status(200).json({ success: true, data: { username: (user as { username?: string }).username ?? "" } });
});
