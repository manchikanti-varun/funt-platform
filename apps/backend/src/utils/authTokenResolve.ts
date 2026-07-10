import type { Request } from "express";
import { ROLE } from "@funt-platform/constants";
import {
  AUTH_COOKIE_ADMIN,
  AUTH_COOKIE_LEGACY,
  AUTH_COOKIE_LMS,
  AUTH_COOKIE_SUPPORT,
  type AuthPortal,
} from "./authCookie.js";
import { getEnv } from "../config/env.js";

function normalizeAlternateOrigins(baseUrl: string): string[] {
  try {
    const u = new URL(baseUrl);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    const origins = new Set<string>();
    origins.add(u.origin);
    if (u.hostname === "localhost") origins.add(`http://127.0.0.1:${port}`);
    if (u.hostname === "127.0.0.1") origins.add(`http://localhost:${port}`);
    return [...origins];
  } catch {
    return [];
  }
}

/** Which frontend is calling the API (used to pick the correct session cookie when both are set). */
export function portalFromRequestOrigin(req: Pick<Request, "headers">): AuthPortal | null {
  const originHeader = req.headers.origin;
  const referer = req.headers.referer;
  let origin = originHeader;
  if (!origin && referer) {
    try {
      origin = new URL(referer).origin;
    } catch {
      origin = undefined;
    }
  }
  if (!origin) return null;
  const { frontendAdminUrl, frontendLmsUrl, frontendSupportUrl } = getEnv();
  const adminOrigins = normalizeAlternateOrigins(frontendAdminUrl);
  const supportOrigins = normalizeAlternateOrigins(frontendSupportUrl);
  const lmsOrigins = normalizeAlternateOrigins(frontendLmsUrl);
  if (adminOrigins.includes(origin)) return "admin";
  if (supportOrigins.includes(origin)) return "support";
  if (lmsOrigins.includes(origin)) return "lms";
  return null;
}

export function inferPortalFromRoles(roles: ROLE[]): AuthPortal {
  if (roles.includes(ROLE.STUDENT) || roles.includes(ROLE.PARENT)) return "lms";
  if (roles.includes(ROLE.SUPPORT_AGENT) && !roles.includes(ROLE.ADMIN) && !roles.includes(ROLE.SUPER_ADMIN)) return "support";
  return "admin";
}

export function resolveAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearer) return bearer;

  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const admin = cookies?.[AUTH_COOKIE_ADMIN];
  const lms = cookies?.[AUTH_COOKIE_LMS];
  const support = cookies?.[AUTH_COOKIE_SUPPORT];
  const legacy = cookies?.[AUTH_COOKIE_LEGACY];

  const portal = portalFromRequestOrigin(req);
  if (portal === "admin") return admin ?? legacy ?? null;
  if (portal === "support") return support ?? legacy ?? null;
  if (portal === "lms") return lms ?? legacy ?? null;

  if (legacy && !admin && !lms && !support) return legacy;
  if (admin && !lms) return admin;
  if (support) return support;
  if (lms && !admin) return lms;
  if (admin && lms) return null;
  return legacy ?? admin ?? lms ?? support ?? null;
}
