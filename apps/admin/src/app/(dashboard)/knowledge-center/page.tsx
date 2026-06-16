"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { AppPageShell } from "@/components/ui";
import {
  BookOpen,
  Search,
  FileText,
  HelpCircle,
  Lightbulb,
  TrendingUp,
  Plus,
  ChevronRight,
} from "lucide-react";

interface ArticlePreview {
  id: string;
  articleId: string;
  slug: string;
  title: string;
  category: string;
  subcategory?: string;
  type: string;
  summary?: string;
  tags?: string[];
  order?: number;
  updatedAt?: string;
}

interface CategoryCount {
  category: string;
  count: number;
}

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

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "platform-overview": <BookOpen className="h-5 w-5" />,
  courses: <FileText className="h-5 w-5" />,
  batches: <FileText className="h-5 w-5" />,
  payments: <TrendingUp className="h-5 w-5" />,
  attendance: <FileText className="h-5 w-5" />,
  assignments: <FileText className="h-5 w-5" />,
  certificates: <FileText className="h-5 w-5" />,
  tickets: <HelpCircle className="h-5 w-5" />,
};

export default function KnowledgeCenterPage() {
  const { roles } = useAdminUser();
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [recentArticles, setRecentArticles] = useState<ArticlePreview[]>([]);
  const [faqs, setFaqs] = useState<ArticlePreview[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = roles?.includes(ROLE.ADMIN) || roles?.includes(ROLE.SUPER_ADMIN);

  useEffect(() => {
    Promise.all([
      api<{ articles: ArticlePreview[] }>("/api/knowledge/articles?limit=6"),
      api<CategoryCount[]>("/api/knowledge/categories"),
      api<ArticlePreview[]>("/api/knowledge/faqs?limit=5"),
    ])
      .then(([articlesRes, catsRes, faqsRes]) => {
        if (articlesRes.success && articlesRes.data) {
          setRecentArticles(
            Array.isArray(articlesRes.data)
              ? articlesRes.data
              : (articlesRes.data as { articles: ArticlePreview[] }).articles ?? []
          );
        }
        if (catsRes.success && catsRes.data) setCategories(Array.isArray(catsRes.data) ? catsRes.data : []);
        if (faqsRes.success && faqsRes.data) setFaqs(Array.isArray(faqsRes.data) ? faqsRes.data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      window.location.href = `/knowledge-center/search?q=${encodeURIComponent(search.trim())}`;
    }
  }

  if (loading) {
    return (
      <AppPageShell>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <p className="mt-4 text-sm text-slate-500">Loading Knowledge Center…</p>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-14">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBoLTJ2NEgwdjJoMzZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-indigo-200" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Knowledge Center</h1>
          </div>
          <p className="mt-3 max-w-xl text-sm text-indigo-100 sm:text-base">
            Your complete guide to FUNT. Find step-by-step guides, FAQs, troubleshooting tips, and best practices for every feature.
          </p>
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-6 flex max-w-lg gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guides, FAQs, troubleshooting…"
                className="w-full rounded-xl border-0 bg-white/95 py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-lg backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              Search
            </button>
          </form>
        </div>
        {isAdmin && (
          <Link
            href="/knowledge-center/manage"
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/30 sm:right-6 sm:top-6"
          >
            <Plus className="h-3.5 w-3.5" />
            Manage Articles
          </Link>
        )}
      </div>

      {/* Categories Grid */}
      {categories.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-slate-800">Browse by Category</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.category}
                href={`/knowledge-center/search?category=${cat.category}`}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition group-hover:bg-indigo-200">
                  {CATEGORY_ICONS[cat.category] ?? <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {CATEGORY_LABELS[cat.category] ?? cat.category}
                  </p>
                  <p className="text-xs text-slate-500">{cat.count} article{cat.count !== 1 ? "s" : ""}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-500" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Articles */}
      {recentArticles.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Recent Guides</h2>
            <Link
              href="/knowledge-center/search"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentArticles.map((article) => (
              <Link
                key={article.id}
                href={`/knowledge-center/articles/${article.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    {article.type === "FAQ" ? (
                      <HelpCircle className="h-4 w-4" />
                    ) : article.type === "TROUBLESHOOTING" ? (
                      <Lightbulb className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-slate-800 group-hover:text-indigo-700">
                      {article.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{article.summary ?? ""}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {CATEGORY_LABELS[article.category] ?? article.category}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                        {article.type}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQs Section */}
      {faqs.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Frequently Asked Questions</h2>
            <Link
              href="/knowledge-center/search?type=FAQ"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              All FAQs →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {faqs.map((faq) => (
              <Link
                key={faq.id}
                href={`/knowledge-center/articles/${faq.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md"
              >
                <HelpCircle className="h-5 w-5 shrink-0 text-indigo-500" />
                <span className="flex-1 text-sm font-medium text-slate-700 group-hover:text-indigo-700">
                  {faq.title}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-500" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {categories.length === 0 && recentArticles.length === 0 && (
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <BookOpen className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Knowledge Center is empty</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            No articles have been published yet. {isAdmin ? "Start by creating your first guide." : "Check back soon for helpful documentation."}
          </p>
          {isAdmin && (
            <Link
              href="/knowledge-center/manage/new"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create First Article
            </Link>
          )}
        </div>
      )}
    </AppPageShell>
  );
}
