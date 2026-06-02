import { z } from "zod";
import { objectIdSchema } from "./common.schema.js";

export const createEnrollmentSchema = z.object({
  studentId: objectIdSchema,
  batchId: objectIdSchema,
});

export const bulkEnrollSchema = z.object({
  batchId: objectIdSchema,
  studentUsernames: z.array(z.string().min(1)).min(1, "At least one username is required").max(500),
});

export const markChapterCompleteSchema = z.object({
  chapterOrder: z.coerce.number().int().min(0).optional(),
  moduleOrder: z.coerce.number().int().min(0).optional(),
  part: z.enum(["content", "video", "youtube"]).optional(),
  courseId: z.string().optional(),
}).refine(
  (data) => data.chapterOrder !== undefined || data.moduleOrder !== undefined,
  { message: "chapterOrder or moduleOrder is required" }
);

export const submitAssignmentSchema = z.object({
  assignmentId: objectIdSchema,
  submissionType: z.string().min(1, "submissionType is required"),
  submissionContent: z.string().min(1, "submissionContent is required").max(100_000),
});

export const enrollmentRequestSchema = z.object({
  batchId: objectIdSchema,
  courseId: z.string().optional(),
});
