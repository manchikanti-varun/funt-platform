"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageHeader } from "@/components/ui";

interface FranchiseBatch {
  id: string;
  batchId?: string;
  name: string;
  courseSnapshots: Array<{ title?: string; courseId?: string }>;
  startDate: string;
  endDate?: string;
  status: string;
}

export default function FranchiseBatchesPage() {
  const [batches, setBatches] = useState<FranchiseBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ batches: FranchiseBatch[] }>("/api/franchise/batches")
      .then((r) => { if (r.success && r.data?.batches) setBatches(r.data.batches); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppPageShell>
      <PageHeader
        title="My Batches"
        subtitle="Batches assigned to your franchise center."
        actions={
          <Link
            href="/franchise/my-batches/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
          >
            + Create Batch
          </Link>
        }
      />

      <DataPanel className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : batches.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="font-medium">No batches yet</p>
            <p className="mt-1 text-sm">Create a batch using courses from the global library.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Name</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Course</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Start Date</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{b.name}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {b.courseSnapshots.length > 1
                        ? `${b.courseSnapshots.length} courses`
                        : (b.courseSnapshots[0]?.title ?? "—")}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {b.startDate ? new Date(b.startDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
