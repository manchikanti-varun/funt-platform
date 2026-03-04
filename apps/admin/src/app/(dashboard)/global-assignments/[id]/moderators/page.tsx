"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface AssignmentInfo {
  id: string;
  title: string;
  moderatorIds?: string[];
}

import { BackLink } from "@/components/ui/BackLink";

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function AssignmentModeratorsPage() {
  const params = useParams();
  const id = params.id as string;
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [moderatorIdsText, setModeratorIdsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api<AssignmentInfo>(`/api/global-assignments/${id}`).then((r) => {
      if (r.success && r.data) {
        setAssignment(r.data);
        setModeratorIdsText(Array.isArray(r.data.moderatorIds) ? r.data.moderatorIds.join(", ") : "");
      }
      setLoading(false);
    });
  }, [id]);

  async function saveModerators() {
    setActionLoading(true);
    setError("");
    const moderatorIds = moderatorIdsText.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await api(`/api/global-assignments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ moderatorIds }),
    });
    setActionLoading(false);
    if (!res.success) setError(res.message ?? "Failed to save moderators.");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-slate-700">Assignment not found.</p>
        <Link href="/global-assignments" className="mt-4 text-teal-600 hover:underline">Back to Assignments</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BackLink href={`/global-assignments/${id}/view`}>Back to assignment</BackLink>
          <span className="text-slate-400">|</span>
          <Link href={`/global-assignments/${id}/student-access`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Student access
          </Link>
          <Link href={`/global-assignments/${id}/submissions`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Submissions
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 to-white px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Moderators</h1>
          <p className="mt-1 text-sm text-slate-600">{assignment.title}</p>
          <p className="mt-2 text-sm text-slate-500">
            Other admins or trainers who can edit this assignment. Comma-separated FUNT IDs.
          </p>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={moderatorIdsText}
              onChange={(e) => setModeratorIdsText(e.target.value)}
              placeholder="e.g. AD-26-0001, TR-26-00001"
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={saveModerators} disabled={actionLoading} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              Save moderators
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
