import mongoose, { Schema } from "mongoose";

const paymentUpiConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "ACTIVE" },
    upiId: { type: String, required: true },
    receiverName: { type: String, required: true },
    updatedBy: { type: String, required: false },
    updatedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

export const PaymentUpiConfigModel = mongoose.model("PaymentUpiConfig", paymentUpiConfigSchema);
