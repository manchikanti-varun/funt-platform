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
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  async function handleDelete() {
    setDeleting(true);
    setError("");
    const r = await api(`/api/quizzes/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (r.success) {
      router.push("/quizzes");
    } else {
      setShowDeleteConfirm(false);
      setError(r.message ?? "Failed to delete quiz");
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
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/quizzes" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              Back to Quizzes
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">Edit Quiz</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition"
          >
            Delete Quiz
          </button>
        </div>
        {error && <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
        {quiz && <QuizForm initialData={quiz as never} onSave={handleSave} saving={saving} />}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900">Delete Quiz</h2>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to permanently delete this quiz? This action cannot be undone.
                If there are student attempts, the quiz cannot be deleted — archive it instead.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        )}
      </AppPageShell>
    </>
  );
}
