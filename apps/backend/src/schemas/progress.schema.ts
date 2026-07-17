import { z } from "zod";
import { objectIdSchema } from "./common.schema.js";

export const overrideProgressSchema = z.object({
  studentId: objectIdSchema,
  batchId: objectIdSchema,
  chapterOrder: z.number().int().min(0).optional(),
  moduleOrder: z.number().int().min(0).optional(),
  reason: z.string().max(500).optional().default("Manual override"),
}).refine(
  (data) => data.chapterOrder !== undefined || data.moduleOrder !== undefined,
  { message: "Either chapterOrder or moduleOrder is required" }
);
