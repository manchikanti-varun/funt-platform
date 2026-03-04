
import mongoose, { Schema } from "mongoose";

const moduleProgressSchema = new Schema(
  {
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
        courseId: { type: String, required: false },
    moduleOrder: { type: Number, required: true },
        completedAt: { type: Date, required: false },
    completedBy: { type: String, required: false },
    isManualOverride: { type: Boolean, required: true, default: false },
    reason: { type: String, required: false },
        contentCompletedAt: { type: Date, required: false },
    videoCompletedAt: { type: Date, required: false },
    youtubeCompletedAt: { type: Date, required: false },
    assignmentCompletedAt: { type: Date, required: false },
  },
  { timestamps: false }
);

moduleProgressSchema.index({ studentId: 1, batchId: 1, courseId: 1, moduleOrder: 1 }, { unique: true });

export const ModuleProgressModel = mongoose.model("ModuleProgress", moduleProgressSchema);
