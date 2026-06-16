import { z } from "zod";

export const createStudentSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(40),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").max(200).optional().or(z.literal("")),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(15),
  password: z.string().min(6, "Password must be at least 6 characters").max(128).optional(),
  age: z.number().int().min(5).max(100).optional(),
  address: z.string().max(500).optional(),
  grade: z.string().max(50).optional(),
  gradeOther: z.string().max(100).optional(),
  schoolName: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
});

export const createTrainerSchema = z.object({
  username: z.string().min(3).max(40),
  name: z.string().min(1).max(200),
  email: z.string().email().max(200).optional().or(z.literal("")),
  mobile: z.string().min(10).max(15),
  password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
});

export const createAdminSchema = z.object({
  username: z.string().min(3).max(40),
  name: z.string().min(1).max(200),
  email: z.string().email().max(200).optional().or(z.literal("")),
  mobile: z.string().min(10).max(15),
  password: z.string().min(8).max(128).optional(),
});

export const patchUserIdentitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  mobile: z.string().min(10).max(15).optional(),
  age: z.number().int().min(5).max(100).optional(),
  address: z.string().max(500).optional(),
  grade: z.string().max(50).optional(),
  gradeOther: z.string().max(100).optional(),
  schoolName: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

export const generateLicenseKeySchema = z.object({
  courseId: z.string().min(1, "courseId is required"),
  batchId: z.string().optional(),
  count: z.number().int().min(1).max(100).optional().default(1),
  licenseType: z.string().optional(),
  targetMilestoneIds: z.array(z.string()).optional(),
});

export const verifyPaymentSchema = z.object({
  enrollmentAction: z.enum(["enroll", "skip"]).optional().default("enroll"),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(1000),
});
