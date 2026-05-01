import mongoose, { Schema } from "mongoose";

const couponRedemptionSchema = new Schema(
  {
    couponId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    context: { type: String, required: true, default: "default" },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ couponId: 1, studentId: 1, context: 1 }, { unique: true });

export const CouponRedemptionModel = mongoose.model("CouponRedemption", couponRedemptionSchema);
