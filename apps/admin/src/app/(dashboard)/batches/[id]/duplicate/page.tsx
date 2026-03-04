"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function DuplicateBatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDuplicate() {
    setError("");
    setLoading(true);
    const res = await api(`/api/batches/${id}/duplicate`, { method: "POST" });
    setLoading(false);
    if (res.success) router.push("/batches");
    else setError(res.message ?? "Failed to duplicate.");
  }

  return (
    <div className="space-y-6">
      <Link href="/batches" className="text-sm font-medium text-slate-500 hover:text-teal-600">Back to Batches</Link>
      <h1 className="text-2xl font-bold text-slate-800">Duplicate Batch</h1>
      <p className="text-slate-600">Create a copy of this batch. Enrollments are not copied.</p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
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
              Duplicate Batch
            </>
          )}
        </button>
        <Link href="/batches" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          Cancel
        </Link>
      </div>
    </div>
  );
}
