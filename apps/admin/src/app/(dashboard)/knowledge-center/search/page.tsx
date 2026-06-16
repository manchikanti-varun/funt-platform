"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, BackLink } from "@/components/ui";
import {
  Search,
  FileText,
  HelpCircle,
  Lightbulb,
  BookOpen,
  Tag,
  Filter,
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
  updatedAt?: string;
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

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "GUIDE", label: "Guides" },
  { value: "FAQ", label: "FAQs" },
  { value: "TROUBLESHOOTING", label: "Troubleshooting" },
  { value: "RELEASE_NOTE", label: "Release Notes" },
  { value: "ONBOARDING", label: "Onboarding" },
];

export default function KnowledgeSearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialCategory = searchParams.get("category") ?? "";
  const initialType = searchParams.get("type") ?? "";

  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [type, setType] = useState(initialType);
  const [articles, setArticles] = useState<ArticlePreview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(
    async (searchTerm: string, cat: string, articleType: string, p: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (cat) params.set("category", cat);
      if (articleType) params.set("type", articleType);
      params.set("page", String(p));
      params.set("limit", "20");

      const res = await api<{ articles: ArticlePreview[]; total: number }>(
        `/api/knowledge/articles?${params.toString()}`
      );
      if (res.success && res.data) {
        setArticles(res.data.articles ?? []);
        setTotal(res.data.total ?? 0);
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchArticles(search, category, type, page);
  }, [fetchArticles, page]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchArticles(search, category, type, 1);
    }, 400);
    return () => clearTimeout(t);
  }, [search, category, type, fetchArticles]);

  function typeIcon(t: string) {
    switch (t) {
      case "FAQ":
        return <HelpCircle className="h-4 w-4" />;
      case "TROUBLESHOOTING":
        return <Lightbulb className="h-4 w-4" />;
      case "ONBOARDING":
        return <BookOpen className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <AppPageShell className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-4 pb-4">
        <BackLink href="/knowledge-center">Back to Knowledge Center</BackLink>
      </div>

      <DataPanel className="min-h-0 flex-1 overflow-auto shadow-xl">
        {/* Search Header */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Search Knowledge Base</h2>
          <p className="mt-1 text-sm text-slate-600">
            {total > 0 ? `${total} article${total !== 1 ? "s" : ""} found` : "Search guides, FAQs, and troubleshooting articles"}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, content, or tags…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
            <p className="mt-4 text-sm text-slate-500">Searching…</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <Search className="h-8 w-8" />
            </div>
            <p className="mt-4 text-base font-medium text-slate-700">No articles found</p>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your search terms or filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/knowledge-center/articles/${article.slug}`}
                className="group flex gap-4 px-6 py-4 transition hover:bg-indigo-50/40"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition group-hover:bg-indigo-200">
                  {typeIcon(article.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{article.summary}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      <Filter className="h-2.5 w-2.5" />
                      {CATEGORY_LABELS[article.category] ?? article.category}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                      {article.type}
                    </span>
                    {article.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                        <Tag className="h-2 w-2" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {article.updatedAt && (
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:block">
                    {new Date(article.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
