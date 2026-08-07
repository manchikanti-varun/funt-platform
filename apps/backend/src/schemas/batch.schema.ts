import { z } from "zod";
import { titleField, urlField } from "./common.schema.js";

const createBatchBaseSchema = z.object({
  name: titleField,
  courseId: z.string().min(1).optional(),
  courseIds: z.array(z.string().min(1)).optional(),
  trainerId: z.string().min(1, "trainerId is required"),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().optional(),
  zoomLink: urlField,
  status: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional().default("PUBLIC"),
  autoEnrollAllStudents: z.boolean().optional(),
  certificatePriceCoins: z.number().int().min(0).optional().default(0),
  manualUpiQrUrl: z.string().max(500_000).optional(),
  headerImageUrl: urlField,
  moderatorIds: z.array(z.string()).max(20).optional().default([]),
  /** Per-course pricing and payment settings (shared by create and update) */
  courseEnrollmentPrices: z.record(z.string(), z.number()).optional(),
  coursePaymentMethods: z.record(z.string(), z.object({ upiManual: z.boolean(), razorpay: z.boolean() })).optional(),
  courseCompletionRewardCoins: z.record(z.string(), z.number()).optional(),
  courseCompletionBadgeTypes: z.record(z.string(), z.array(z.string())).optional(),
  courseOriginalPrices: z.record(z.string(), z.number()).optional(),
  courseEmiTexts: z.record(z.string(), z.string()).optional(),
  courseMilestonePricing: z.record(z.string(), z.record(z.string(), z.object({ feeInPaise: z.number(), paymentDueInDays: z.number().optional() }))).optional(),
  courseCardDescriptions: z.record(z.string(), z.string()).optional(),
  courseCardIncludes: z.record(z.string(), z.array(z.string())).optional(),
  courseImages: z.record(z.string(), z.array(z.string())).optional(),
  courseFaqs: z.record(z.string(), z.array(z.object({ question: z.string(), answer: z.string() }))).optional(),
});

export const createBatchSchema = createBatchBaseSchema.refine(
  (data) => (data.courseId && data.courseId.length > 0) || (data.courseIds && data.courseIds.length > 0),
  { message: "courseId or courseIds is required", path: ["courseId"] }
);

export const updateBatchSchema = createBatchBaseSchema.partial().extend({
  /** Allow updating course snapshots */
  courseSnapshots: z.array(z.any()).optional(),
  courseSnapshot: z.any().optional(),
});
