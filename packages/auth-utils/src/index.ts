/**
 * @funt-platform/auth-utils
 *
 * Shared authentication utilities used by Admin, LMS, and Backend.
 * Single source of truth for JWT parsing, token expiry, and role helpers.
 */

import { ROLE } from "@funt-platform/constants";

// ─── JWT Payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  username: string;
  roles: string[];
  exp?: number;
  iat?: number;
  tokenVersion?: number;
}

/**
 * Parses a JWT token without cryptographic verification.
 * Suitable for client-side use where the server validates the signature.
 */
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

/**
 * Checks if a JWT payload has expired based on its `exp` claim.
 */
export function isTokenExpired(payload: JwtPayload): boolean {
  if (!payload.exp) return false;
  return payload.exp * 1000 < Date.now();
}

// ─── Role Helpers ─────────────────────────────────────────────────────────────

/**
 * True when the user is a trainer but NOT an admin/super-admin.
 * Used to restrict trainers to read-only in certain admin screens.
 */
export function isTrainerOnly(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  const hasTrainer = roles.includes(ROLE.TRAINER);
  const isStaff = roles.includes(ROLE.ADMIN) || roles.includes(ROLE.SUPER_ADMIN);
  return hasTrainer && !isStaff;
}

/**
 * True when the user has admin-level access (ADMIN or SUPER_ADMIN).
 */
export function isAdminOrAbove(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.includes(ROLE.ADMIN) || roles.includes(ROLE.SUPER_ADMIN);
}

/**
 * True when the user is a student.
 */
export function isStudent(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.includes(ROLE.STUDENT);
}

/**
 * True when the user is a parent.
 */
export function isParent(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.includes(ROLE.PARENT);
}

/**
 * Determines the appropriate portal based on roles.
 * Staff → admin, Support → admin (support uses admin auth cookie), Franchise → admin, Students/Parents → lms.
 */
export function inferPortal(roles: string[]): "admin" | "lms" {
  const staffRoles = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER, ROLE.SUPPORT_AGENT, ROLE.FRANCHISE_ADMIN];
  if (roles.some((r) => staffRoles.includes(r as ROLE))) return "admin";
  return "lms";
}
