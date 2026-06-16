"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { AppPageShell, BackLink, useAppDialog } from "@/components/ui";
import { KnowledgeArticleForm } from "@/components/knowledge/ArticleForm";

interface ArticleData {
  articleId: string;
  title: string;
  category: string;
  subcategory?: string;
  type: string;
  roles: string[];
  content: string;
  summary?: string;
  tags?: string[];
  relatedArticleIds?: string[];
  order?: number;
  onboardingStep?: number;
  onboardingRole?: string;
  isPublished: boolean;
}

export default function EditArticlePage() {
  const params = useParams();
  const articleId = params.articleId as string;
  const router = useRouter();
  const dialog = useAppDialog();
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!articleId) return;
    api<{ articles: ArticleData[] }>(`/api/admin/knowledge?limit=50`)
      .then((res) => {
        if (res.success && res.data) {
          const found = res.data.articles?.find((a) => a.articleId === articleId);
          if (found) setArticle(found);
        }
      })
      .finally(() => setLoading(false));
  }, [articleId]);

  async function handleSubmit(data: Record<string, unknown>) {
    setSaving(true);
    const res = await api(`/api/admin/knowledge/${articleId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.success) {
      router.push("/knowledge-center/manage");
    } else {
      await dialog.alert({ title: "Error", message: res.message ?? "Failed to update article." });
    }
  }

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

  if (!article) {
    return (
      <AppPageShell>
        <BackLink href="/knowledge-center/manage">Back to Manage</BackLink>
        <div className="mt-8 text-center">
          <p className="text-lg font-semibold text-slate-800">Article not found</p>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} />
      <BackLink href="/knowledge-center/manage">Back to Manage</BackLink>
      <div className="mx-auto mt-6 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Article</h1>
        <p className="mt-1 text-sm text-slate-600">Update "{article.title}"</p>
        <div className="mt-6">
          <KnowledgeArticleForm initialData={article} onSubmit={handleSubmit} saving={saving} />
        </div>
      </div>
    </AppPageShell>
  );
}
