
import mongoose, { Schema } from "mongoose";
import { CERTIFICATE_STATUS } from "@funt-platform/constants";

const certificateSchema = new Schema(
  {
    certificateId: { type: String, required: true, unique: true },
    studentId: { type: String, required: true },
    courseId: { type: String, required: true },
    batchId: { type: String, required: true },
    issuedAt: { type: Date, required: true, default: Date.now },
    issuedBy: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(CERTIFICATE_STATUS),
      default: CERTIFICATE_STATUS.ISSUED,
    },
  },
  { timestamps: false }
);

certificateSchema.index({ studentId: 1, batchId: 1 }, { unique: true });

export const CertificateModel = mongoose.model("Certificate", certificateSchema);
