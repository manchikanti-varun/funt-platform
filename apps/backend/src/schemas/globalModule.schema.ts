import { z } from "zod";

/** Allows r2:// prefixed keys, empty string, or standard URLs */
const videoUrlField = z.string().max(2048).optional().or(z.literal("")).refine(
  (v) => !v || v.startsWith("r2://") || /^https?:\/\//i.test(v),
  { message: "Must be a valid URL or r2:// key" }
);

export const createGlobalModuleSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().min(1, "Description is required").max(10_000),
  content: z.string().max(500_000).optional().default(""),
  youtubeUrl: z.string().max(2048).optional().or(z.literal("")),
  videoUrl: videoUrlField,
  resourceLinkUrl: z.string().max(2048).optional().or(z.literal("")),
  linkedAssignmentId: z.string().max(100).optional().or(z.literal("")),
  linkedQuizId: z.string().max(100).optional().or(z.literal("")),
});

export const updateGlobalModuleSchema = createGlobalModuleSchema.partial();
