"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";

interface BatchSummary {
  id: string;
  batchId?: string;
  name: string;
  status: string;
  courseSnapshots?: Array<{ title?: string; courseId?: string }>;
  trainerName?: string;
  startDate?: string;
}

export default function CertificatesPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<BatchSummary[]>("/api/batches?status=ACTIVE")
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setBatches(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppPageShell>
      <PageHeader
        title="Certificates"
        subtitle="Select a batch to view student completion status, generate certificates, and download PDFs."
      />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      )}

      {!loading && batches.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-500">No active batches found. Create a batch first.</p>
        </div>
      )}

      {!loading && batches.length > 0 && (
        <div className="space-y-3">
          {batches.map((b) => {
            const courses = b.courseSnapshots ?? [];
            const courseLabel = courses.length === 1
              ? courses[0]?.title ?? "1 course"
              : `${courses.length} courses`;
            return (
              <Link
                key={b.id}
                href={`/batches/${b.id}/certificates`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/30 hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-slate-900">{b.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {courseLabel}
                    {b.trainerName ? ` · ${b.trainerName}` : ""}
                    {b.batchId ? ` · ${b.batchId}` : ""}
                  </p>
                </div>
                <span className="text-sm font-medium text-violet-700">Manage →</span>
              </Link>
            );
          })}
        </div>
      )}
    </AppPageShell>
  );
}
