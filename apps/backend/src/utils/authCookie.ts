import type { Response } from "express";
import { getEnv } from "../config/env.js";

export const AUTH_COOKIE_NAME = "funt_auth";

export function setAuthCookie(res: Response, token: string, maxAgeMs: number): void {
  const { isProduction } = getEnv();
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  const { isProduction } = getEnv();
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
}
