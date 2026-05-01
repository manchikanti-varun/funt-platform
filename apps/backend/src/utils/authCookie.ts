import type { Response } from "express";
import { getEnv } from "../config/env.js";

export type AuthPortal = "admin" | "lms";

/** @deprecated Single cookie before admin/Learn split — cleared on new logins. */
export const AUTH_COOKIE_LEGACY = "funt_auth";
export const AUTH_COOKIE_ADMIN = "funt_auth_admin";
export const AUTH_COOKIE_LMS = "funt_auth_lms";
export const IDLE_COOKIE_ADMIN = "funt_idle_admin";
export const IDLE_COOKIE_LMS = "funt_idle_lms";
/** Short-lived LMS parent “view as child” session after mobile+student verification. */
export const PARENT_DELEGATE_COOKIE = "funt_parent_delegate";

function cookieNameForPortal(portal: AuthPortal): string {
  return portal === "admin" ? AUTH_COOKIE_ADMIN : AUTH_COOKIE_LMS;
}

function idleCookieNameForPortal(portal: AuthPortal): string {
  return portal === "admin" ? IDLE_COOKIE_ADMIN : IDLE_COOKIE_LMS;
}

export function setAuthCookie(res: Response, token: string, maxAgeMs: number, portal: AuthPortal): void {
  const { isProduction } = getEnv();
  const name = cookieNameForPortal(portal);
  res.cookie(name, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

export function clearAuthCookie(res: Response, portal: AuthPortal): void {
  const { isProduction } = getEnv();
  const name = cookieNameForPortal(portal);
  res.clearCookie(name, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
  clearIdleCookie(res, portal);
}

/** Clear the legacy shared cookie (migration / one-time cleanup). */
export function clearLegacyAuthCookie(res: Response): void {
  const { isProduction } = getEnv();
  res.clearCookie(AUTH_COOKIE_LEGACY, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
}

/** When the client sends no Origin (non-browser), clear every session cookie. */
export function clearAllAuthCookies(res: Response): void {
  clearAuthCookie(res, "admin");
  clearAuthCookie(res, "lms");
  clearLegacyAuthCookie(res);
  clearParentDelegateCookie(res);
}

export function setIdleCookie(res: Response, portal: AuthPortal, maxAgeMs: number): void {
  const { isProduction } = getEnv();
  const name = idleCookieNameForPortal(portal);
  res.cookie(name, String(Date.now()), {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

export function clearIdleCookie(res: Response, portal: AuthPortal): void {
  const { isProduction } = getEnv();
  const name = idleCookieNameForPortal(portal);
  res.clearCookie(name, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
}

export function setParentDelegateCookie(res: Response, token: string, maxAgeMs: number): void {
  const { isProduction } = getEnv();
  res.cookie(PARENT_DELEGATE_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

export function clearParentDelegateCookie(res: Response): void {
  const { isProduction } = getEnv();
  res.clearCookie(PARENT_DELEGATE_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
}
