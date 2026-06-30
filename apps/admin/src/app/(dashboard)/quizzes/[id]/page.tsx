"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { QuizForm } from "@/components/quizzes/QuizForm";

export default function QuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Record<string, unknown>>(`/api/quizzes/${id}`);
    if (r.success && r.data) setQuiz(r.data);
    else setError(r.message ?? "Quiz not found");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    setError("");
    const r = await api(`/api/quizzes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (r.success) {
      router.push("/quizzes");
    } else {
      setError(r.message ?? "Failed to update quiz");
    }
  }

  if (loading) {
    return (
      <AppPageShell>
        <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </AppPageShell>
    );
  }

  return (
    <>
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <AppPageShell>
        <div className="mb-6">
          <Link href="/quizzes" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back to Quizzes
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Edit Quiz</h1>
        </div>
        {error && <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
        {quiz && <QuizForm initialData={quiz as never} onSave={handleSave} saving={saving} />}
      </AppPageShell>
    </>
  );
}
