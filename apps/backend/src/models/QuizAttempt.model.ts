/**
 * QuizAttempt Model — stores every student quiz attempt.
 *
 * Records:
 *   - Which questions were presented (supports random selection from pool)
 *   - Student answers for each question
 *   - Score, pass/fail, time taken
 *   - Question and option order (for shuffle reconstruction in review)
 *
 * Attempts are immutable once status = COMPLETED.
 */

import mongoose, { Schema } from "mongoose";
import { QUIZ_ATTEMPT_STATUS } from "@funt-platform/constants";

// ─── Answer sub-schema ────────────────────────────────────────────────────────

const answerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    selectedOptionId: { type: String, required: false, default: null },
    isCorrect: { type: Boolean, required: false, default: false },
    marksAwarded: { type: Number, required: false, default: 0 },
  },
  { _id: false }
);

// ─── QuizAttempt schema ───────────────────────────────────────────────────────

const quizAttemptSchema = new Schema(
  {
    attemptId: { type: String, required: false, unique: true, sparse: true },

    // ── Identity ────────────────────────────────────────────────────────
    studentId: { type: String, required: true },
    quizId: { type: String, required: true },
    batchId: { type: String, required: true },
    courseId: { type: String, required: true },

    /** For chapter quizzes — which chapter this attempt belongs to. */
    chapterOrder: { type: Number, required: false },
    /** For milestone quizzes — which milestone this attempt belongs to. */
    milestoneId: { type: String, required: false },

    // ── Attempt metadata ─────────────────────────────────────────────────
    attemptNumber: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      required: true,
      enum: Object.values(QUIZ_ATTEMPT_STATUS),
      default: QUIZ_ATTEMPT_STATUS.IN_PROGRESS,
    },

    // ── Questions presented in this attempt ───────────────────────────────
    /** Ordered list of questionIds presented to the student (preserves shuffle/selection order). */
    questionOrder: { type: [String], required: true, default: [] },
    /** Map of questionId → ordered optionIds (preserves option shuffle). */
    optionOrders: { type: Map, of: [String], required: false, default: {} },

    // ── Answers ──────────────────────────────────────────────────────────
    answers: { type: [answerSchema], required: true, default: [] },

    // ── Results (populated on submission) ─────────────────────────────────
    totalMarks: { type: Number, required: false, default: 0 },
    scoredMarks: { type: Number, required: false, default: 0 },
    scorePercent: { type: Number, required: false, default: 0 },
    passed: { type: Boolean, required: false, default: false },
    timeTakenSeconds: { type: Number, required: false, default: 0 },

    // ── Timestamps ───────────────────────────────────────────────────────
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

// Student's attempts for a specific quiz in a batch/course
quizAttemptSchema.index({ studentId: 1, quizId: 1, batchId: 1, courseId: 1 });
// All attempts for a quiz (admin analytics)
quizAttemptSchema.index({ quizId: 1, status: 1, completedAt: -1 });
// Chapter quiz: find attempts by student+batch+course+chapter
quizAttemptSchema.index({ studentId: 1, batchId: 1, courseId: 1, chapterOrder: 1 });
// Milestone quiz: find attempts by student+batch+course+milestone
quizAttemptSchema.index({ studentId: 1, batchId: 1, courseId: 1, milestoneId: 1 });

export const QuizAttemptModel = mongoose.model("QuizAttempt", quizAttemptSchema);
