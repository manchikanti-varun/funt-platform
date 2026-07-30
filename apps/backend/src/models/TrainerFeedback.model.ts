import mongoose, { Schema } from "mongoose";

const trainerFeedbackSchema = new Schema(
  {
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    courseId: { type: String, required: true },
    chapterOrder: { type: Number, required: true },
    trainerId: { type: String, required: true },
    feedback: { type: String, required: true, maxlength: 5000 },
    /** Optional rating 1-5 */
    rating: { type: Number, required: false, min: 1, max: 5 },
  },
  { timestamps: true }
);

// One feedback per trainer per student per chapter
trainerFeedbackSchema.index(
  { studentId: 1, batchId: 1, courseId: 1, chapterOrder: 1, trainerId: 1 },
  { unique: true }
);
// Student view: get all feedback for me
trainerFeedbackSchema.index({ studentId: 1, updatedAt: -1 });
// Trainer view: get all feedback I've given
trainerFeedbackSchema.index({ trainerId: 1, updatedAt: -1 });

export const TrainerFeedbackModel = mongoose.model("TrainerFeedback", trainerFeedbackSchema);
