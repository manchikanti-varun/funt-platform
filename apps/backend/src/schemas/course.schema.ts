import { z } from "zod";
import { titleField, urlField } from "./common.schema.js";
import { COURSE_DELIVERY_MODE } from "@funt-platform/constants";

const pricingTierSchema = z.object({
  label: z.string().min(1).max(100),
  price: z.string().min(1).max(50),
  note: z.string().max(200).optional().default(""),
});

const chapterSnapshotSchema = z.object({
  originalGlobalModuleId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(10_000).optional().default(""),
  content: z.string().max(500_000).optional().default(""),
  youtubeUrl: urlField,
  videoUrl: urlField,
  resourceLinkUrl: urlField,
  versionAtSnapshot: z.number().int().min(1),
  linkedAssignmentId: z.string().optional(),
  linkedAssignmentTitleOverride: z.string().max(300).optional(),
  linkedAssignmentInstructionsOverride: z.string().max(50_000).optional(),
  linkedAssignmentSubmissionTypeOverride: z.string().optional(),
  linkedAssignmentSkillTagsOverride: z.array(z.string().max(48)).optional(),
  order: z.number().int().min(0),
  xpReward: z.number().int().min(0).max(100_000).optional().default(40),
});

export const createCourseSchema = z.object({
  title: titleField,
  description: z.string().min(1, "Description is required").max(10_000),
  headerImageUrl: z.string().max(2_500_000).optional().or(z.literal("")),
  isDemo: z.boolean().optional().default(false),
  durationText: z.string().max(200).optional().default(""),
  ageGroup: z.string().max(100).optional().default(""),
  certification: z.string().max(300).optional().default("Certification upon completion"),
  paymentNote: z.string().max(500).optional().default(""),
  learningOutcomes: z.array(z.string().max(300)).max(20).optional().default([]),
  overview: z.string().max(100_000).optional().default(""),
  pricingTiers: z.array(pricingTierSchema).max(10).optional().default([]),
  globalChapterIds: z.array(z.string().min(1)).optional(),
  modules: z.array(chapterSnapshotSchema).optional().default([]),
  chapters: z.array(chapterSnapshotSchema).optional().default([]),
  status: z.string().optional(),
  deliveryMode: z.nativeEnum(COURSE_DELIVERY_MODE).optional().default(COURSE_DELIVERY_MODE.FULL_ACCESS),
  moderatorIds: z.array(z.string()).max(20).optional().default([]),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  enableWatermark: z.boolean().nullable().optional(),
});
