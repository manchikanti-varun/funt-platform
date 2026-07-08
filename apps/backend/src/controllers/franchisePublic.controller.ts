/**
 * Public / Student-facing franchise endpoints.
 * Allows students to link themselves to a franchise via franchise code.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import { FranchiseCenterModel } from "../models/FranchiseCenter.model.js";
import { UserModel } from "../models/User.model.js";
import { FRANCHISE_STATUS } from "@funt-platform/constants";

/**
 * POST /api/student/franchise/link
 * Body: { franchiseCode: "JAIPUR-01" }
 * Links the current student to the franchise center.
 */
export const linkToFranchise = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);

  const { franchiseCode } = req.body as { franchiseCode?: string };
  const code = franchiseCode?.trim().toUpperCase();
  if (!code) throw new AppError("Franchise code is required", 400);

  // Find franchise center
  const center = await FranchiseCenterModel.findOne({ franchiseCode: code }).lean().exec();
  if (!center) throw new AppError("Invalid franchise code. Please check and try again.", 404);
  if (center.status !== FRANCHISE_STATUS.ACTIVE) {
    throw new AppError("This franchise center is not active.", 400);
  }

  // Check if student already linked
  const user = await UserModel.findById(userId).exec();
  if (!user) throw new AppError("User not found", 404);
  if ((user as { franchiseId?: string }).franchiseId) {
    throw new AppError("You are already linked to a franchise center.", 400);
  }

  // Link student to franchise
  await UserModel.updateOne(
    { _id: userId },
    { $set: { franchiseId: String(center._id) } }
  ).exec();

  // Increment franchise student count
  await FranchiseCenterModel.updateOne(
    { _id: center._id },
    { $inc: { totalStudents: 1 } }
  ).exec();

  successRes(res, {
    franchiseCode: center.franchiseCode,
    centerName: center.centerName,
    city: center.city,
  }, "Successfully linked to franchise center");
});

/**
 * GET /api/student/franchise/status
 * Returns the student's linked franchise info (if any).
 */
export const getMyFranchiseStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);

  const user = await UserModel.findById(userId).select("franchiseId").lean().exec();
  const franchiseId = (user as { franchiseId?: string })?.franchiseId;

  if (!franchiseId) {
    successRes(res, { linked: false });
    return;
  }

  const center = await FranchiseCenterModel.findById(franchiseId)
    .select("franchiseCode centerName city")
    .lean()
    .exec();

  successRes(res, {
    linked: true,
    franchiseCode: center?.franchiseCode ?? "",
    centerName: center?.centerName ?? "",
    city: center?.city ?? "",
  });
});
