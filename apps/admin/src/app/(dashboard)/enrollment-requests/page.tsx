"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { AppPageShell } from "@/components/ui";

interface EnrollmentRequest {
  id: string;
  batchId: string;
  batchName: string;
  batchFuntId?: string;
  requestedCourseId?: string;
  courseTitle: string;
  studentId: string;
  studentUsername?: string;
  studentName?: string;
  studentEmail?: string;
  requestedAt: string;
}

export default function EnrollmentRequestsPage() {
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "APPROVE" | "REJECT" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<EnrollmentRequest[]>("/api/enrollments/requests");
    setLoading(false);
    if (res.success && Array.isArray(res.data)) setRequests(res.data);
    else setRequests([]);
    if (!res.success && res.message) setError(res.message);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(requestId: string, action: "APPROVE" | "REJECT") {
    setActingId(requestId);
    setConfirmAction(null);
    const res = await api<{ status: string; message?: string }>(
      `/api/enrollments/requests/${requestId}/respond`,
      { method: "POST", body: JSON.stringify({ action }) }
    );
    setActingId(null);
    if (res.success) load();
    else if (res.message) setError(res.message);
  }

  return (
    <AppPageShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enrollment Requests</h1>
          <p className="mt-1 text-sm text-slate-600">
            Students request access from the LMS &quot;Explore courses&quot; flow. Approve or reject here.
          </p>
        </div>
        <Link
          href="/batches"
          className="btn-secondary"
        >
          Batches
        </Link>
      </div>

      {error && (
        <div className="alert--warning flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={load} className="ml-3 text-sm font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800">
              {confirmAction.action === "APPROVE" ? "Approve enrollment?" : "Reject enrollment?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {confirmAction.action === "APPROVE"
                ? "This will enroll the student in the course immediately."
                : "This will decline the student's request. They can re-apply after 24 hours."}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmAction(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => respond(confirmAction.id, confirmAction.action)}
                className={confirmAction.action === "APPROVE" ? "btn-approve" : "btn-reject"}
              >
                {confirmAction.action === "APPROVE" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-slate-600">No pending enrollment requests.</p>
          <p className="mt-1 text-sm text-slate-500">
            When students request access from a course in the LMS, they will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Course
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Batch
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Student
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Requested
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                      {r.courseTitle}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {r.batchName}
                      {r.batchFuntId && (
                        <span className="ml-1 text-slate-400">({r.batchFuntId})</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <span className="font-mono font-medium text-slate-800">
                        {r.studentUsername ?? r.studentId}
                      </span>
                      {r.studentName && (
                        <span className="ml-1 text-slate-500">— {r.studentName}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                      {new Date(r.requestedAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ id: r.id, action: "APPROVE" })}
                          disabled={actingId === r.id}
                          className="btn-approve"
                        >
                          {actingId === r.id ? "…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ id: r.id, action: "REJECT" })}
                          disabled={actingId === r.id}
                          className="btn-reject"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
