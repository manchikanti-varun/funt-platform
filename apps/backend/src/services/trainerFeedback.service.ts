/**
 * Trainer Feedback Service
 * Trainers can leave written feedback per student per chapter.
 */

import { TrainerFeedbackModel } from "../models/TrainerFeedback.model.js";
import { AppError } from "../utils/AppError.js";

export async function upsertFeedback(input: {
  studentId: string;
  batchId: string;
  courseId: string;
  chapterOrder: number;
  trainerId: string;
  feedback: string;
  rating?: number;
}) {
  const { studentId, batchId, courseId, chapterOrder, trainerId, feedback, rating } = input;

  if (!feedback.trim()) throw new AppError("Feedback cannot be empty", 400);
  if (feedback.length > 5000) throw new AppError("Feedback too long (max 5000 characters)", 400);
  if (rating !== undefined && (rating < 1 || rating > 5)) throw new AppError("Rating must be 1-5", 400);

  const doc = await TrainerFeedbackModel.findOneAndUpdate(
    { studentId, batchId, courseId, chapterOrder, trainerId },
    {
      $set: {
        studentId, batchId, courseId, chapterOrder, trainerId,
        feedback: feedback.trim(),
        ...(rating !== undefined ? { rating } : {}),
      },
    },
    { upsert: true, new: true }
  ).exec();

  return {
    id: String(doc._id),
    studentId: doc.studentId,
    chapterOrder: doc.chapterOrder,
    feedback: doc.feedback,
    rating: doc.rating,
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
  };
}

/** Get all feedback for a student in a course (student view) */
export async function getFeedbackForStudent(studentId: string, batchId: string, courseId: string) {
  const docs = await TrainerFeedbackModel.find({ studentId, batchId, courseId })
    .sort({ chapterOrder: 1 })
    .lean()
    .exec();
  return docs.map((d) => ({
    id: String(d._id),
    chapterOrder: d.chapterOrder,
    trainerId: d.trainerId,
    feedback: d.feedback,
    rating: d.rating,
    updatedAt: (d as { updatedAt: Date }).updatedAt,
  }));
}

/** Get feedback a trainer has given for a specific student+course (trainer view) */
export async function getFeedbackByTrainer(trainerId: string, studentId: string, batchId: string, courseId: string) {
  const docs = await TrainerFeedbackModel.find({ trainerId, studentId, batchId, courseId })
    .sort({ chapterOrder: 1 })
    .lean()
    .exec();
  return docs.map((d) => ({
    id: String(d._id),
    chapterOrder: d.chapterOrder,
    feedback: d.feedback,
    rating: d.rating,
    updatedAt: (d as { updatedAt: Date }).updatedAt,
  }));
}

/** Delete feedback */
export async function deleteFeedback(trainerId: string, feedbackId: string) {
  const doc = await TrainerFeedbackModel.findOneAndDelete({ _id: feedbackId, trainerId }).exec();
  if (!doc) throw new AppError("Feedback not found or not yours", 404);
  return { deleted: true };
}
