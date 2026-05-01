import type { Request, Response, NextFunction } from "express";
import { getEnv } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { verifyParentDelegateToken } from "../utils/parentDelegateJwt.js";
import { PARENT_DELEGATE_COOKIE } from "../utils/authCookie.js";

export function parentDelegateAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const raw = req.cookies?.[PARENT_DELEGATE_COOKIE]?.trim();
    if (!raw) {
      throw new AppError("Parent session required", 401);
    }
    const { jwtSecret } = getEnv();
    const { studentUserId } = verifyParentDelegateToken(raw, jwtSecret);
    req.parentDelegateStudentId = studentUserId;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError("Invalid or expired parent session", 401));
  }
}
