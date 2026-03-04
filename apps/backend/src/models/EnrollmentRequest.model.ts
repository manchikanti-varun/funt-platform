

import mongoose, { Schema } from "mongoose";

const enrollmentRequestSchema = new Schema(
  {
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    requestedAt: { type: Date, required: true, default: Date.now },
    respondedAt: { type: Date, required: false },
    respondedBy: { type: String, required: false },
  },
  { timestamps: true }
);

enrollmentRequestSchema.index({ batchId: 1, studentId: 1 }, { unique: true });
enrollmentRequestSchema.index({ batchId: 1, status: 1 });
enrollmentRequestSchema.index({ studentId: 1 });

export const EnrollmentRequestModel = mongoose.model("EnrollmentRequest", enrollmentRequestSchema);
