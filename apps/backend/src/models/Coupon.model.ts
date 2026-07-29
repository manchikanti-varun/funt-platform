import mongoose, { Schema } from "mongoose";

const COUPON_KIND = ["COURSE", "SHOP"] as const;
const DISCOUNT_TYPES = ["PERCENT"] as const;
const SHOP_SCOPE = ["ALL_ORDERS", "FIRST_ORDER"] as const;
const COUPON_AUDIENCE = ["ALL_STUDENTS", "BATCH_STUDENTS"] as const;

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    kind: { type: String, required: true, enum: COUPON_KIND },
    courseId: { type: String, required: false },
    batchId: { type: String, required: false },
    audience: { type: String, required: false, enum: COUPON_AUDIENCE },
    shopScope: { type: String, required: false, enum: SHOP_SCOPE, default: "ALL_ORDERS" },
    discountType: { type: String, required: true, enum: DISCOUNT_TYPES },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      validate: {
        validator: function (this: { discountType?: string }, v: number) {
          // PERCENT type must be between 0 and 100
          if (this.discountType === "PERCENT") return v >= 0 && v <= 100;
          return v >= 0;
        },
        message: "Percent discount must be between 0 and 100",
      },
    },
    maxRedemptions: { type: Number, required: false, default: null },
    redemptionCount: { type: Number, required: true, default: 0 },
    perStudentLimit: { type: Number, required: true, default: 1 },
    validFrom: { type: Date, required: false },
    validUntil: { type: Date, required: false },
    active: { type: Boolean, required: true, default: true },
    notes: { type: String, required: false, default: "" },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

couponSchema.index({ kind: 1, active: 1 });
couponSchema.index({ courseId: 1 });
couponSchema.index({ batchId: 1 });

export const CouponModel = mongoose.model("Coupon", couponSchema);
