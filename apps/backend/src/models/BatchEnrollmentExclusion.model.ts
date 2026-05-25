import mongoose, { Schema } from "mongoose";

/** Admin removed a student from a batch — block demo auto-enroll from re-adding them. */
const batchEnrollmentExclusionSchema = new Schema(
  {
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    excludedBy: { type: String, required: false },
  },
  { timestamps: true }
);

batchEnrollmentExclusionSchema.index({ studentId: 1, batchId: 1 }, { unique: true });

export const BatchEnrollmentExclusionModel = mongoose.model(
  "BatchEnrollmentExclusion",
  batchEnrollmentExclusionSchema
);
