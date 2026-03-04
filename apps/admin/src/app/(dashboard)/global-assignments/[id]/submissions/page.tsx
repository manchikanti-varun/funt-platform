"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { SUBMISSION_REVIEW_STATUS } from "@funt-platform/constants";

interface AssignmentInfo {
  id: string;
  title: string;
}

interface ModuleSubmission {
  id: string;
  type: "module";
  studentId: string;
  batchId: string;
  batchName: string;
  moduleOrder: number;
  assignmentId: string;
  submissionType: string;
  submissionContent: string;
  status: string;
  feedback?: string;
  rating?: number;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

interface GeneralSubmission {
  id: string;
  type: "general";
  studentId: string;
  assignmentId: string;
  submissionType: string;
  submissionContent: string;
  status: string;
  feedback?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

type SubmissionRow = ModuleSubmission | GeneralSubmission;

import { BackLink } from "@/components/ui/BackLink";

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

function statusBadge(status: string) {
  if (status === SUBMISSION_REVIEW_STATUS.PENDING)
    return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Pending</span>;
  if (status === SUBMISSION_REVIEW_STATUS.APPROVED)
    return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Approved</span>;
  return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Rejected</span>;
}

export default function AssignmentSubmissionsPage() {
  const params = useParams();
  const id = params.id as string;
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [moduleSubmissions, setModuleSubmissions] = useState<ModuleSubmission[]>([]);
  const [generalSubmissions, setGeneralSubmissions] = useState<GeneralSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<SubmissionRow | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<{ assignment: AssignmentInfo; moduleSubmissions: ModuleSubmission[]; generalSubmissions: GeneralSubmission[] }>(
      `/api/global-assignments/${id}/submissions`
    )
      .then((r) => {
        if (r.success && r.data) {
          setAssignment(r.data.assignment);
          setModuleSubmissions(r.data.moduleSubmissions ?? []);
          setGeneralSubmissions(r.data.generalSubmissions ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function submitReview(sub: SubmissionRow) {
    setSubmitting(true);
    setError("");
    const isModule = sub.type === "module";
    const url = isModule
      ? `/api/assignments/${sub.id}/review`
      : `/api/global-assignments/submissions/${sub.id}/review`;
    const res = await api(url, {
      method: "PATCH",
      body: JSON.stringify({
        status: reviewStatus,
        feedback: feedback || undefined,
        ...(isModule && rating ? { rating: Number(rating) } : {}),
      }),
    });
    setSubmitting(false);
    if (res.success) {
      setReviewing(null);
      setFeedback("");
      setRating("");
      const refetch = await api<{ assignment: AssignmentInfo; moduleSubmissions: ModuleSubmission[]; generalSubmissions: GeneralSubmission[] }>(
        `/api/global-assignments/${id}/submissions`
      );
      if (refetch.success && refetch.data) {
        setModuleSubmissions(refetch.data.moduleSubmissions ?? []);
        setGeneralSubmissions(refetch.data.generalSubmissions ?? []);
      }
    } else {
      setError(res.message ?? "Failed to submit review");
    }
  }

  const pendingModuleIds = moduleSubmissions.filter((s) => s.status === SUBMISSION_REVIEW_STATUS.PENDING).map((s) => s.id);
  const pendingGeneralIds = generalSubmissions.filter((s) => s.status === SUBMISSION_REVIEW_STATUS.PENDING).map((s) => s.id);
  const allPendingIds = [...pendingModuleIds, ...pendingGeneralIds];
  const hasPending = allPendingIds.length > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size >= allPendingIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(allPendingIds));
  }

  async function bulkReview(status: "APPROVED" | "REJECTED") {
    const ids = Array.from(selectedIds).filter((id) => allPendingIds.includes(id));
    if (ids.length === 0) return;
    const moduleIds = ids.filter((id) => pendingModuleIds.includes(id));
    const generalIds = ids.filter((id) => pendingGeneralIds.includes(id));
    setBulkSubmitting(true);
    setError("");
    const errors: string[] = [];
    if (moduleIds.length > 0) {
      const res = await api<{ reviewed: number; skipped: number; errors: string[] }>("/api/assignments/bulk-review", {
        method: "POST",
        body: JSON.stringify({ submissionIds: moduleIds, status, feedback: bulkFeedback || undefined }),
      });
      if (!res.success) errors.push(res.message ?? "Module bulk failed");
      else if (res.data?.errors?.length) errors.push(...(res.data.errors as string[]));
    }
    if (generalIds.length > 0) {
      const res = await api<{ reviewed: number; skipped: number; errors: string[] }>(
        "/api/global-assignments/submissions/bulk-review",
        { method: "POST", body: JSON.stringify({ submissionIds: generalIds, status, feedback: bulkFeedback || undefined }) }
      );
      if (!res.success) errors.push(res.message ?? "General bulk failed");
      else if (res.data?.errors?.length) errors.push(...(res.data.errors as string[]));
    }
    setBulkSubmitting(false);
    setSelectedIds(new Set());
    setBulkFeedback("");
    if (errors.length) setError(errors.join("; "));
    const refetch = await api<{ assignment: AssignmentInfo; moduleSubmissions: ModuleSubmission[]; generalSubmissions: GeneralSubmission[] }>(
      `/api/global-assignments/${id}/submissions`
    );
    if (refetch.success && refetch.data) {
      setModuleSubmissions(refetch.data.moduleSubmissions ?? []);
      setGeneralSubmissions(refetch.data.generalSubmissions ?? []);
    }
  }

  const allSubmissions: SubmissionRow[] = [...moduleSubmissions, ...generalSubmissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  const pendingCount = allSubmissions.filter((s) => s.status === SUBMISSION_REVIEW_STATUS.PENDING).length;

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading submissions…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <BackLink href={`/global-assignments/${id}/view`}>Back to assignment</BackLink>
          <span className="text-slate-400">|</span>
          <Link href={`/global-assignments/${id}/student-access`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Student access
          </Link>
          <Link href={`/global-assignments/${id}/moderators`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Moderators
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Submissions {assignment ? `— ${assignment.title}` : ""}
          </h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
        {allSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-slate-600">No submissions yet for this assignment.</p>
            <p className="mt-1 text-sm text-slate-500">Students will appear here when they submit.</p>
          </div>
        ) : (
          <>
            {hasPending && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={allPendingIds.length > 0 && selectedIds.size === allPendingIds.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Select all pending
                </label>
                <span className="text-sm text-slate-500">
                  {selectedIds.size} selected
                </span>
                <div className="flex gap-2">
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
                </div>
                <input
                  type="text"
                  placeholder="Optional feedback for all"
                  value={bulkFeedback}
                  onChange={(e) => setBulkFeedback(e.target.value)}
                  className="max-w-xs rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            )}
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {hasPending ? (
                    <th className="w-10 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <span className="sr-only">Select</span>
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Context</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Submission</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Submitted</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {allSubmissions.map((s) => (
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
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {s.type === "module" ? `${s.batchName} · Module ${(s.moduleOrder ?? 0) + 1}` : "General"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{s.studentId}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600" title={s.submissionContent}>
                      {s.submissionContent?.slice(0, 60)}
                      {(s.submissionContent?.length ?? 0) > 60 ? "…" : ""}
                    </td>
                    <td className="px-4 py-3">{statusBadge(s.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(s.submittedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {s.status === SUBMISSION_REVIEW_STATUS.PENDING ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewing(s);
                            setReviewStatus("APPROVED");
                            setFeedback("");
                            setRating("");
                            setError("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
                        >
                          Review
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {s.reviewedAt ? new Date(s.reviewedAt).toLocaleDateString() : ""}
                        </span>
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

      {reviewing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Review submission</h2>
            <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {reviewing.submissionContent}
            </div>
            <div className="mt-4 space-y-3">
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
                  className="min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Optional feedback for the student"
                />
              </div>
              {reviewing.type === "module" && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Rating (optional, 1–5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="1–5"
                  />
                </div>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => submitReview(reviewing)}
                disabled={submitting}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewing(null);
                  setFeedback("");
                  setRating("");
                  setError("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
