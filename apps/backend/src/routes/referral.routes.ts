/**
 * Referral Routes — /api/referral
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import {
  getMyReferralCode,
  redeemReferralCode,
  getMyReferrals,
} from "../services/referral.service.js";

const router = Router();
router.use(authMiddleware);
router.use(requireRoles(ROLE.STUDENT));

// GET /api/referral/my-code — get or create my referral code
router.get("/my-code", asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const data = await getMyReferralCode(userId);
  successRes(res, data);
}));

// POST /api/referral/redeem — use someone else's referral code
router.post("/redeem", asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const { code } = req.body as { code?: string };
  if (!code?.trim()) throw new AppError("Referral code is required", 400);
  const result = await redeemReferralCode(userId, code);
  successRes(res, result);
}));

// GET /api/referral/my-referrals — who did I refer
router.get("/my-referrals", asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const data = await getMyReferrals(userId);
  successRes(res, data);
}));

export const referralRoutes = router;
