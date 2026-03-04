"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { SUBMISSION_REVIEW_STATUS } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";

interface BatchModuleOption {
  courseId: string;
  courseTitle: string;
  moduleOrder: number;
  moduleTitle: string;
  label: string;
}

interface BatchSnapshot {
  courseId?: string;
  title?: string;
  modules?: Array<{ order?: number; title?: string }>;
}

interface Batch {
  id: string;
  name: string;
  courseSnapshots?: BatchSnapshot[];
  courseSnapshot?: BatchSnapshot;
}

interface Submission {
  id: string;
  studentId: string;
  batchId: string;
  courseId?: string;
  moduleOrder: number;
  assignmentId: string;
  submissionType: string;
  submissionContent?: string;
  status: string;
  feedback?: string;
  rating?: number;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function BatchSubmissionsPage() {
  const params = useParams();
  const id = params.id as string;
  const [batch, setBatch] = useState<Batch | null>(null);
  const [moduleOptions, setModuleOptions] = useState<BatchModuleOption[]>([]);
  const [selectedModule, setSelectedModule] = useState<BatchModuleOption | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api<Batch>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) {
        setBatch(r.data);
        const snapshots = Array.isArray(r.data.courseSnapshots) && r.data.courseSnapshots.length > 0
          ? r.data.courseSnapshots
          : r.data.courseSnapshot
            ? [r.data.courseSnapshot]
            : [];
        const options: BatchModuleOption[] = [];
        snapshots.forEach((snap) => {
          const courseId = snap.courseId ?? "";
          const courseTitle = snap.title ?? "Course";
          const modules = snap.modules ?? [];
          modules
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .forEach((mod, idx) => {
              const order = mod.order ?? idx;
              options.push({
                courseId,
                courseTitle,
                moduleOrder: order,
                moduleTitle: mod.title ?? `Module ${order + 1}`,
                label: snapshots.length > 1
                  ? `${courseTitle} — Module ${order + 1}: ${mod.title ?? ""}`
                  : `Module ${order + 1}: ${mod.title ?? ""}`,
              });
            });
        });
        setModuleOptions(options);
        if (options.length > 0 && !selectedModule) setSelectedModule(options[0]);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id || !selectedModule) {
      setSubmissions([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ batchId: id, moduleOrder: String(selectedModule.moduleOrder) });
    if (selectedModule.courseId) params.set("courseId", selectedModule.courseId);
    api<Submission[]>(`/api/assignments/submissions?${params.toString()}`)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setSubmissions(r.data);
        else setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, [id, selectedModule]);

  async function submitReview(subId: string) {
    setSubmitting(true);
    setError("");
    const res = await api(`/api/assignments/${subId}/review`, {
      method: "PATCH",
      body: JSON.stringify({
        status: reviewStatus,
        feedback: feedback || undefined,
        rating: rating ? Number(rating) : undefined,
      }),
    });
    setSubmitting(false);
    if (res.success) {
      setReviewingId(null);
      setFeedback("");
      setRating("");
      if (selectedModule) {
        const params = new URLSearchParams({ batchId: id, moduleOrder: String(selectedModule.moduleOrder) });
        if (selectedModule.courseId) params.set("courseId", selectedModule.courseId);
        const r = await api<Submission[]>(`/api/assignments/submissions?${params.toString()}`);
        if (r.success && Array.isArray(r.data)) setSubmissions(r.data);
      }
    } else setError(res.message ?? "Failed to submit review");
  }

  const pendingIds = submissions.filter((s) => s.status === SUBMISSION_REVIEW_STATUS.PENDING).map((s) => s.id);
  const hasPending = pendingIds.length > 0;

  function toggleSelect(subId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
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
    setError("");
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
      if (selectedModule) {
        const q = new URLSearchParams({ batchId: id, moduleOrder: String(selectedModule.moduleOrder) });
        if (selectedModule.courseId) q.set("courseId", selectedModule.courseId);
        const r = await api<Submission[]>(`/api/assignments/submissions?${q.toString()}`);
        if (r.success && Array.isArray(r.data)) setSubmissions(r.data);
      }
    } else setError(res.message ?? "Bulk review failed");
  }

  if (!batch) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading batch…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href={`/batches/${id}/view`}>Back to batch</BackLink>
          <span className="text-slate-400">|</span>
          <Link href={`/batches/${id}/student-access`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Student access
          </Link>
          <Link href={`/batches/${id}/enrollment-requests`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Enrollment requests
          </Link>
          <Link href={`/batches/${id}/moderators`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Moderators
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Assignment submissions</h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-5">
          <p className="text-sm text-slate-600">Select a module to see and review submissions for that module.</p>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Module</label>
            <select
              value={selectedModule ? `${selectedModule.courseId}-${selectedModule.moduleOrder}` : ""}
              onChange={(e) => {
                const val = e.target.value;
                const opt = moduleOptions.find((o) => `${o.courseId}-${o.moduleOrder}` === val);
                if (opt) setSelectedModule(opt);
              }}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              {moduleOptions.map((opt) => (
                <option key={`${opt.courseId}-${opt.moduleOrder}`} value={`${opt.courseId}-${opt.moduleOrder}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
            <p className="mt-4 text-sm text-slate-500">Loading submissions…</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-slate-600">No submissions for this module yet.</p>
            <p className="mt-1 text-sm text-slate-500">Students will appear here when they submit.</p>
          </div>
        ) : (
          <>
            {hasPending && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-3">
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {hasPending ? <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"><span className="sr-only">Select</span></th> : null}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Student (FUNT ID)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Submission</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Submitted</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {submissions.map((s) => (
                    <tr key={s.id} className="transition hover:bg-slate-50/80">
                      {hasPending ? (
                        <td className="w-10 px-4 py-3">
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
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600" title={s.submissionContent ?? ""}>
                        {(s.submissionContent ?? "").slice(0, 60)}
                        {(s.submissionContent?.length ?? 0) > 60 ? "…" : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            s.status === SUBMISSION_REVIEW_STATUS.PENDING
                              ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                              : s.status === SUBMISSION_REVIEW_STATUS.APPROVED
                                ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                                : "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
                          }
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : ""}</td>
                      <td className="px-4 py-3 text-right">
                        {s.status === SUBMISSION_REVIEW_STATUS.PENDING && (
                          <button
                            type="button"
                            onClick={() => setReviewingId(s.id)}
                            className="text-sm font-medium text-teal-600 hover:text-teal-700"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {reviewingId && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Review submission</h2>
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
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional feedback"
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Rating (optional)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="1-5"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => submitReview(reviewingId)}
                disabled={submitting}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewingId(null);
                  setFeedback("");
                  setRating("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
