import { z } from "zod";

export const createManualInvoiceSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  batchId: z.string().min(1, "batchId is required"),
  courseId: z.string().optional(),
  amountInPaise: z.number().int().min(0).optional(),
  amountRupees: z.number().min(0).optional(),
  discountInPaise: z.number().int().min(0).optional(),
  discountRupees: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
  lineDescription: z.string().max(500).optional(),
  lineItemType: z.enum(["SERVICE", "GOODS"]).optional().default("SERVICE"),
}).refine(
  (data) => data.amountInPaise !== undefined || data.amountRupees !== undefined,
  { message: "Either amountInPaise or amountRupees is required" }
);
