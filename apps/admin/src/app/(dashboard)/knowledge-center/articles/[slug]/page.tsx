"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, BackLink } from "@/components/ui";
import { FileText, Tag, Clock, ChevronRight, HelpCircle } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  "platform-overview": "Platform Overview",
  authentication: "Authentication",
  courses: "Courses",
  batches: "Batches",
  students: "Students",
  trainers: "Trainers",
  parents: "Parents",
  payments: "Payments",
  "license-keys": "License Keys",
  "learning-plans": "Learning Plans",
  assignments: "Assignments",
  attendance: "Attendance",
  certificates: "Certificates",
  shop: "Shop",
  gamification: "Gamification",
  tickets: "Tickets",
  "leave-management": "Leave Management",
  analytics: "Analytics",
  "import-export": "Import/Export",
  "content-protection": "Content Protection",
};

interface ArticleDetail {
  id: string;
  articleId: string;
  slug: string;
  title: string;
  category: string;
  subcategory?: string;
  type: string;
  roles: string[];
  content: string;
  summary?: string;
  tags?: string[];
  relatedArticles?: { articleId: string; slug: string; title: string; summary?: string; category: string; type: string }[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function KnowledgeArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api<ArticleDetail>(`/api/knowledge/articles/${slug}`)
      .then((res) => {
        if (res.success && res.data) setArticle(res.data);
        else setError(res.message ?? "Article not found");
      })
      .catch(() => setError("Failed to load article"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <AppPageShell>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <p className="mt-4 text-sm text-slate-500">Loading article…</p>
        </div>
      </AppPageShell>
    );
  }

  if (error || !article) {
    return (
      <AppPageShell>
        <BackLink href="/knowledge-center">Back to Knowledge Center</BackLink>
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <HelpCircle className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Article not found</h2>
          <p className="mt-2 text-sm text-slate-500">{error || "This article does not exist or you do not have access."}</p>
        </div>
      </AppPageShell>
    );
  }

  const readTimeMinutes = Math.max(1, Math.ceil((article.content?.length ?? 0) / 1200));

  return (
    <AppPageShell>
      <BackLink href="/knowledge-center">Back to Knowledge Center</BackLink>

      <article className="mx-auto mt-6 max-w-4xl">
        {/* Article Header */}
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-medium text-indigo-700">
              {CATEGORY_LABELS[article.category] ?? article.category}
            </span>
            {article.subcategory && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                {article.subcategory}
              </span>
            )}
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-medium text-purple-700">
              {article.type}
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {article.title}
          </h1>
          {article.summary && (
            <p className="mt-3 text-sm text-slate-600">{article.summary}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {readTimeMinutes} min read
            </span>
            {article.updatedAt && (
              <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
            )}
            <span>v{article.version}</span>
          </div>
          {article.tags && article.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Article Content */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div
            className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-indigo-700"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>

        {/* Related Articles */}
        {article.relatedArticles && article.relatedArticles.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-slate-800">Related Articles</h2>
            <div className="mt-4 space-y-2">
              {article.relatedArticles.map((related) => (
                <Link
                  key={related.articleId}
                  href={`/knowledge-center/articles/${related.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 group-hover:text-indigo-700">
                      {related.title}
                    </p>
                    {related.summary && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{related.summary}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-indigo-500" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </AppPageShell>
  );
}
