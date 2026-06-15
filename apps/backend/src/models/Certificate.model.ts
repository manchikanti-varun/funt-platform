
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
    coinReward: { type: Number, required: false, default: 0 },
    coinRewardGrantedAt: { type: Date, required: false },
    coinRewardGrantedBy: { type: String, required: false },
    // ── Learning Plan extension ────────────────────────────────────────
    /** When set, this is a milestone certificate (not the full program cert) */
    milestoneId:    { type: String, required: false },
    milestoneTitle: { type: String, required: false },
  },
  { timestamps: false }
);

// Full-program cert: unique per student+batch (legacy constraint kept)
certificateSchema.index({ studentId: 1, batchId: 1, milestoneId: 1 }, { unique: true, sparse: true });
// Keep backward-compatible unique for full-program certs (milestoneId absent)
certificateSchema.index(
  { studentId: 1, batchId: 1 },
  { unique: true, partialFilterExpression: { milestoneId: { $exists: false } } }
);

export const CertificateModel = mongoose.model("Certificate", certificateSchema);
