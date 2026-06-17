"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { AppPageShell, BackLink } from "@/components/ui";
import { BookOpen, ChevronRight } from "lucide-react";

interface OnboardingArticle {
  id: string;
  articleId: string;
  slug: string;
  title: string;
  summary?: string;
  order?: number;
}

const ROLE_LABELS: Record<string, string> = {
  [ROLE.SUPER_ADMIN]: "Super Admin",
  [ROLE.ADMIN]: "Admin",
  [ROLE.TRAINER]: "Trainer",
  [ROLE.STUDENT]: "Student",
  [ROLE.PARENT]: "Parent",
};

export default function OnboardingPage() {
  const { roles } = useAdminUser();
  const [selectedRole, setSelectedRole] = useState(roles?.[0] ?? ROLE.ADMIN);
  const [articles, setArticles] = useState<OnboardingArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<OnboardingArticle[]>(`/api/knowledge/onboarding?role=${selectedRole}`)
      .then((res) => {
        if (res.success && res.data) {
          setArticles(Array.isArray(res.data) ? res.data : []);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedRole]);

  // Determine which role tabs to show
  const availableRoles = roles?.includes(ROLE.SUPER_ADMIN)
    ? [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER, ROLE.STUDENT, ROLE.PARENT]
    : roles?.includes(ROLE.ADMIN)
    ? [ROLE.ADMIN, ROLE.TRAINER, ROLE.STUDENT, ROLE.PARENT]
    : roles?.includes(ROLE.TRAINER)
    ? [ROLE.TRAINER, ROLE.STUDENT]
    : [roles?.[0] ?? ROLE.STUDENT];

  return (
    <AppPageShell>
      <BackLink href="/knowledge-center">Back to Knowledge Center</BackLink>

      <div className="mt-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Onboarding Paths</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Step-by-step learning paths for each role. Follow these guides to get up to speed quickly.
        </p>

        {/* Role Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {availableRoles.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`tab-btn ${selectedRole === role ? "tab-btn--active" : ""}`}
            >
              {ROLE_LABELS[role] ?? role}
            </button>
          ))}
        </div>

        {/* Onboarding Steps */}
        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
              <p className="mt-4 text-sm text-slate-500">Loading onboarding path…</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center">
              <BookOpen className="h-12 w-12 text-slate-300" />
              <p className="mt-4 text-base font-medium text-slate-700">No onboarding path yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Onboarding guides for {ROLE_LABELS[selectedRole]} have not been created yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article, index) => (
                <Link
                  key={article.id}
                  href={`/knowledge-center/articles/${article.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">{article.title}</h3>
                    {article.summary && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{article.summary}</p>}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-indigo-500" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppPageShell>
  );
}
