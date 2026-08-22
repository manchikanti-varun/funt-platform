import { z } from "zod";

// ─── Option schema ────────────────────────────────────────────────────────────

const checkpointOptionSchema = z.object({
  optionId: z.string().min(1, "optionId is required"),
  text: z.string().min(1, "Option text is required").max(500),
});

// ─── Create Checkpoint ────────────────────────────────────────────────────────

export const createCheckpointSchema = z
  .object({
    questionTimestamp: z.coerce.number().min(0, "questionTimestamp must be >= 0"),
    reviewTimestamp: z.coerce.number().min(0, "reviewTimestamp must be >= 0"),
    question: z.string().min(1, "Question is required").max(1000),
    type: z.enum(["mcq", "true_false", "multi_select", "fill_blank", "code_output"]).default("mcq"),
    options: z.array(checkpointOptionSchema).max(6).optional().default([]),
    correctOptionId: z.string().optional(),
    correctOptionIds: z.array(z.string()).optional().default([]),
    correctText: z.string().max(500).optional(),
    acceptableAnswers: z.array(z.string().max(500)).max(10).optional().default([]),
    codeSnippet: z.string().max(2000).optional(),
    codeLanguage: z.string().max(30).optional().default(""),
    explanation: z.string().max(2000).optional().default(""),
    bonusXp: z.coerce.number().int().min(0).max(100).optional().default(5),
  })
  .refine((d) => d.reviewTimestamp < d.questionTimestamp, {
    message: "reviewTimestamp must be less than questionTimestamp",
    path: ["reviewTimestamp"],
  })
  .refine((d) => {
    // Type-specific validation
    if (d.type === "mcq") {
      if (!d.options || d.options.length < 2) return false;
      if (!d.correctOptionId) return false;
      return d.options.some((o) => o.optionId === d.correctOptionId);
    }
    if (d.type === "true_false") {
      if (!d.correctOptionId) return false;
      return ["true", "false"].includes(d.correctOptionId);
    }
    if (d.type === "multi_select") {
      if (!d.options || d.options.length < 2) return false;
      if (!d.correctOptionIds || d.correctOptionIds.length < 1) return false;
      return d.correctOptionIds.every((id) => d.options!.some((o) => o.optionId === id));
    }
    if (d.type === "fill_blank" || d.type === "code_output") {
      if (!d.correctText?.trim()) return false;
      return true;
    }
    return true;
  }, {
    message: "Invalid question configuration for the selected type",
    path: ["type"],
  });

// ─── Update Checkpoint ────────────────────────────────────────────────────────

export const updateCheckpointSchema = z
  .object({
    questionTimestamp: z.coerce.number().min(0).optional(),
    reviewTimestamp: z.coerce.number().min(0).optional(),
    question: z.string().min(1).max(1000).optional(),
    type: z.enum(["mcq", "true_false", "multi_select", "fill_blank", "code_output"]).optional(),
    options: z.array(checkpointOptionSchema).max(6).optional(),
    correctOptionId: z.string().optional(),
    correctOptionIds: z.array(z.string()).optional(),
    correctText: z.string().max(500).optional(),
    acceptableAnswers: z.array(z.string().max(500)).max(10).optional(),
    codeSnippet: z.string().max(2000).optional(),
    codeLanguage: z.string().max(30).optional(),
    explanation: z.string().max(2000).optional(),
    isActive: z.boolean().optional(),
    bonusXp: z.coerce.number().int().min(0).max(100).optional(),
  })
  .refine(
    (d) => {
      if (d.reviewTimestamp !== undefined && d.questionTimestamp !== undefined) {
        return d.reviewTimestamp < d.questionTimestamp;
      }
      return true;
    },
    { message: "reviewTimestamp must be less than questionTimestamp", path: ["reviewTimestamp"] }
  );

// ─── Submit Answer ────────────────────────────────────────────────────────────

export const submitCheckpointAnswerSchema = z.object({
  moduleId: z.string().min(1, "moduleId is required"),
  // For mcq, true_false: single option
  selectedOptionId: z.string().optional(),
  // For multi_select: array of selected option IDs
  selectedOptionIds: z.array(z.string()).optional(),
  // For fill_blank, code_output: typed text
  textAnswer: z.string().max(500).optional(),
});

// ─── Save Position ────────────────────────────────────────────────────────────

export const savePositionSchema = z.object({
  moduleId: z.string().min(1, "moduleId is required"),
  position: z.coerce.number().min(0),
});

// ─── Bulk Import ──────────────────────────────────────────────────────────────

const bulkCheckpointItemSchema = z.object({
  questionTimestamp: z.coerce.number().min(0),
  reviewTimestamp: z.coerce.number().min(0),
  question: z.string().min(1).max(1000),
  type: z.enum(["mcq", "true_false", "multi_select", "fill_blank", "code_output"]).default("mcq"),
  options: z.array(checkpointOptionSchema).max(6).optional().default([]),
  correctOptionId: z.string().optional(),
  correctOptionIds: z.array(z.string()).optional().default([]),
  correctText: z.string().max(500).optional(),
  acceptableAnswers: z.array(z.string().max(500)).max(10).optional().default([]),
  codeSnippet: z.string().max(2000).optional(),
  codeLanguage: z.string().max(30).optional().default(""),
  explanation: z.string().max(2000).optional().default(""),
  bonusXp: z.coerce.number().int().min(0).max(100).optional().default(5),
});

export const bulkImportCheckpointsSchema = z.object({
  checkpoints: z.array(bulkCheckpointItemSchema).min(1).max(50),
});

// ─── Duplicate from module ────────────────────────────────────────────────────

export const duplicateCheckpointsSchema = z.object({
  sourceModuleId: z.string().min(1, "sourceModuleId is required"),
});
