/**
 * Shared role group constants for route middleware.
 *
 * Use these instead of re-defining role arrays in every route file.
 * Note: Some routes intentionally use subsets (e.g. knowledge admin = SUPER_ADMIN only).
 * Only use these when the standard grouping applies.
 */

import { ROLE } from "@funt-platform/constants";

/** All staff roles: trainers + admins + super admins */
export const STAFF_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER] as const;

/** Admin-level roles only (no trainers) */
export const ADMIN_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN] as const;

/** All authenticated roles */
export const ALL_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER, ROLE.STUDENT, ROLE.PARENT, ROLE.FRANCHISE_ADMIN] as const;

/** Super admin only */
export const SUPER_ADMIN_ONLY = [ROLE.SUPER_ADMIN] as const;

/** Franchise admin role (used in franchise routes) */
export const FRANCHISE_ROLES = [ROLE.FRANCHISE_ADMIN] as const;

/** Admins + franchise admins (for routes accessible to both) */
export const ADMIN_AND_FRANCHISE_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.FRANCHISE_ADMIN] as const;
