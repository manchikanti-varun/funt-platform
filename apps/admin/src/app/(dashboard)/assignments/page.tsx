"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SUBMISSION_REVIEW_STATUS } from "@funt-platform/constants";

interface BatchOption {
  id: string;
  name: string;
}

interface Submission {
  id: string;
  studentId: string;
  batchId: string;
  moduleOrder: number;
  assignmentId: string;
  submissionType: string;
  status: string;
  feedback?: string;
  rating?: number;
  submittedAt: string;
  reviewedAt?: string;
}

export default function AssignmentsReviewPage() {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchId, setBatchId] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  useEffect(() => {
    api<BatchOption[]>("/api/batches").then((r) => {
      if (r.success && Array.isArray(r.data)) setBatches(r.data);
    });
  }, []);

  async function loadSubmissions() {
    if (!batchId) return;
    setLoading(true);
    const res = await api<Submission[]>(`/api/assignments/submissions?batchId=${encodeURIComponent(batchId)}`);
    setLoading(false);
    if (res.success && Array.isArray(res.data)) setSubmissions(res.data);
    else setSubmissions([]);
  }

  async function submitReview(subId: string) {
    const res = await api(`/api/assignments/${subId}/review`, {
      method: "PATCH",
      body: JSON.stringify({
        status: reviewStatus,
        feedback: feedback || undefined,
        rating: rating ? Number(rating) : undefined,
      }),
    });
    if (res.success) {
      setReviewingId(null);
      setFeedback("");
      setRating("");
      loadSubmissions();
    }
  }

  const pendingIds = submissions.filter((s) => s.status === SUBMISSION_REVIEW_STATUS.PENDING).map((s) => s.id);
  const hasPending = pendingIds.length > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size >= pendingIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingIds));
  }

  async function bulkReview(status: "APPROVED" | "REJECTED") {
    const ids = Array.from(selectedIds).filter((id) => pendingIds.includes(id));
    if (ids.length === 0) return;
    setBulkSubmitting(true);
    const res = await api<{ reviewed: number; skipped: number; errors: string[] }>("/api/assignments/bulk-review", {
      method: "POST",
      body: JSON.stringify({
        submissionIds: ids,
        status,
        feedback: feedback || undefined,
        rating: rating ? Number(rating) : undefined,
      }),
    });
    setBulkSubmitting(false);
    if (res.success) {
      setSelectedIds(new Set());
      setFeedback("");
      setRating("");
      loadSubmissions();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Assignment Review</h1>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Batch</label>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input w-64">
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button type="button" onClick={loadSubmissions} disabled={!batchId || loading} className="btn-primary">Load Submissions</button>
      </div>
      {submissions.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {hasPending && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={pendingIds.length > 0 && selectedIds.size === pendingIds.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Select all pending
              </label>
              <span className="text-sm text-slate-500">{selectedIds.size} selected</span>
              <button
                type="button"
                onClick={() => bulkReview("APPROVED")}
                disabled={bulkSubmitting || selectedIds.size === 0}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {bulkSubmitting ? "Processing…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => bulkReview("REJECTED")}
                disabled={bulkSubmitting || selectedIds.size === 0}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              >
                Reject
              </button>
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Optional feedback for all"
                className="max-w-xs rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {hasPending ? <th className="w-10 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"><span className="sr-only">Select</span></th> : null}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.map((s) => (
                <tr key={s.id} className="transition hover:bg-slate-50/80">
                  {hasPending ? (
                    <td className="w-10 px-2 py-3">
                      {s.status === SUBMISSION_REVIEW_STATUS.PENDING ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelect(s.id)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{s.studentId}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">Module {s.moduleOrder + 1}</td>
                  <td className="px-4 py-3">
                    <span className={s.status === SUBMISSION_REVIEW_STATUS.PENDING ? "badge-warning" : s.status === SUBMISSION_REVIEW_STATUS.APPROVED ? "badge-success" : "badge bg-red-100 text-red-800"}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : ""}</td>
                  <td className="px-4 py-3 text-right">
                    {s.status === SUBMISSION_REVIEW_STATUS.PENDING && (
                      <button type="button" onClick={() => setReviewingId(s.id)} className="text-sm font-medium text-teal-600 hover:text-teal-700">Review</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reviewingId && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Review Submission</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Decision</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus("APPROVED")}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${reviewStatus === "APPROVED" ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus("REJECTED")}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${reviewStatus === "REJECTED" ? "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  >
                    Reject
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Feedback</label>
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="input min-h-[80px]" placeholder="Optional feedback" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Rating (optional)</label>
                <input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} className="input" placeholder="1-5" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => submitReview(reviewingId)} className="btn-primary">Submit Review</button>
              <button type="button" onClick={() => { setReviewingId(null); setFeedback(""); setRating(""); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
