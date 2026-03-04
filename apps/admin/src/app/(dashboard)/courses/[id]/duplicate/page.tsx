"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

import { BackLink } from "@/components/ui/BackLink";

export default function DuplicateCoursePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDuplicate() {
    setError("");
    setLoading(true);
    const res = await api(`/api/courses/${id}/duplicate`, { method: "POST" });
    setLoading(false);
    if (res.success) router.push("/courses");
    else setError(res.message ?? "Failed to duplicate.");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-6">
        <BackLink href="/courses">Back to Courses</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Duplicate Course</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a copy of this course. The new course will have the same title, description, and module order (snapshots).
          </p>
        </div>
        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Duplicating…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Duplicate Course
                </>
              )}
            </button>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
