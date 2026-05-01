import mongoose, { Schema } from "mongoose";

const SHOP_ORDER_STATUS = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "ISSUE", "CANCELLED"] as const;

const shopOrderSchema = new Schema(
  {
    studentId: { type: String, required: true },
    items: {
      type: [
        new Schema(
          {
            productId: { type: String, required: true },
            productName: { type: String, required: true },
            quantity: { type: Number, required: true, min: 1 },
            unitPriceCoins: { type: Number, required: true, min: 0 },
            lineTotalCoins: { type: Number, required: true, min: 0 },
          },
          { _id: false }
        ),
      ],
      required: true,
      default: [],
    },
    totalCoins: { type: Number, required: true, min: 0, default: 0 },
    couponDiscountCoins: { type: Number, required: true, min: 0, default: 0 },
    coinsRedeemed: { type: Number, required: true, min: 0, default: 0 },
    payablePaise: { type: Number, required: true, min: 0, default: 0 },
    source: { type: String, required: true, enum: ["COINS", "PAYMENT", "HYBRID"], default: "COINS" },
    couponCode: { type: String, required: false },
    paymentSubmissionId: { type: String, required: false },
    address: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      line1: { type: String, required: true, trim: true },
      line2: { type: String, required: false, trim: true, default: "" },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
    },
    status: { type: String, required: true, enum: SHOP_ORDER_STATUS, default: "CONFIRMED" },
    statusReason: { type: String, required: false, default: "" },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, required: true },
            note: { type: String, required: false },
            actorId: { type: String, required: false },
            at: { type: Date, required: true, default: Date.now },
          },
          { _id: false }
        ),
      ],
      required: false,
      default: [],
    },
  },
  { timestamps: true }
);

shopOrderSchema.index({ studentId: 1, createdAt: -1 });
shopOrderSchema.index({ status: 1, createdAt: -1 });

export const ShopOrderModel = mongoose.model("ShopOrder", shopOrderSchema);
