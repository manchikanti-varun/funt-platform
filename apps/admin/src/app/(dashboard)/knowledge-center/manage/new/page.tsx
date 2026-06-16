"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { AppPageShell, BackLink, useAppDialog } from "@/components/ui";
import { KnowledgeArticleForm } from "@/components/knowledge/ArticleForm";

export default function NewArticlePage() {
  const router = useRouter();
  const dialog = useAppDialog();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(data: Record<string, unknown>) {
    setSaving(true);
    const res = await api("/api/admin/knowledge", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.success) {
      router.push("/knowledge-center/manage");
    } else {
      await dialog.alert({ title: "Error", message: res.message ?? "Failed to create article." });
    }
  }

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.SUPER_ADMIN]} />
      <BackLink href="/knowledge-center/manage">Back to Manage</BackLink>
      <div className="mx-auto mt-6 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Article</h1>
        <p className="mt-1 text-sm text-slate-600">Add a new article to the Knowledge Center.</p>
        <div className="mt-6">
          <KnowledgeArticleForm onSubmit={handleSubmit} saving={saving} />
        </div>
      </div>
    </AppPageShell>
  );
}
