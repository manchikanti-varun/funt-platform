import mongoose, { Schema } from "mongoose";

const PAYMENT_STATUS = ["PENDING", "VERIFIED", "REJECTED"] as const;
const PAYMENT_KIND = ["COURSE", "SHOP"] as const;

const paymentSubmissionSchema = new Schema(
  {
    kind: { type: String, required: true, enum: PAYMENT_KIND, default: "COURSE" },
    studentId: { type: String, required: true },
    batchId: { type: String, required: false },
    courseId: { type: String, required: false },
    productId: { type: String, required: false },
    transactionId: { type: String, required: true, unique: true },
    paidAt: { type: Date, required: true },
    status: { type: String, required: true, enum: PAYMENT_STATUS, default: "PENDING" },
    verifiedBy: { type: String, required: false },
    verifiedAt: { type: Date, required: false },
    rejectReason: { type: String, required: false },
  },
  { timestamps: true }
);

paymentSubmissionSchema.index({ studentId: 1, batchId: 1, courseId: 1, status: 1 });
paymentSubmissionSchema.index({ studentId: 1, productId: 1, status: 1 });

export const PaymentSubmissionModel = mongoose.model("PaymentSubmission", paymentSubmissionSchema);
