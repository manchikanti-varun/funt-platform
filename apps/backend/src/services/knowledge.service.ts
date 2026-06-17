/**
 * Knowledge Center Service
 *
 * Role-based documentation system.
 * Every query filters by the viewer's role — unauthorized content is NEVER returned.
 */

import { KnowledgeArticleModel } from "../models/KnowledgeArticle.model.js";
import { AppError } from "../utils/AppError.js";
import { sanitizeRichText } from "../utils/sanitizeHtml.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArticleType = "GUIDE" | "FAQ" | "TROUBLESHOOTING" | "RELEASE_NOTE" | "ONBOARDING";

export interface CreateArticleInput {
  title: string;
  category: string;
  subcategory?: string;
  type: ArticleType;
  roles: string[];
  content: string;
  summary?: string;
  tags?: string[];
  relatedArticleIds?: string[];
  order?: number;
  onboardingStep?: number;
  onboardingRole?: string;
  isPublished?: boolean;
  createdBy: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

async function generateArticleId(): Promise<string> {
  const { CounterModel } = await import("../models/Counter.model.js");
  const year = new Date().getFullYear().toString().slice(-2);
  const counter = await CounterModel.findByIdAndUpdate(
    `kb_${year}`,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).exec();
  return `KB-${year}-${String(counter!.seq).padStart(6, "0")}`;
}

/** Build the base role filter — user can only see articles that include their role */
function roleFilter(viewerRoles: string[]): Record<string, unknown> {
  return { roles: { $in: viewerRoles }, isPublished: true };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createArticle(input: CreateArticleInput) {
  const articleId = await generateArticleId();
  let slug = generateSlug(input.title);

  // Ensure slug uniqueness
  const existing = await KnowledgeArticleModel.findOne({ slug }).lean().exec();
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const doc = await KnowledgeArticleModel.create({
    articleId,
    slug,
    title: input.title.trim(),
    category: input.category,
    subcategory: input.subcategory?.trim() ?? "",
    type: input.type,
    roles: input.roles,
    content: sanitizeRichText(input.content),
    summary: input.summary?.trim() ?? input.content.slice(0, 200),
    tags: input.tags ?? [],
    relatedArticleIds: input.relatedArticleIds ?? [],
    order: input.order ?? 0,
    onboardingStep: input.onboardingStep,
    onboardingRole: input.onboardingRole,
    isPublished: input.isPublished ?? true,
    createdBy: input.createdBy,
    version: 1,
  });

  return formatArticle(doc.toObject());
}

export async function updateArticle(
  articleId: string,
  input: Partial<Omit<CreateArticleInput, "createdBy">> & { updatedBy: string }
) {
  const doc = await KnowledgeArticleModel.findOne({ articleId }).exec();
  if (!doc) throw new AppError("Article not found", 404);

  if (input.title !== undefined) doc.title = input.title.trim();
  if (input.category !== undefined) (doc as unknown as Record<string, unknown>).category = input.category;
  if (input.subcategory !== undefined) (doc as unknown as Record<string, unknown>).subcategory = input.subcategory;
  if (input.type !== undefined) (doc as unknown as Record<string, unknown>).type = input.type;
  if (input.roles !== undefined) (doc as unknown as Record<string, unknown>).roles = input.roles;
  if (input.content !== undefined) doc.content = sanitizeRichText(input.content);
  if (input.summary !== undefined) (doc as unknown as Record<string, unknown>).summary = input.summary;
  if (input.tags !== undefined) (doc as unknown as Record<string, unknown>).tags = input.tags;
  if (input.relatedArticleIds !== undefined) (doc as unknown as Record<string, unknown>).relatedArticleIds = input.relatedArticleIds;
  if (input.order !== undefined) (doc as unknown as Record<string, unknown>).order = input.order;
  if (input.isPublished !== undefined) doc.isPublished = input.isPublished;
  (doc as unknown as Record<string, unknown>).updatedBy = input.updatedBy;
  doc.version = (doc.version ?? 1) + 1;

  await doc.save();
  return formatArticle(doc.toObject());
}

export async function deleteArticle(articleId: string) {
  const doc = await KnowledgeArticleModel.findOneAndDelete({ articleId }).exec();
  if (!doc) throw new AppError("Article not found", 404);
  return { deleted: true };
}

// ─── Reader APIs (role-filtered) ──────────────────────────────────────────────

export async function listArticles(
  viewerRoles: string[],
  filters?: { category?: string; type?: string; search?: string; page?: number; limit?: number }
) {
  const query: Record<string, unknown> = roleFilter(viewerRoles);

  if (filters?.category) query.category = filters.category;
  if (filters?.type) query.type = filters.type;

  const page = Math.max(1, filters?.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters?.limit ?? 20));

  let docs;
  let total;

  if (filters?.search?.trim()) {
    const searchTerm = filters.search.trim();
    query.$text = { $search: searchTerm };
    [docs, total] = await Promise.all([
      KnowledgeArticleModel.find(query, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      KnowledgeArticleModel.countDocuments(query).exec(),
    ]);
  } else {
    [docs, total] = await Promise.all([
      KnowledgeArticleModel.find(query)
        .sort({ order: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      KnowledgeArticleModel.countDocuments(query).exec(),
    ]);
  }

  return {
    articles: docs.map(formatArticlePreview),
    total,
    page,
    limit,
  };
}

export async function getArticleBySlug(slug: string, viewerRoles: string[]) {
  const doc = await KnowledgeArticleModel.findOne({
    slug,
    ...roleFilter(viewerRoles),
  }).lean().exec();

  if (!doc) throw new AppError("Article not found", 404);

  // Fetch related articles (role-filtered)
  const relatedIds = (doc as { relatedArticleIds?: string[] }).relatedArticleIds ?? [];
  const related = relatedIds.length > 0
    ? await KnowledgeArticleModel.find({
        articleId: { $in: relatedIds },
        ...roleFilter(viewerRoles),
      }).select("articleId slug title summary category type").lean().exec()
    : [];

  return {
    ...formatArticle(doc),
    relatedArticles: related.map(formatArticlePreview),
  };
}

export async function getCategories(viewerRoles: string[]) {
  const docs = await KnowledgeArticleModel.aggregate([
    { $match: roleFilter(viewerRoles) },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).exec();

  return docs.map((d) => ({ category: d._id, count: d.count }));
}

export async function getOnboardingPath(viewerRoles: string[], role: string) {
  const articles = await KnowledgeArticleModel.find({
    type: "ONBOARDING",
    onboardingRole: role,
    ...roleFilter(viewerRoles),
  })
    .sort({ onboardingStep: 1 })
    .lean()
    .exec();

  return articles.map(formatArticlePreview);
}

export async function getFAQs(viewerRoles: string[], category?: string) {
  const query: Record<string, unknown> = {
    type: "FAQ",
    ...roleFilter(viewerRoles),
  };
  if (category) query.category = category;

  const docs = await KnowledgeArticleModel.find(query)
    .sort({ order: 1 })
    .lean()
    .exec();

  return docs.map(formatArticle);
}

// ─── Admin: list all (unfiltered by role) ─────────────────────────────────────

export async function adminListArticles(filters?: {
  category?: string; type?: string; isPublished?: boolean; page?: number; limit?: number
}) {
  const query: Record<string, unknown> = {};
  if (filters?.category) query.category = filters.category;
  if (filters?.type) query.type = filters.type;
  if (filters?.isPublished !== undefined) query.isPublished = filters.isPublished;

  const page = Math.max(1, filters?.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters?.limit ?? 20));

  const [docs, total] = await Promise.all([
    KnowledgeArticleModel.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    KnowledgeArticleModel.countDocuments(query).exec(),
  ]);

  return { articles: docs.map(formatArticle), total, page, limit };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatArticle(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    articleId: doc.articleId,
    slug: doc.slug,
    title: doc.title,
    category: doc.category,
    subcategory: doc.subcategory,
    type: doc.type,
    roles: doc.roles,
    content: doc.content,
    summary: doc.summary,
    tags: doc.tags,
    relatedArticleIds: doc.relatedArticleIds,
    order: doc.order,
    onboardingStep: doc.onboardingStep,
    onboardingRole: doc.onboardingRole,
    isPublished: doc.isPublished,
    version: doc.version,
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function formatArticlePreview(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    articleId: doc.articleId,
    slug: doc.slug,
    title: doc.title,
    category: doc.category,
    subcategory: doc.subcategory,
    type: doc.type,
    summary: doc.summary,
    tags: doc.tags,
    order: doc.order,
    updatedAt: doc.updatedAt,
  };
}
