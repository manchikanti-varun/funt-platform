"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { QuizForm } from "@/components/quizzes/QuizForm";

export default function NewQuizPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    setError("");
    const r = await api("/api/quizzes", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (r.success) {
      router.push("/quizzes");
    } else {
      setError(r.message ?? "Failed to create quiz");
    }
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
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Create Quiz</h1>
        </div>
        {error && <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
        <QuizForm onSave={handleSave} saving={saving} />
      </AppPageShell>
    </>
  );
}
