import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import {
  createArticle,
  updateArticle,
  deleteArticle,
  listArticles,
  getArticleBySlug,
  getCategories,
  getOnboardingPath,
  getFAQs,
  adminListArticles,
} from "../services/knowledge.service.js";

function uid(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function roles(req: Request): string[] {
  return req.user?.roles ?? [];
}

// ── Reader endpoints (role-filtered) ──────────────────────────────────────────

export const getArticles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { category, type, search, page, limit } = req.query;
  const result = await listArticles(roles(req), {
    category: typeof category === "string" ? category : undefined,
    type: typeof type === "string" ? type : undefined,
    search: typeof search === "string" ? search : undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  });
  successRes(res, result);
});

export const getArticle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const slug = req.params.slug;
  if (!slug) throw new AppError("Article slug is required", 400);
  const article = await getArticleBySlug(slug, roles(req));
  successRes(res, article);
});

export const getCategoriesList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const cats = await getCategories(roles(req));
  successRes(res, cats);
});

export const getOnboarding = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const role = typeof req.query.role === "string" ? req.query.role : roles(req)[0] ?? "STUDENT";
  const path = await getOnboardingPath(roles(req), role);
  successRes(res, path);
});

export const getFAQsList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const faqs = await getFAQs(roles(req), category);
  successRes(res, faqs);
});

// ── Admin endpoints (CRUD) ────────────────────────────────────────────────────

export const adminGetArticles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { category, type, isPublished, page, limit } = req.query;
  const result = await adminListArticles({
    category: typeof category === "string" ? category : undefined,
    type: typeof type === "string" ? type : undefined,
    isPublished: isPublished === "true" ? true : isPublished === "false" ? false : undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  });
  successRes(res, result);
});

export const postArticle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = uid(req);
  const article = await createArticle({ ...req.body, createdBy: userId });
  successRes(res, article, "Article created", 201);
});

export const putArticle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = uid(req);
  const articleId = req.params.articleId;
  if (!articleId) throw new AppError("articleId is required", 400);
  const article = await updateArticle(articleId, { ...req.body, updatedBy: userId });
  successRes(res, article, "Article updated");
});

export const deleteArticleHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const articleId = req.params.articleId;
  if (!articleId) throw new AppError("articleId is required", 400);
  await deleteArticle(articleId);
  successRes(res, { deleted: true }, "Article deleted");
});
