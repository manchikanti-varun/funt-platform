import { z } from "zod";

/** MongoDB ObjectId format (24-char hex string). */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID format");

/** Pagination query parameters. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Common pattern for batch/course/chapter operations. */
export const batchIdParam = z.object({
  batchId: objectIdSchema,
});

export const courseIdParam = z.object({
  courseId: objectIdSchema,
});

/** Reusable string constraints. */
export const titleField = z.string().min(1, "Title is required").max(300);
export const descriptionField = z.string().max(10_000).optional().default("");
export const contentField = z.string().max(500_000).optional().default("");
export const urlField = z.string().url().max(2048).optional().or(z.literal(""));
