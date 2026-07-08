/**
 * Referral Service — manage referral codes, redemptions, and rewards.
 */

import crypto from "crypto";
import { ReferralModel, ReferralRedemptionModel } from "../models/Referral.model.js";
import { UserModel } from "../models/User.model.js";
import { AppError } from "../utils/AppError.js";

// Reward configuration
const REFERRER_COINS = 50;
const REFERRER_XP = 100;
const REFEREE_COINS = 25; // Welcome bonus for new student

function generateCode(name: string): string {
  const cleanName = name.replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 5) || "FUNT";
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `FUNT-${cleanName}-${random}`;
}

/**
 * Get or create a referral code for a student.
 */
export async function getMyReferralCode(studentId: string) {
  let referral = await ReferralModel.findOne({ referrerId: studentId }).lean().exec();
  if (referral) {
    return {
      code: referral.code,
      totalReferrals: referral.totalReferrals,
      totalCoinsEarned: referral.totalCoinsEarned,
      totalXpEarned: referral.totalXpEarned,
    };
  }

  // Create new referral code
  const user = await UserModel.findById(studentId).select("name").lean().exec();
  const name = (user as { name?: string })?.name ?? "STUDENT";

  // Try generating unique code (up to 5 attempts)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(name);
    try {
      referral = await ReferralModel.create({ referrerId: studentId, code });
      return { code: referral.code, totalReferrals: 0, totalCoinsEarned: 0, totalXpEarned: 0 };
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) continue;
      throw err;
    }
  }
  throw new AppError("Failed to generate unique referral code", 500);
}

/**
 * Redeem a referral code (called during student signup or from a dedicated page).
 */
export async function redeemReferralCode(refereeId: string, code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) throw new AppError("Referral code is required", 400);

  // Check if referee already used a code
  const existing = await ReferralRedemptionModel.findOne({ refereeId }).lean().exec();
  if (existing) throw new AppError("You have already used a referral code", 400);

  // Find the referral
  const referral = await ReferralModel.findOne({ code: trimmed }).exec();
  if (!referral) throw new AppError("Invalid referral code", 400);

  // Can't refer yourself
  if (referral.referrerId === refereeId) {
    throw new AppError("You cannot use your own referral code", 400);
  }

  // Create redemption record
  await ReferralRedemptionModel.create({
    code: trimmed,
    referrerId: referral.referrerId,
    refereeId,
    referrerCoinsAwarded: REFERRER_COINS,
    referrerXpAwarded: REFERRER_XP,
    refereeCoinsAwarded: REFEREE_COINS,
  });

  // Update referral stats
  referral.totalReferrals += 1;
  referral.totalCoinsEarned += REFERRER_COINS;
  referral.totalXpEarned += REFERRER_XP;
  await referral.save();

  // Award coins and XP to referrer
  await UserModel.updateOne(
    { _id: referral.referrerId },
    { $inc: { funtCoins: REFERRER_COINS, studentXp: REFERRER_XP } }
  ).exec();

  // Award welcome bonus to referee
  await UserModel.updateOne(
    { _id: refereeId },
    { $inc: { funtCoins: REFEREE_COINS } }
  ).exec();

  return {
    referrerCoins: REFERRER_COINS,
    referrerXp: REFERRER_XP,
    refereeCoins: REFEREE_COINS,
    message: `Referral code applied! You received ${REFEREE_COINS} FUNT Coins as a welcome bonus.`,
  };
}

/**
 * Get referral history for a student (who they referred).
 */
export async function getMyReferrals(studentId: string) {
  const redemptions = await ReferralRedemptionModel.find({ referrerId: studentId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
    .exec();

  const refereeIds = redemptions.map((r) => r.refereeId);
  const users = refereeIds.length > 0
    ? await UserModel.find({ _id: { $in: refereeIds } }).select("name username").lean().exec()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return redemptions.map((r) => {
    const user = userMap.get(r.refereeId);
    return {
      refereeId: r.refereeId,
      refereeName: (user as { name?: string })?.name ?? "Student",
      refereeUsername: (user as { username?: string })?.username ?? "",
      coinsEarned: r.referrerCoinsAwarded,
      xpEarned: r.referrerXpAwarded,
      redeemedAt: (r as { createdAt?: Date }).createdAt,
    };
  });
}
