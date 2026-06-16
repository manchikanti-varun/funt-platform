import { z } from "zod";

export const createBadgeDefinitionSchema = z.object({
  badgeType: z.string().min(1, "Badge type is required").max(100),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional().default(""),
  iconUrl: z.string().url().max(2048).optional().or(z.literal("")),
  criteria: z.string().max(2000).optional().default(""),
  active: z.boolean().optional().default(true),
});

export const updateBadgeDefinitionSchema = createBadgeDefinitionSchema.partial();

export const awardBadgeSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  badgeType: z.string().min(1, "badgeType is required"),
  reason: z.string().max(500).optional(),
});
