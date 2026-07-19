import { z } from "zod";

// ─── Option schema ────────────────────────────────────────────────────────────

const optionInputSchema = z.object({
  optionId: z.string().min(1),
  text: z.string(),
  imageUrl: z.string().optional(),
  isCorrect: z.boolean(),
});

// ─── Question schema ──────────────────────────────────────────────────────────

const questionInputSchema = z.object({
  questionId: z.string().min(1),
  type: z.enum(["SINGLE_SELECT"]).default("SINGLE_SELECT"),
  text: z.string(),
  imageUrl: z.string().optional(),
  options: z.array(optionInputSchema).max(10),
  explanation: z.string().optional().default(""),
  marks: z.coerce.number().min(0).default(1),
  order: z.coerce.number().int().min(0).default(0),
});

// ─── Create Quiz ──────────────────────────────────────────────────────────────

export const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().optional().default(""),
  type: z.enum(["CHAPTER", "MILESTONE", "COURSE_FINAL"]),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional().default("DRAFT"),
  questions: z.array(questionInputSchema).optional().default([]),
  passingScore: z.coerce.number().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(0).default(0),
  timeLimitMinutes: z.coerce.number().int().min(0).default(0),
  shuffleQuestions: z.boolean().optional().default(false),
  shuffleOptions: z.boolean().optional().default(false),
  questionsPerAttempt: z.coerce.number().int().min(0).default(0),
  requiredForCertificate: z.boolean().optional().default(false),
});

// ─── Update Quiz ──────────────────────────────────────────────────────────────

export const updateQuizSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  type: z.enum(["CHAPTER", "MILESTONE", "COURSE_FINAL"]).optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  questions: z.array(questionInputSchema).optional(),
  passingScore: z.coerce.number().min(0).max(100).optional(),
  maxAttempts: z.coerce.number().int().min(0).optional(),
  timeLimitMinutes: z.coerce.number().int().min(0).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  questionsPerAttempt: z.coerce.number().int().min(0).optional(),
  requiredForCertificate: z.boolean().optional(),
});

// ─── Start Attempt ────────────────────────────────────────────────────────────

export const startQuizAttemptSchema = z.object({
  quizId: z.string().min(1, "quizId is required"),
  batchId: z.string().min(1, "batchId is required"),
  courseId: z.string().min(1, "courseId is required"),
  chapterOrder: z.coerce.number().int().min(0).optional(),
  milestoneId: z.string().optional(),
});

// ─── Save Answer (auto-save while navigating) ─────────────────────────────────

export const saveQuizAnswerSchema = z.object({
  questionId: z.string().min(1, "questionId is required"),
  selectedOptionId: z.string().nullable().optional(),
});

// ─── Submit Attempt ───────────────────────────────────────────────────────────

export const submitQuizAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      selectedOptionId: z.string().nullable().optional(),
    })
  ).optional(),
});
