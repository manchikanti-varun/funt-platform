/**
 * CSRF Protection Middleware
 *
 * Strategy: Origin/Referer validation + Double-Submit Cookie pattern.
 *
 * How it works:
 * 1. For every authenticated response, the server sets a non-httpOnly CSRF cookie
 *    (`funt_csrf`) containing a random token.
 * 2. For state-changing requests (POST, PUT, PATCH, DELETE), the middleware verifies
 *    that the `X-CSRF-Token` header matches the value in the `funt_csrf` cookie.
 * 3. Additionally, the Origin header (or Referer) must match one of the configured
 *    CORS origins. This blocks cross-origin form submissions.
 *
 * Why not SameSite=Strict?
 * - The platform uses cross-origin cookies (admin on :3000, LMS on :3001, API on :38472).
 * - SameSite=Strict would block legitimate cross-origin requests from the frontends.
 * - SameSite=None is required for the cookie-based auth to work across origins.
 * - Therefore, an explicit CSRF layer is necessary.
 *
 * Exemptions:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - /api/auth/session (token exchange, no existing session)
 * - /api/auth/login (no existing session)
 * - /api/auth/signup (no existing session)
 * - /api/auth/parent-login (no existing session)
 * - /api/auth/parent-linked-students (pre-auth lookup)
 * - /api/auth/parent-delegate-session (mobile-based, rate-limited)
 * - /api/auth/google/* (OAuth flow, state-protected)
 * - /api/public/* (public endpoints)
 * - /verify/* (public verification)
 * - /health (health check)
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { getEnv } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export const CSRF_COOKIE_NAME = "funt_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32; // 32 bytes → 64 hex chars

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Paths exempt from CSRF checks.
 * These are either pre-auth endpoints (no session exists yet) or
 * protected by other mechanisms (OAuth state, rate limiting, etc.).
 */
const EXEMPT_PATH_PREFIXES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/support-signup",
  "/api/auth/session",
  "/api/auth/parent-login",
  "/api/auth/parent-linked-students",
  "/api/auth/parent-delegate-session",
  "/api/auth/parent-delegate-logout",
  "/api/auth/google",
  "/api/auth/forgot-username",
  "/api/public/",
  "/verify/",
  "/health",
];

function isExempt(path: string): boolean {
  const normalized = path.toLowerCase();
  return EXEMPT_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Generates a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Sets the CSRF cookie on the response.
 * This cookie is NOT httpOnly so the frontend JavaScript can read it
 * and include its value in the X-CSRF-Token header.
 *
 * Returns the token value that was set.
 */
export function setCsrfCookie(res: Response, token?: string): string {
  const { isProduction, corsOrigins } = getEnv();
  const csrfToken = token ?? generateCsrfToken();

  // Derive the shared cookie domain from CORS origins so that all subdomains
  // (admin.funt.in, learn.funt.in) can read the CSRF cookie set by api.funt.in.
  let domain: string | undefined;
  if (isProduction && corsOrigins.length > 0) {
    try {
      const firstOrigin = new URL(corsOrigins[0]);
      const parts = firstOrigin.hostname.split(".");
      if (parts.length >= 2) {
        domain = `.${parts.slice(-2).join(".")}`;
      }
    } catch {
      // Fall back to no explicit domain
    }
  }

  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Frontend must read this
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    ...(domain ? { domain } : {}),
  });

  return csrfToken;
}

/**
 * Validates the Origin header against configured CORS origins.
 * Returns true if the origin is allowed or if no Origin is present (non-browser).
 */
function isOriginAllowed(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) {
    // No Origin header — likely a server-to-server call or same-origin.
    // Fall through to double-submit cookie validation.
    return true;
  }
  const { corsOrigins } = getEnv();
  if (corsOrigins.length === 0) return true; // No CORS restriction configured
  return corsOrigins.some((allowed) => {
    try {
      const allowedUrl = new URL(allowed);
      const originUrl = new URL(origin);
      return allowedUrl.origin === originUrl.origin;
    } catch {
      return allowed === origin;
    }
  });
}

/**
 * CSRF protection middleware.
 *
 * Strategy:
 * 1. Origin/Referer validation (primary protection for cross-origin setups)
 * 2. Double-submit cookie (when available — same-origin or cookie-friendly browsers)
 *
 * In cross-origin deployments (admin.funt.in → api.funt.in), third-party cookie
 * restrictions mean the CSRF cookie may not be readable. In that case, the Origin
 * validation alone is sufficient because:
 * - CORS only allows configured origins
 * - Auth cookies are SameSite=None;Secure (only sent to allowed origins)
 * - Browsers always send Origin on cross-origin POST/PUT/PATCH/DELETE
 *
 * Must be applied AFTER cookie-parser and BEFORE route handlers.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods don't need CSRF protection
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    // Ensure CSRF cookie is set for subsequent mutation requests
    const existingToken = (req.cookies as Record<string, string>)?.[CSRF_COOKIE_NAME];
    if (!existingToken) {
      setCsrfCookie(res);
    }
    next();
    return;
  }

  // Check if this path is exempt
  if (isExempt(req.path)) {
    next();
    return;
  }

  // Step 1: Validate Origin header (required for cross-origin requests)
  const origin = req.get("origin");
  const referer = req.get("referer");
  const { corsOrigins, isProduction } = getEnv();

  if (isProduction && corsOrigins.length > 0) {
    // In production with configured CORS, require a valid Origin or Referer
    const requestOrigin = origin ?? (referer ? (() => { try { return new URL(referer).origin; } catch { return undefined; } })() : undefined);

    if (!requestOrigin) {
      // No Origin AND no Referer on a mutation — block it.
      // Legitimate browsers always send Origin on cross-origin requests.
      next(new AppError("CSRF validation failed: missing origin", 403));
      return;
    }

    const allowed = corsOrigins.some((allowedOrigin) => {
      try {
        return new URL(allowedOrigin).origin === requestOrigin;
      } catch {
        return allowedOrigin === requestOrigin;
      }
    });

    if (!allowed) {
      next(new AppError("Request blocked: invalid origin", 403));
      return;
    }

    // Origin is valid — request is from our frontend. This is sufficient CSRF protection.
    next();
    return;
  }

  // Development or no CORS configured: use double-submit cookie (same-origin)
  if (!isOriginAllowed(req)) {
    next(new AppError("Request blocked: invalid origin", 403));
    return;
  }

  const cookieToken = (req.cookies as Record<string, string>)?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);

  // Require both cookie and header for CSRF validation
  if (!cookieToken || !headerToken) {
    next(new AppError("CSRF validation failed: missing token", 403));
    return;
  }

  if (cookieToken.length !== headerToken.length) {
    next(new AppError("CSRF validation failed: token mismatch", 403));
    return;
  }
  const cookieBuf = Buffer.from(cookieToken, "utf8");
  const headerBuf = Buffer.from(headerToken, "utf8");
  if (!crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    next(new AppError("CSRF validation failed: token mismatch", 403));
    return;
  }

  next();
}
