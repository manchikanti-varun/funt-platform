
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
    accessBlocked: { type: Boolean, required: false, default: false },
    /** Batch-scoped course access overrides: key=courseId in this batch snapshot, value=true means blocked */
    courseAccessBlocked: { type: Map, of: Boolean, required: false, default: {} },
    /** @deprecated Legacy field — progress is tracked in ChapterProgress collection. Retained for migration only. */
    progressTracking: { type: Schema.Types.Mixed, required: false, select: false },

    // ── Learning Plan fields ────────────────────────────────────────────
    /** true when this enrollment uses the Learning Plan delivery mode */
    learningPlanActive:       { type: Boolean, required: false, default: false },
    /** milestoneId of the milestone the student is currently working on */
    currentMilestoneId:       { type: String, required: false },
    /** milestoneId of the next milestone the student is eligible to unlock */
    nextEligibleMilestoneId:  { type: String, required: false },
  },
  { timestamps: false }
);

enrollmentSchema.index({ studentId: 1, batchId: 1 }, { unique: true });
enrollmentSchema.index({ batchId: 1, status: 1 });
enrollmentSchema.index({ status: 1 });

export const EnrollmentModel = mongoose.model("Enrollment", enrollmentSchema);
