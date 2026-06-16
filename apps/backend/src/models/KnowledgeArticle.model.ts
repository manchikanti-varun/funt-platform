import mongoose, { Schema } from "mongoose";
import { ROLE } from "@funt-platform/constants";

const ARTICLE_TYPES = ["GUIDE", "FAQ", "TROUBLESHOOTING", "RELEASE_NOTE", "ONBOARDING"] as const;

const CATEGORIES = [
  "platform-overview", "authentication", "courses", "batches", "students",
  "trainers", "parents", "payments", "license-keys", "learning-plans",
  "assignments", "attendance", "certificates", "shop", "gamification",
  "tickets", "leave-management", "analytics", "import-export", "content-protection",
] as const;

const knowledgeArticleSchema = new Schema(
  {
    articleId: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 300 },
    category: { type: String, required: true, enum: CATEGORIES },
    subcategory: { type: String, required: false, default: "" },
    type: { type: String, required: true, enum: ARTICLE_TYPES },
    /** Roles that can view this article */
    roles: {
      type: [String],
      required: true,
      enum: Object.values(ROLE),
      default: [ROLE.STUDENT],
    },
    content: { type: String, required: true },
    summary: { type: String, required: false, maxlength: 500 },
    tags: { type: [String], required: false, default: [] },
    relatedArticleIds: { type: [String], required: false, default: [] },
    /** Display order within category (lower = first) */
    order: { type: Number, required: false, default: 0 },
    /** For ONBOARDING type: which step in the sequence */
    onboardingStep: { type: Number, required: false },
    /** For ONBOARDING type: which role this onboarding is for */
    onboardingRole: { type: String, required: false, enum: Object.values(ROLE) },
    isPublished: { type: Boolean, required: true, default: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: false },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

// Role-filtered searches
knowledgeArticleSchema.index({ roles: 1, type: 1, category: 1, isPublished: 1 });
// Text search
knowledgeArticleSchema.index({ title: "text", content: "text", tags: "text", summary: "text" });
// Slug lookup
knowledgeArticleSchema.index({ slug: 1 }, { unique: true });
// Onboarding sequences
knowledgeArticleSchema.index({ type: 1, onboardingRole: 1, onboardingStep: 1 });

export const KnowledgeArticleModel = mongoose.model("KnowledgeArticle", knowledgeArticleSchema);
