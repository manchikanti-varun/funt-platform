/**
 * Enrollment Mongoose model – aligned with shared Enrollment type.
 */

import mongoose, { Schema } from "mongoose";
import { ENROLLMENT_STATUS } from "@funt-platform/constants";

const enrollmentSchema = new Schema(
  {
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENROLLMENT_STATUS),
      default: ENROLLMENT_STATUS.ACTIVE,
    },
    enrolledAt: { type: Date, required: true, default: Date.now },
    progressTracking: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: false }
);

enrollmentSchema.index({ studentId: 1, batchId: 1 }, { unique: true });

export const EnrollmentModel = mongoose.model("Enrollment", enrollmentSchema);
