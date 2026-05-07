
import mongoose, { Schema } from "mongoose";

const chapterProgressSchema = new Schema(
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

chapterProgressSchema.pre("validate", function (next) {
  const doc = this as { moduleOrder?: number; chapterOrder?: number };
  if ((doc.moduleOrder == null || Number.isNaN(Number(doc.moduleOrder))) && doc.chapterOrder != null) {
    doc.moduleOrder = Number(doc.chapterOrder);
  }
  next();
});

chapterProgressSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: { moduleOrder?: number; chapterOrder?: number }) => {
    if (ret.chapterOrder == null && ret.moduleOrder != null) ret.chapterOrder = ret.moduleOrder;
    return ret;
  },
});

chapterProgressSchema.index({ studentId: 1, batchId: 1, courseId: 1, moduleOrder: 1 }, { unique: true });

export const ChapterProgressModel = mongoose.model("ChapterProgress", chapterProgressSchema);
export const ModuleProgressModel = ChapterProgressModel;
