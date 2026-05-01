import mongoose, { Schema } from "mongoose";

const paymentQrGenerationSchema = new Schema(
  {
    adminId: { type: String, required: true, index: true },
    upiId: { type: String, required: true },
    receiverName: { type: String, required: true },
    amountPaise: { type: Number, required: false, min: 1 },
    prefillAmount: { type: Boolean, required: true, default: true },
    paymentLink: { type: String, required: true },
  },
  { timestamps: true }
);

paymentQrGenerationSchema.index({ createdAt: -1 });

export const PaymentQrGenerationModel = mongoose.model("PaymentQrGeneration", paymentQrGenerationSchema);
