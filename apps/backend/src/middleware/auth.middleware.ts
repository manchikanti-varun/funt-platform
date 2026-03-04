
import type { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/User.model.js";
import { verifyToken } from "../utils/jwt.js";
import { getEnv } from "../config/env.js";
import { ACCOUNT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError("Missing or invalid authorization token", 401);
    }

    const { jwtSecret } = getEnv();
    const payload = verifyToken(token, jwtSecret);

    const user = await UserModel.findById(payload.userId).exec();
    if (!user) {
      throw new AppError("User not found", 401);
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
      throw new AppError("Account is suspended or archived", 403);
    }

    req.user = {
      userId: String(user._id),
      funtId: user.funtId,
      roles: user.roles as typeof payload.roles,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError("Invalid or expired token", 401));
  }
}
