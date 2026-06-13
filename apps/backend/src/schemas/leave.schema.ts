import { z } from "zod";
import { LEAVE_TYPE } from "@funt-platform/constants";
import { objectIdSchema } from "./common.schema.js";

export const leaveTypeEnum = z.enum([
  LEAVE_TYPE.SICK,
  LEAVE_TYPE.CASUAL,
  LEAVE_TYPE.PERSONAL,
  LEAVE_TYPE.EMERGENCY,
  LEAVE_TYPE.WORK_FROM_HOME,
  LEAVE_TYPE.COMP_OFF,
  LEAVE_TYPE.UNPAID,
  "CUSTOM",
] as [string, ...string[]]);

export const createLeaveSchema = z
  .object({
    leaveType: leaveTypeEnum,
    customLeaveType: z.string().min(1).max(100).optional(),
    startDate: z.string().min(1, "startDate is required"),
    endDate: z.string().min(1, "endDate is required"),
    isHalfDay: z.boolean().optional().default(false),
    reason: z.string().min(1, "reason is required").max(2000),
    attachment: z.string().url().optional().or(z.literal("")),
    // Trainer-specific optional fields
    affectedBatches: z.array(objectIdSchema).optional().default([]),
    substituteTrainerId: objectIdSchema.optional(),
    leaveImpactNotes: z.string().max(2000).optional(),
  })
  .refine((d) => d.leaveType !== "CUSTOM" || (d.customLeaveType && d.customLeaveType.trim().length > 0), {
    message: "customLeaveType is required when leaveType is CUSTOM",
    path: ["customLeaveType"],
  });

export const reviewLeaveSchema = z.object({
  reviewRemarks: z.string().max(1000).optional(),
});

export const cancelLeaveSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const leavePolicySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  annualLeaveLimit: z.coerce.number().int().min(0).max(365),
  leaveTypes: z.array(z.string().min(1)).min(1),
  allowHalfDay: z.boolean(),
  maxConsecutiveLeaves: z.coerce.number().int().min(1).max(365),
  customLeaveTypes: z.array(z.string().min(1).max(100)).optional().default([]),
});

export const substituteTrainerSchema = z.object({
  substituteTrainerId: objectIdSchema.optional().nullable(),
  leaveImpactNotes: z.string().max(2000).optional(),
});
