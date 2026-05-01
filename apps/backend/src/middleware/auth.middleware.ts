import type { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/User.model.js";
import { verifyToken } from "../utils/jwt.js";
import { getEnv } from "../config/env.js";
import { ACCOUNT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";
import { resolveAuthToken } from "../utils/authTokenResolve.js";
import {
  AUTH_COOKIE_ADMIN,
  AUTH_COOKIE_LMS,
  IDLE_COOKIE_ADMIN,
  IDLE_COOKIE_LMS,
  clearAuthCookie,
  setIdleCookie,
  type AuthPortal,
} from "../utils/authCookie.js";
import { jwtExpiresInToMs } from "../utils/jwtExpires.js";
import { inferPortalFromRoles, portalFromRequestOrigin } from "../utils/authTokenResolve.js";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = resolveAuthToken(req);

    if (!token) {
      throw new AppError("Missing or invalid authorization token", 401);
    }

    const { jwtSecret, idleTimeoutMinutesAdmin, idleTimeoutMinutesLms, jwtExpiresInAdmin, jwtExpiresInLms } = getEnv();
    const payload = verifyToken(token, jwtSecret);
    const user = await UserModel.findById(payload.userId).exec();
    if (!user) {
      throw new AppError("User not found", 401);
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
      throw new AppError("Account is suspended or archived", 403);
    }
    const expectedTokenVersion = Number((user as { tokenVersion?: number }).tokenVersion ?? 0);
    const payloadTokenVersion = Number(payload.tokenVersion ?? 0);
    if (payloadTokenVersion !== expectedTokenVersion) {
      throw new AppError("Session revoked. Please sign in again.", 401);
    }
    const passwordChangedAt = (user as { passwordChangedAt?: Date }).passwordChangedAt;
    if (passwordChangedAt && payload.iat && payload.iat * 1000 < passwordChangedAt.getTime()) {
      throw new AppError("Session expired after password change. Please sign in again.", 401);
    }

    const cookieBag = (req.cookies ?? {}) as Record<string, string | undefined>;
    const hintedPortal = portalFromRequestOrigin(req);
    const portal: AuthPortal = hintedPortal ?? inferPortalFromRoles(payload.roles);
    const authCookieName = portal === "admin" ? AUTH_COOKIE_ADMIN : AUTH_COOKIE_LMS;
    const idleCookieName = portal === "admin" ? IDLE_COOKIE_ADMIN : IDLE_COOKIE_LMS;
    const idleTimeoutMs = (portal === "admin" ? idleTimeoutMinutesAdmin : idleTimeoutMinutesLms) * 60 * 1000;
    const absoluteMaxAgeMs = jwtExpiresInToMs(portal === "admin" ? jwtExpiresInAdmin : jwtExpiresInLms);
    const hasPortalCookie = Boolean(cookieBag[authCookieName]);
    if (hasPortalCookie) {
      const lastSeen = Number(cookieBag[idleCookieName] ?? 0);
      const now = Date.now();
      if (Number.isFinite(lastSeen) && lastSeen > 0 && now - lastSeen > idleTimeoutMs) {
        clearAuthCookie(res, portal);
        throw new AppError("Session expired due to inactivity. Please sign in again.", 401);
      }
      setIdleCookie(res, portal, absoluteMaxAgeMs);
    }

    req.user = {
      userId: String(user._id),
      username: user.username ?? "",
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
