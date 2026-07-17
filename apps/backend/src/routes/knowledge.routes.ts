/**
 * Knowledge Center Routes
 *
 * Reader (all authenticated users — role-filtered on backend):
 *   GET  /api/knowledge/articles         — list articles (role-filtered + search)
 *   GET  /api/knowledge/articles/:slug   — get single article by slug
 *   GET  /api/knowledge/categories       — list categories with counts
 *   GET  /api/knowledge/onboarding       — get onboarding path for role
 *   GET  /api/knowledge/faqs             — get FAQs (role-filtered)
 *
 * Admin (CRUD):
 *   GET    /api/admin/knowledge             — list all articles (unfiltered)
 *   POST   /api/admin/knowledge             — create article
 *   PUT    /api/admin/knowledge/:articleId   — update article
 *   DELETE /api/admin/knowledge/:articleId   — delete article
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { createKnowledgeArticleSchema, updateKnowledgeArticleSchema } from "../schemas/index.js";
import {
  getArticles,
  getArticle,
  getCategoriesList,
  getOnboarding,
  getFAQsList,
  adminGetArticles,
  postArticle,
  putArticle,
  deleteArticleHandler,
} from "../controllers/knowledge.controller.js";

const ALL_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN, ROLE.TRAINER, ROLE.STUDENT, ROLE.PARENT, ROLE.SUPPORT_AGENT, ROLE.FRANCHISE_ADMIN] as const;
const ADMIN_ROLES = [ROLE.SUPER_ADMIN] as const;

// ── Reader router (all authenticated users) ────────────────────────────────
export const knowledgeReaderRouter = Router();
knowledgeReaderRouter.use(authMiddleware);

knowledgeReaderRouter.get("/articles", requireRoles(...ALL_ROLES), getArticles);
knowledgeReaderRouter.get("/categories", requireRoles(...ALL_ROLES), getCategoriesList);
knowledgeReaderRouter.get("/onboarding", requireRoles(...ALL_ROLES), getOnboarding);
knowledgeReaderRouter.get("/faqs", requireRoles(...ALL_ROLES), getFAQsList);
knowledgeReaderRouter.get("/articles/:slug", requireRoles(...ALL_ROLES), getArticle);

// ── Admin router (CRUD) ────────────────────────────────────────────────────
export const knowledgeAdminRouter = Router();
knowledgeAdminRouter.use(authMiddleware, requireRoles(...ADMIN_ROLES));

knowledgeAdminRouter.get("/", adminGetArticles);
knowledgeAdminRouter.post("/", validateBody(createKnowledgeArticleSchema), postArticle);
knowledgeAdminRouter.put("/:articleId", validateBody(updateKnowledgeArticleSchema), putArticle);
knowledgeAdminRouter.delete("/:articleId", deleteArticleHandler);
