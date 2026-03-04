"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function BatchModeratorsPage() {
  const params = useParams();
  const id = params.id as string;
  const [batchName, setBatchName] = useState("");
  const [moderatorIdsText, setModeratorIdsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  /** Current moderators shown below (synced from API and after save). */
  const [moderatorsList, setModeratorsList] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    api<{ name: string; moderatorIds?: string[] }>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) {
        setBatchName(r.data.name);
        const ids = Array.isArray(r.data.moderatorIds) ? r.data.moderatorIds : [];
        setModeratorsList(ids);
        setModeratorIdsText("");
      }
      setLoading(false);
    });
  }, [id]);

  async function addModerators() {
    const newIds = moderatorIdsText.split(",").map((s) => s.trim()).filter(Boolean);
    if (newIds.length === 0) return;
    setActionLoading(true);
    setError("");
    setSuccess(false);
    const combined = [...new Set([...moderatorsList, ...newIds])];
    const res = await api<{ moderatorIds?: string[] }>(`/api/batches/${id}`, {
      method: "PUT",
      body: JSON.stringify({ moderatorIds: combined }),
    });
    setActionLoading(false);
    if (res.success) {
      setSuccess(true);
      setModeratorIdsText("");
      const fromResponse = Array.isArray(res.data?.moderatorIds) ? res.data.moderatorIds : combined;
      setModeratorsList(fromResponse);
      setTimeout(() => setSuccess(false), 5000);
    } else {
      setError(res.message ?? "Failed to add moderators.");
    }
  }

  async function removeModerator(mid: string) {
    setActionLoading(true);
    setError("");
    setSuccess(false);
    const next = moderatorsList.filter((id) => id !== mid);
    const res = await api<{ moderatorIds?: string[] }>(`/api/batches/${id}`, {
      method: "PUT",
      body: JSON.stringify({ moderatorIds: next }),
    });
    setActionLoading(false);
    if (res.success) {
      setSuccess(true);
      const fromResponse = Array.isArray(res.data?.moderatorIds) ? res.data.moderatorIds : next;
      setModeratorsList(fromResponse);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(res.message ?? "Failed to remove moderator.");
    }
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
          <Link href={`/batches/${id}/enrollment-requests`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Enrollment requests
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Moderators</h1>
          <p className="mt-1 text-sm text-slate-600">{batchName}</p>
          <p className="mt-2 text-sm text-slate-500">
            Add moderator FUNT IDs below; remove with the red delete icon.
          </p>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={moderatorIdsText}
              onChange={(e) => { setModeratorIdsText(e.target.value); setError(""); setSuccess(false); }}
              placeholder="FUNT ID (comma-separated to add multiple)"
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={addModerators} disabled={actionLoading || !moderatorIdsText.trim()} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              {actionLoading ? "Adding…" : "Add"}
            </button>
          </div>
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Updated. See current list below.
            </div>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700">Current moderators</h2>
            <p className="mt-1 text-xs text-slate-500">Click the red delete icon to remove a moderator from this batch.</p>
            {moderatorsList.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center text-sm text-slate-500">No moderators yet. Add FUNT IDs above and click Add.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
                {moderatorsList.map((mid) => (
                  <li key={mid} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-mono text-slate-800">{mid}</span>
                    <button
                      type="button"
                      onClick={() => removeModerator(mid)}
                      disabled={actionLoading}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
                      title="Remove moderator"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
