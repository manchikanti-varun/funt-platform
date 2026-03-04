"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";

interface EnrollmentRequestRow {
  id: string;
  batchId: string;
  batchName: string;
  courseTitle: string;
  studentId: string;
  studentFuntId?: string;
  studentName?: string;
  studentEmail?: string;
  requestedAt: string;
}

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function BatchEnrollmentRequestsPage() {
  const params = useParams();
  const id = params.id as string;
  const [batchName, setBatchName] = useState("");
  const [requests, setRequests] = useState<EnrollmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadRequests() {
    if (!id) return;
    setRequestsLoading(true);
    const res = await api<EnrollmentRequestRow[]>(`/api/enrollments/requests?batchId=${encodeURIComponent(id)}`);
    setRequestsLoading(false);
    if (res.success && Array.isArray(res.data)) setRequests(res.data);
    else setRequests([]);
  }

  useEffect(() => {
    if (!id) return;
    api<{ name: string }>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) setBatchName(r.data.name);
      setLoading(false);
    });
    loadRequests();
  }, [id]);

  async function respondToRequest(requestId: string, action: "APPROVE" | "REJECT") {
    setActingRequestId(requestId);
    setError("");
    const res = await api(`/api/enrollments/requests/${requestId}/respond`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    setActingRequestId(null);
    if (res.success) loadRequests();
    else if (res.message) setError(res.message);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BackLink href={`/batches/${id}/view`}>Back to batch</BackLink>
          <span className="text-slate-400">|</span>
          <Link href={`/batches/${id}/student-access`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Student access
          </Link>
          <Link href={`/batches/${id}/moderators`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Moderators
          </Link>
          <Link href={`/batches/${id}/submissions`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Assignment submissions
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 to-white px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Enrollment requests</h1>
          <p className="mt-1 text-sm text-slate-600">{batchName}</p>
          <p className="mt-2 text-sm text-slate-500">
            Students who requested enrollment for this batch. Approve to add them to the batch.
          </p>
        </div>

        <div className="p-6">
          {requestsLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
            </div>
          ) : requests.length === 0 ? (
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No pending requests for this batch.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Course</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Student</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Requested</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm text-slate-800">{r.courseTitle}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-mono font-medium text-slate-800">{r.studentFuntId ?? r.studentId}</span>
                        {r.studentName && <span className="ml-1 text-slate-500">— {r.studentName}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{new Date(r.requestedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => respondToRequest(r.id, "APPROVE")}
                            disabled={actingRequestId === r.id}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {actingRequestId === r.id ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => respondToRequest(r.id, "REJECT")}
                            disabled={actingRequestId === r.id}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
