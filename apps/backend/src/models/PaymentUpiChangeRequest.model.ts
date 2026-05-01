import mongoose, { Schema } from "mongoose";

const paymentUpiChangeRequestSchema = new Schema(
  {
    requestedBy: { type: String, required: true, index: true },
    proposedUpiId: { type: String, required: true },
    proposedReceiverName: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, required: true, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING", index: true },
    reviewedBy: { type: String, required: false },
    reviewedAt: { type: Date, required: false },
    rejectReason: { type: String, required: false },
  },
  { timestamps: true }
);

paymentUpiChangeRequestSchema.index({ createdAt: -1 });

export const PaymentUpiChangeRequestModel = mongoose.model("PaymentUpiChangeRequest", paymentUpiChangeRequestSchema);
