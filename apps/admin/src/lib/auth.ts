/**
 * Auth helpers – decode JWT payload for role (client-side only, not for verification).
 */

import { ROLE } from "@funt-platform/constants";

export interface JwtPayload {
  userId: string;
  funtId: string;
  roles: string[];
  exp?: number;
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: JwtPayload): boolean {
  if (!payload.exp) return false;
  return payload.exp * 1000 < Date.now();
}

/** True if user is trainer and not admin/super admin (read-only content, can edit assigned batches only). */
export function isTrainerOnly(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.includes(ROLE.TRAINER) && !roles.includes(ROLE.ADMIN) && !roles.includes(ROLE.SUPER_ADMIN);
}
