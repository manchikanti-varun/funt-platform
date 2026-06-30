/**
 * Quiz Model — reusable quiz/assessment template.
 *
 * Types:
 *   CHAPTER      — linked to a chapter via linkedQuizId
 *   MILESTONE    — linked to a milestone via milestoneQuizId
 *   COURSE_FINAL — linked to a course via finalQuizId
 *
 * Each quiz has a question bank. For MILESTONE/COURSE_FINAL quizzes,
 * a subset of questions can be randomly selected per attempt.
 */

import mongoose, { Schema } from "mongoose";
import { QUIZ_TYPE, QUIZ_STATUS, QUESTION_TYPE } from "@funt-platform/constants";

// ─── Option sub-schema ────────────────────────────────────────────────────────

const optionSchema = new Schema(
  {
    optionId: { type: String, required: true },
    text: { type: String, required: true },
    imageUrl: { type: String, required: false },
    isCorrect: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

// ─── Question sub-schema ──────────────────────────────────────────────────────

const questionSchema = new Schema(
  {
    questionId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(QUESTION_TYPE),
      default: QUESTION_TYPE.SINGLE_SELECT,
    },
    text: { type: String, required: true },
    imageUrl: { type: String, required: false },
    options: { type: [optionSchema], required: true, default: [] },
    explanation: { type: String, required: false, default: "" },
    marks: { type: Number, required: true, default: 1, min: 0 },
    order: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

// ─── Quiz schema ─────────────────────────────────────────────────────────────

const quizSchema = new Schema(
  {
    quizId: { type: String, required: false, unique: true, sparse: true },
    title: { type: String, required: true },
    description: { type: String, required: false, default: "" },
    type: {
      type: String,
      required: true,
      enum: Object.values(QUIZ_TYPE),
      default: QUIZ_TYPE.CHAPTER,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(QUIZ_STATUS),
      default: QUIZ_STATUS.DRAFT,
    },

    // ── Questions ─────────────────────────────────────────────────────────
    questions: { type: [questionSchema], required: true, default: [] },

    // ── Configuration ─────────────────────────────────────────────────────
    passingScore: { type: Number, required: true, default: 70, min: 0, max: 100 },
    maxAttempts: { type: Number, required: false, default: 0, min: 0 }, // 0 = unlimited
    timeLimitMinutes: { type: Number, required: false, default: 0, min: 0 }, // 0 = no limit
    shuffleQuestions: { type: Boolean, required: true, default: false },
    shuffleOptions: { type: Boolean, required: true, default: false },

    // ── Question Pool (for MILESTONE / COURSE_FINAL) ──────────────────────
    /** Number of questions to select per attempt from the pool. 0 = use all questions. */
    questionsPerAttempt: { type: Number, required: false, default: 0, min: 0 },

    // ── Certificate integration (COURSE_FINAL) ────────────────────────────
    /** If true, passing this quiz is required before certificate generation. */
    requiredForCertificate: { type: Boolean, required: false, default: false },

    // ── Metadata ──────────────────────────────────────────────────────────
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

quizSchema.index({ type: 1, status: 1 });
quizSchema.index({ title: "text" });
quizSchema.index({ createdBy: 1 });

export const QuizModel = mongoose.model("Quiz", quizSchema);
