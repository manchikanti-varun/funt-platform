import { z } from "zod";
import { objectIdSchema } from "./common.schema.js";

export const createFranchiseCenterSchema = z.object({
  franchiseCode: z.string().min(1, "Franchise code is required").max(50),
  centerName: z.string().min(1, "Center name is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  address: z.string().max(500).optional(),
  ownerName: z.string().min(1, "Owner name is required").max(200),
  ownerMobile: z.string().min(10, "Valid mobile number required").max(15),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
  commissionModel: z.enum(["PERCENTAGE", "FLAT_PER_STUDENT"]).optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  commissionFlatPaise: z.number().int().min(0).optional(),
});

export const updateFranchiseCenterSchema = z.object({
  centerName: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  address: z.string().max(500).optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  commissionFlatPaise: z.number().int().min(0).optional(),
  commissionModel: z.enum(["PERCENTAGE", "FLAT_PER_STUDENT"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
});

export const createPayoutSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  notes: z.string().max(500).optional(),
});

export const approveKeyRequestSchema = z.object({
  courseId: z.string().min(1).optional(),
});

export const rejectKeyRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const directAllocateKeysSchema = z.object({
  courseId: objectIdSchema,
  quantity: z.number().int().min(1).max(1000),
});

export const franchiseCreateBatchSchema = z.object({
  courseId: objectIdSchema,
  batchName: z.string().min(1, "Batch name is required").max(200),
  trainerId: objectIdSchema.optional(),
  startDate: z.string().optional(),
});

export const franchiseRegisterEnrollSchema = z.object({
  name: z.string().min(1, "Student name is required").max(200),
  mobile: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  courseId: objectIdSchema,
  batchId: objectIdSchema.optional(),
  password: z.string().min(6).max(128).optional(),
});

export const franchiseEnrollExistingSchema = z.object({
  studentId: objectIdSchema.optional(),
  username: z.string().optional(),
  courseId: objectIdSchema,
  batchId: objectIdSchema.optional(),
});

export const franchiseRecordOfflinePaymentSchema = z.object({
  studentId: objectIdSchema,
  courseId: objectIdSchema,
  amount: z.number().positive(),
  method: z.string().min(1).max(50).optional(),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const franchiseRequestKeysSchema = z.object({
  courseId: objectIdSchema,
  quantity: z.number().int().min(1).max(1000),
  paymentProofUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export const franchiseAssignKeySchema = z.object({
  studentId: objectIdSchema,
  courseId: objectIdSchema,
});

export const franchiseCreateTrainerSchema = z.object({
  username: z.string().min(3).max(55).optional(),
  name: z.string().min(1, "Trainer name is required").max(200),
  mobile: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).max(128),
});

export const franchiseUpdateTrainerStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
