import { z } from "zod";
import { objectIdSchema } from "./common.schema.js";

export const createLetterSchema = z.object({
  recipientId: objectIdSchema,
  letterType: z.string().min(1, "Letter type is required").max(50),
  subject: z.string().min(1, "Subject is required").max(300),
  body: z.string().min(1, "Body is required").max(100_000),
  role: z.string().optional(),
  salary: z.number().positive().optional(),
  joiningDate: z.string().optional(),
  department: z.string().max(100).optional(),
  designation: z.string().max(100).optional(),
  probationMonths: z.number().int().min(0).max(24).optional(),
  expiresAt: z.string().optional(),
});
