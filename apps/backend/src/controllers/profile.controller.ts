/**
 * Profile controller – lookup user profile for admin dashboard.
 */

import type { Request, Response } from "express";
import * as profileService from "../services/profile.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

/** GET /api/profile/lookup?q=userIdOrFuntId – admin: students only; super admin: any user. */
export const lookupProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  const q = (req.query.q as string)?.trim();
  if (!q) throw new AppError("Query parameter 'q' (FUNT ID) is required", 400);
  const isSuperAdmin = req.user.roles?.includes(ROLE.SUPER_ADMIN) ?? false;
  const data = await profileService.getProfileForAdmin(q, isSuperAdmin);
  successRes(res, data);
});
