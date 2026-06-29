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
  const { isProduction, corsOrigins } = getEnv();
  const name = cookieNameForPortal(portal);

  // In production, set domain to the shared parent domain (e.g. ".funt.in")
  // so that cookies set by api.funt.in are sent to learn.funt.in / admin.funt.in.
  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const parts = new URL(corsOrigins[0]).hostname.split(".");
      if (parts.length >= 2) domain = `.${parts.slice(-2).join(".")}`;
    } catch { /* fallback: no domain */ }
  }

  res.cookie(name, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

export function clearAuthCookie(res: Response, portal: AuthPortal): void {
  const { isProduction, corsOrigins } = getEnv();
  const name = cookieNameForPortal(portal);

  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const parts = new URL(corsOrigins[0]).hostname.split(".");
      if (parts.length >= 2) domain = `.${parts.slice(-2).join(".")}`;
    } catch { /* fallback */ }
  }

  res.clearCookie(name, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    ...(domain ? { domain } : {}),
  });
  clearIdleCookie(res, portal);
}

/** Clear the legacy shared cookie (migration / one-time cleanup). */
export function clearLegacyAuthCookie(res: Response): void {
  const { isProduction, corsOrigins } = getEnv();

  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const parts = new URL(corsOrigins[0]).hostname.split(".");
      if (parts.length >= 2) domain = `.${parts.slice(-2).join(".")}`;
    } catch { /* fallback */ }
  }

  res.clearCookie(AUTH_COOKIE_LEGACY, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    ...(domain ? { domain } : {}),
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
  const { isProduction, corsOrigins } = getEnv();
  const name = idleCookieNameForPortal(portal);

  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const parts = new URL(corsOrigins[0]).hostname.split(".");
      if (parts.length >= 2) domain = `.${parts.slice(-2).join(".")}`;
    } catch { /* fallback */ }
  }

  res.cookie(name, String(Date.now()), {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

export function clearIdleCookie(res: Response, portal: AuthPortal): void {
  const { isProduction, corsOrigins } = getEnv();
  const name = idleCookieNameForPortal(portal);

  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const parts = new URL(corsOrigins[0]).hostname.split(".");
      if (parts.length >= 2) domain = `.${parts.slice(-2).join(".")}`;
    } catch { /* fallback */ }
  }

  res.clearCookie(name, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    ...(domain ? { domain } : {}),
  });
}

export function setParentDelegateCookie(res: Response, token: string, maxAgeMs: number): void {
  const { isProduction, corsOrigins } = getEnv();

  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const parts = new URL(corsOrigins[0]).hostname.split(".");
      if (parts.length >= 2) domain = `.${parts.slice(-2).join(".")}`;
    } catch { /* fallback */ }
  }

  res.cookie(PARENT_DELEGATE_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

export function clearParentDelegateCookie(res: Response): void {
  const { isProduction, corsOrigins } = getEnv();

  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const parts = new URL(corsOrigins[0]).hostname.split(".");
      if (parts.length >= 2) domain = `.${parts.slice(-2).join(".")}`;
    } catch { /* fallback */ }
  }

  res.clearCookie(PARENT_DELEGATE_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    ...(domain ? { domain } : {}),
  });
}
