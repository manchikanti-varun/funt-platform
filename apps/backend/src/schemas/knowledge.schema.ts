import { z } from "zod";

export const createKnowledgeArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  slug: z.string().min(1, "Slug is required").max(200).optional(),
  category: z.string().min(1, "Category is required").max(100),
  subcategory: z.string().max(100).optional(),
  type: z.string().min(1, "Type is required").max(50),
  roles: z.array(z.string()).min(1, "At least one role is required"),
  content: z.string().min(1, "Content is required").max(500_000),
  summary: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isPublished: z.boolean().optional(),
  relatedArticleIds: z.array(z.string()).max(10).optional(),
  onboardingOrder: z.number().int().min(0).optional(),
});

export const updateKnowledgeArticleSchema = createKnowledgeArticleSchema.partial();
