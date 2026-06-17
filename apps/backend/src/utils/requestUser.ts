/**
 * Shared request user helpers.
 *
 * Extracts the authenticated user's ID and roles from the request object.
 * Used across all controllers — eliminates the 21× copy-pasted getUserId helper.
 */

import type { Request } from "express";
import { AppError } from "./AppError.js";

/** Get the authenticated user's ID or throw 401. */
export function getUserId(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new AppError("Unauthorized", 401);
  return id;
}

/** Alias for getUserId — shorter name used in some controllers. */
export const uid = getUserId;

/** Get the authenticated user's roles (empty array if not set). */
export function getUserRoles(req: Request): string[] {
  return req.user?.roles ?? [];
}
