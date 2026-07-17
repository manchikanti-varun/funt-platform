import { z } from "zod";
import { objectIdSchema } from "./common.schema.js";

export const markAttendanceSchema = z.object({
  batchId: objectIdSchema,
  studentId: objectIdSchema,
  date: z.string().optional(),
  status: z.enum(["PRESENT", "ABSENT"]),
});

export const markBatchAttendanceByIdsSchema = z.object({
  date: z.string().optional(),
  presentStudentIds: z.array(objectIdSchema).default([]),
  absentStudentIds: z.array(objectIdSchema).default([]),
});

export const addPresentToBatchSchema = z.object({
  date: z.string().optional(),
  studentIds: z.array(objectIdSchema).min(1, "At least one student ID is required"),
});

export const createGeneralAttendanceSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  date: z.string().optional(),
  presentStudentIds: z.array(objectIdSchema).default([]),
  notes: z.string().max(500).optional(),
});

export const addPresentToGeneralAttendanceSchema = z.object({
  studentIds: z.array(objectIdSchema).min(1, "At least one student ID is required"),
});
