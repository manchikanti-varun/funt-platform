import mongoose, { Schema } from "mongoose";

/**
 * Referral — tracks student referral codes and redemptions.
 *
 * Each student gets a unique referral code.
 * When a new student signs up with a referral code, both get rewarded.
 */
const referralSchema = new Schema(
  {
    /** The student who owns this referral code */
    referrerId: { type: String, required: true, unique: true },
    /** Unique referral code (e.g., "FUNT-ARJUN-7X2K") */
    code: { type: String, required: true, unique: true },
    /** Total number of successful referrals */
    totalReferrals: { type: Number, required: true, default: 0 },
    /** Total coins earned from referrals */
    totalCoinsEarned: { type: Number, required: true, default: 0 },
    /** Total XP earned from referrals */
    totalXpEarned: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

referralSchema.index({ code: 1 }, { unique: true });

export const ReferralModel = mongoose.model("Referral", referralSchema);

/**
 * ReferralRedemption — records each time a referral code is used.
 */
const referralRedemptionSchema = new Schema(
  {
    /** The referral code used */
    code: { type: String, required: true },
    /** Student who owns the referral code (referrer) */
    referrerId: { type: String, required: true },
    /** Student who used the code (referee / new student) */
    refereeId: { type: String, required: true },
    /** Coins awarded to referrer */
    referrerCoinsAwarded: { type: Number, required: true, default: 0 },
    /** XP awarded to referrer */
    referrerXpAwarded: { type: Number, required: true, default: 0 },
    /** Coins awarded to referee (welcome bonus) */
    refereeCoinsAwarded: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

referralRedemptionSchema.index({ referrerId: 1 });
referralRedemptionSchema.index({ refereeId: 1 }, { unique: true }); // Each student can only use one referral code
referralRedemptionSchema.index({ code: 1 });

export const ReferralRedemptionModel = mongoose.model("ReferralRedemption", referralRedemptionSchema);
