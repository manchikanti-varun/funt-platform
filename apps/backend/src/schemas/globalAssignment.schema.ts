import { z } from "zod";

export const createGlobalAssignmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  instructions: z.string().max(500_000).optional().default(""),
  submissionType: z.enum(["file", "text", "link"]).optional().default("text"),
  dueDate: z.string().optional(),
  maxScore: z.number().int().min(0).optional(),
  allowLateSubmission: z.boolean().optional(),
});

export const updateGlobalAssignmentSchema = createGlobalAssignmentSchema.partial();

export const submitAssignmentBodySchema = z.object({
  assignmentId: z.string().min(1, "Assignment ID is required"),
  batchId: z.string().optional(),
  submissionContent: z.string().max(100_000).optional(),
  submissionUrl: z.string().url().max(2048).optional().or(z.literal("")),
});

export const reviewGlobalSubmissionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  feedback: z.string().max(5000).optional(),
  score: z.number().int().min(0).optional(),
});
