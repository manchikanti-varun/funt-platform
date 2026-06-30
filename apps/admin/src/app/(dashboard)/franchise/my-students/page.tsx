"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageHeader } from "@/components/ui";

interface StudentRow {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  studentMobile: string;
  batchId: string;
  batchName: string;
  enrolledAt: string;
  status: string;
}

export default function FranchiseStudentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api<{ rows: StudentRow[]; total: number }>(`/api/franchise/students?page=${page}&limit=50`)
      .then((r) => {
        if (r.success && r.data) {
          setRows(r.data.rows);
          setTotal(r.data.total);
        }
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <AppPageShell>
      <PageHeader
        title="My Students"
        subtitle={`${total} students enrolled through your franchise.`}
        actions={
          <Link
            href="/franchise/my-students/register"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
          >
            + Register Student
          </Link>
        }
      />

      <DataPanel className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="font-medium">No students enrolled yet</p>
            <p className="mt-1 text-sm">Register new students and enroll them into your batches.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Name</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Username</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Mobile</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Batch</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Enrolled</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.enrollmentId} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{r.studentName}</td>
                    <td className="px-5 py-4 text-sm font-mono text-slate-600">{r.studentUsername}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{r.studentMobile}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{r.batchName}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {new Date(r.enrolledAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 50 && (
          <div className="flex items-center justify-center gap-4 border-t border-slate-200 px-5 py-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-sm">Previous</button>
            <span className="text-sm text-slate-600">Page {page}</span>
            <button disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm">Next</button>
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
