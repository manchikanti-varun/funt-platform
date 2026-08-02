"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";

interface QuizItem {
  _id: string;
  quizId?: string;
  title: string;
  type: string;
  status: string;
  passingScore: number;
  questionCount?: number;
  updatedAt?: string;
}

export default function QuizzesPage() {
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);

  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activating, setActivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    const url = qs ? `/api/quizzes?${qs}` : "/api/quizzes";
    const r = await api<QuizItem[]>(url);
    if (r.success && r.data) setQuizzes(r.data);
    setLoading(false);
  }, [typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const draftIds = quizzes
    .filter((q) => q.status === "DRAFT")
    .map((q) => q.quizId ?? q._id);

  async function activateAllDrafts() {
    if (draftIds.length === 0) return;
    if (!confirm(`Activate all ${draftIds.length} draft quiz(zes)?`)) return;
    setActivating(true);
    const r = await api("/api/quizzes/bulk-status", {
      method: "POST",
      body: JSON.stringify({ ids: draftIds, status: "ACTIVE" }),
    });
    setActivating(false);
    if (r.success) {
      await load();
    } else {
      alert("Failed to activate quizzes. Please try again.");
    }
  }

  return (
    <>
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <AppPageShell>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Quizzes</h1>
          <div className="flex items-center gap-2">
            {isSuperAdmin && draftIds.length > 0 && (
              <button
                onClick={activateAllDrafts}
                disabled={activating}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition"
              >
                {activating ? "Activating…" : `Activate ${draftIds.length} Draft${draftIds.length === 1 ? "" : "s"}`}
              </button>
            )}
            <Link href="/quizzes/new" className="btn-primary text-sm">
              + Create Quiz
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Types</option>
            <option value="CHAPTER">Chapter</option>
            <option value="MILESTONE">Milestone</option>
            <option value="COURSE_FINAL">Course Final</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <DataPanel>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : quizzes.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No quizzes found. Create your first quiz to get started.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {quizzes.map((q) => (
                <Link
                  key={q._id}
                  href={`/quizzes/${q.quizId ?? q._id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{q.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">{q.type}</span>
                      <span className={`rounded px-1.5 py-0.5 font-medium ${
                        q.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                        q.status === "DRAFT" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{q.status}</span>
                      <span>{q.questionCount ?? 0} questions</span>
                      <span>Pass: {q.passingScore}%</span>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </DataPanel>
      </AppPageShell>
    </>
  );
}
