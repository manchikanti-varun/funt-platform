"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { AppPageShell, DataPanel, BackLink, useAppDialog } from "@/components/ui";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";

interface Article {
  id: string;
  articleId: string;
  slug: string;
  title: string;
  category: string;
  type: string;
  roles: string[];
  isPublished: boolean;
  version: number;
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

export default function ManageKnowledgePage() {
  const dialog = useAppDialog();
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPublished, setFilterPublished] = useState("");

  async function fetchArticles(p: number) {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (filterType) params.set("type", filterType);
    if (filterPublished) params.set("isPublished", filterPublished);
    params.set("page", String(p));
    params.set("limit", "20");

    const res = await api<{ articles: Article[]; total: number }>(
      `/api/admin/knowledge?${params.toString()}`
    );
    if (res.success && res.data) {
      setArticles(res.data.articles ?? []);
      setTotal(res.data.total ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchArticles(page);
  }, [page, filterCategory, filterType, filterPublished]);

  async function handleDelete(articleId: string, title: string) {
    const ok = await dialog.confirm({
      title: "Delete article",
      message: `Permanently delete "${title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const res = await api(`/api/admin/knowledge/${articleId}`, { method: "DELETE" });
    if (res.success) {
      setArticles((prev) => prev.filter((a) => a.articleId !== articleId));
      setTotal((t) => t - 1);
    } else {
      await dialog.alert({ title: "Delete failed", message: res.message ?? "Failed to delete." });
    }
  }

  async function togglePublish(article: Article) {
    const res = await api(`/api/admin/knowledge/${article.articleId}`, {
      method: "PUT",
      body: JSON.stringify({ isPublished: !article.isPublished }),
    });
    if (res.success) {
      setArticles((prev) =>
        prev.map((a) => a.articleId === article.articleId ? { ...a, isPublished: !a.isPublished } : a)
      );
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <AppPageShell className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[ROLE.SUPER_ADMIN]} />
      <div className="shrink-0 space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink href="/knowledge-center">Back to Knowledge Center</BackLink>
          <Link
            href="/knowledge-center/manage/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 hover:shadow-lg"
          >
            <Plus className="h-4 w-4" />
            New Article
          </Link>
        </div>
      </div>

      <DataPanel className="min-h-0 flex-1 overflow-auto shadow-xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Manage Articles</h2>
          <p className="mt-1 text-sm text-slate-600">
            {total} article{total !== 1 ? "s" : ""} total. Create, edit, and publish knowledge base content.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Types</option>
              <option value="GUIDE">Guide</option>
              <option value="FAQ">FAQ</option>
              <option value="TROUBLESHOOTING">Troubleshooting</option>
              <option value="RELEASE_NOTE">Release Note</option>
              <option value="ONBOARDING">Onboarding</option>
            </select>
            <select
              value={filterPublished}
              onChange={(e) => { setFilterPublished(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Status</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
            <p className="mt-4 text-sm text-slate-500">Loading articles…</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-medium text-slate-700">No articles found</p>
            <p className="mt-1 text-sm text-slate-500">Try adjusting filters or create a new article.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Title</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Category</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Type</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Roles</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {articles.map((a) => (
                  <tr key={a.articleId} className="transition hover:bg-slate-50/80">
                    <td className="max-w-[200px] truncate px-5 py-4 text-sm font-medium text-slate-800">{a.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{CATEGORY_LABELS[a.category] ?? a.category}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{a.type}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {a.roles.map((r) => (
                          <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={a.isPublished ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800" : "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"}>
                        {a.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/knowledge-center/articles/${a.slug}`} title="Preview" className="admin-table-action">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button onClick={() => togglePublish(a)} title={a.isPublished ? "Unpublish" : "Publish"} className="admin-table-action">
                          {a.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <Link href={`/knowledge-center/manage/${a.articleId}/edit`} title="Edit" className="admin-table-action">
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button onClick={() => handleDelete(a.articleId, a.title)} title="Delete" className="admin-table-action text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
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
