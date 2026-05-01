"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/batches" />
      <div className="shrink-0 pb-6">
        <BackLink href="/batches">Back to Batches</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Duplicate Batch</h2>
          <p className="mt-1 text-sm text-slate-600">Create a copy of this batch. Enrollments are not copied.</p>
        </div>
        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleDuplicate} disabled={loading} className="btn-duplicate btn-duplicate--xl">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
                  Duplicating…
                </>
              ) : (
                <>
                  <DuplicateIcon />
                  Duplicate batch
                </>
              )}
            </button>
            <Link href="/batches" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
