/**
 * Module progress – completion status per student per module in a batch.
 * Used for unlock logic and manual override.
 */

import mongoose, { Schema } from "mongoose";

const moduleProgressSchema = new Schema(
  {
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    /** Course ID (from batch courseSnapshot.courseId) – required when batch has multiple courses. */
    courseId: { type: String, required: false },
    moduleOrder: { type: Number, required: true },
    /** When the entire module is completed (all required parts done). */
    completedAt: { type: Date, required: false },
    completedBy: { type: String, required: false },
    isManualOverride: { type: Boolean, required: true, default: false },
    reason: { type: String, required: false },
    /** Per-part completion (student marks content/video/youtube; assignment set on admin approval). */
    contentCompletedAt: { type: Date, required: false },
    videoCompletedAt: { type: Date, required: false },
    youtubeCompletedAt: { type: Date, required: false },
    assignmentCompletedAt: { type: Date, required: false },
  },
  { timestamps: false }
);

moduleProgressSchema.index({ studentId: 1, batchId: 1, courseId: 1, moduleOrder: 1 }, { unique: true });

export const ModuleProgressModel = mongoose.model("ModuleProgress", moduleProgressSchema);
