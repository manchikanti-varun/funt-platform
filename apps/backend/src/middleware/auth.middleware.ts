import type { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/User.model.js";
import { verifyToken } from "../utils/jwt.js";
import { getEnv } from "../config/env.js";
import { ACCOUNT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";
import { resolveAuthToken } from "../utils/authTokenResolve.js";
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from "../utils/cache.js";
import {
  AUTH_COOKIE_ADMIN,
  AUTH_COOKIE_LMS,
  AUTH_COOKIE_SUPPORT,
  IDLE_COOKIE_ADMIN,
  IDLE_COOKIE_LMS,
  IDLE_COOKIE_SUPPORT,
  clearAllAuthCookies,
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

    // Try cache first, fall back to DB
    const cacheKey = CACHE_KEYS.user(payload.userId);
    let user = await cacheGet<{
      _id: string;
      username?: string;
      roles: string[];
      status: string;
      tokenVersion?: number;
      passwordChangedAt?: string;
    }>(cacheKey);

    if (!user) {
      const dbUser = await UserModel.findById(payload.userId).exec();
      if (!dbUser) {
        throw new AppError("User not found", 401);
      }
      user = {
        _id: String(dbUser._id),
        username: dbUser.username ?? "",
        roles: dbUser.roles as string[],
        status: dbUser.status as string,
        tokenVersion: (dbUser as { tokenVersion?: number }).tokenVersion,
        passwordChangedAt: (dbUser as { passwordChangedAt?: Date }).passwordChangedAt?.toISOString(),
      };
      await cacheSet(cacheKey, user, CACHE_TTL.USER);
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
      if (user.status === "INACTIVE") {
        throw new AppError("Your account has been marked as inactive. Please contact support or request reactivation.", 403);
      }
      if (user.status === "BANNED") {
        throw new AppError("Your account has been banned. Please contact support for assistance.", 403);
      }
      if (user.status === "PENDING_VERIFICATION") {
        throw new AppError("Your account is pending verification. Please complete the verification process.", 403);
      }
      throw new AppError("Account is suspended or archived", 403);
    }
    const expectedTokenVersion = Number(user.tokenVersion ?? 0);
    const payloadTokenVersion = Number(payload.tokenVersion ?? 0);
    if (payloadTokenVersion !== expectedTokenVersion) {
      clearAllAuthCookies(res);
      throw new AppError("Session expired. You logged in from another device.", 401);
    }
    const passwordChangedAt = user.passwordChangedAt ? new Date(user.passwordChangedAt) : undefined;
    if (passwordChangedAt && payload.iat && payload.iat * 1000 < passwordChangedAt.getTime()) {
      throw new AppError("Session expired after password change. Please sign in again.", 401);
    }

    const cookieBag = (req.cookies ?? {}) as Record<string, string | undefined>;
    const hintedPortal = portalFromRequestOrigin(req);
    const portal: AuthPortal = hintedPortal ?? inferPortalFromRoles(payload.roles);
    const authCookieName = portal === "support" ? AUTH_COOKIE_SUPPORT : portal === "admin" ? AUTH_COOKIE_ADMIN : AUTH_COOKIE_LMS;
    const idleCookieName = portal === "support" ? IDLE_COOKIE_SUPPORT : portal === "admin" ? IDLE_COOKIE_ADMIN : IDLE_COOKIE_LMS;
    const idleTimeoutMs = (portal === "lms" ? idleTimeoutMinutesLms : idleTimeoutMinutesAdmin) * 60 * 1000;
    const absoluteMaxAgeMs = jwtExpiresInToMs(portal === "lms" ? jwtExpiresInLms : jwtExpiresInAdmin);
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
      userId: user._id,
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
