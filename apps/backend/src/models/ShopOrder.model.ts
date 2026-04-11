import mongoose, { Schema } from "mongoose";

const shopOrderSchema = new Schema(
  {
    studentId: { type: String, required: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    coinsSpent: { type: Number, required: true },
    source: { type: String, required: true, enum: ["COINS", "PAYMENT"], default: "COINS" },
    couponCode: { type: String, required: false },
  },
  { timestamps: true }
);

shopOrderSchema.index({ studentId: 1, createdAt: -1 });

export const ShopOrderModel = mongoose.model("ShopOrder", shopOrderSchema);
