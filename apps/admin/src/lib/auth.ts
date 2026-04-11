import { ROLE } from "@funt-platform/constants";

export interface JwtPayload {
  userId: string;
  username: string;
  roles: string[];
  exp?: number;
}

/** True when the user is a trainer but not admin/super-admin (read-only in some admin screens). */
export function isTrainerOnly(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  const hasTrainer = roles.includes(ROLE.TRAINER);
  const isStaff = roles.includes(ROLE.ADMIN) || roles.includes(ROLE.SUPER_ADMIN);
  return hasTrainer && !isStaff;
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
