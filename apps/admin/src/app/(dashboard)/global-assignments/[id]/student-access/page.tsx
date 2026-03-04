"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface AllowedStudent {
  id: string;
  funtId: string;
  name: string;
}

interface AssignmentInfo {
  id: string;
  title: string;
  type?: string;
}

import { BackLink } from "@/components/ui/BackLink";

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function AssignmentStudentAccessPage() {
  const params = useParams();
  const id = params.id as string;
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [allowedStudents, setAllowedStudents] = useState<AllowedStudent[]>([]);
  const [accessFuntId, setAccessFuntId] = useState("");
  const [accessBulkText, setAccessBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api<AssignmentInfo>(`/api/global-assignments/${id}`).then((r) => {
      if (r.success && r.data) {
        setAssignment(r.data);
        if (r.data.type !== "general") setLoading(false);
      } else setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id || !assignment || assignment.type !== "general") return;
    api<AllowedStudent[]>(`/api/global-assignments/${id}/access`).then((r) => {
      if (r.success && Array.isArray(r.data)) setAllowedStudents(r.data);
      setLoading(false);
    });
  }, [id, assignment]);

  async function addAccess() {
    if (!accessFuntId.trim()) return;
    setAccessLoading(true);
    setError("");
    const res = await api(`/api/global-assignments/${id}/access`, {
      method: "POST",
      body: JSON.stringify({ funtId: accessFuntId.trim() }),
    });
    setAccessLoading(false);
    if (res.success) {
      setAccessFuntId("");
      const r = await api<AllowedStudent[]>(`/api/global-assignments/${id}/access`);
      if (r.success && Array.isArray(r.data)) setAllowedStudents(r.data);
    } else setError(res.message ?? "Failed to add.");
  }

  async function bulkAddAccess() {
    const raw = accessBulkText.trim();
    if (!raw) return;
    const identifiers = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (identifiers.length === 0) return;
    setAccessLoading(true);
    setError("");
    const res = await api<{ added: number; skipped: number; notFound: string[] }>(
      `/api/global-assignments/${id}/access/bulk`,
      { method: "POST", body: JSON.stringify({ identifiers }) }
    );
    setAccessLoading(false);
    if (res.success && res.data) {
      setAccessBulkText("");
      if (res.data.notFound?.length)
        setError(`Added: ${res.data.added}, not found: ${res.data.notFound.join(", ")}`);
      const r = await api<AllowedStudent[]>(`/api/global-assignments/${id}/access`);
      if (r.success && Array.isArray(r.data)) setAllowedStudents(r.data);
    } else setError(res.message ?? "Bulk add failed.");
  }

  async function removeAccess(studentId: string) {
    setAccessLoading(true);
    setError("");
    const res = await api(`/api/global-assignments/${id}/access/${studentId}`, { method: "DELETE" });
    setAccessLoading(false);
    if (res.success) setAllowedStudents((prev) => prev.filter((s) => s.id !== studentId));
    else setError(res.message ?? "Failed to remove.");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!assignment || assignment.type !== "general") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-slate-700">This assignment is not a General assignment. Student access is only for General assignments.</p>
        <Link href={`/global-assignments/${id}/view`} className="mt-4 text-teal-600 hover:underline">
          Back to assignment
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BackLink href={`/global-assignments/${id}/view`}>Back to assignment</BackLink>
          <span className="text-slate-400">|</span>
          <Link href={`/global-assignments/${id}/moderators`} className={NAV_LINK_CLASS}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Moderators
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Student access</h1>
          <p className="mt-1 text-sm text-slate-600">{assignment.title}</p>
          <p className="mt-2 text-sm text-slate-500">
            Only students listed here can see and submit this assignment. Add by FUNT ID or bulk (one per line or comma-separated).
          </p>
        </div>

        <div className="p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={accessFuntId}
                onChange={(e) => setAccessFuntId(e.target.value)}
                placeholder="Student FUNT ID"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addAccess}
                disabled={accessLoading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <div>
              <textarea
                value={accessBulkText}
                onChange={(e) => setAccessBulkText(e.target.value)}
                placeholder="Bulk: one FUNT ID per line or comma-separated"
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={bulkAddAccess}
                disabled={accessLoading}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Add bulk
              </button>
            </div>
            <ul className="space-y-2">
              {allowedStudents.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-slate-700">{s.funtId || s.id}</span>
                  <span className="text-slate-600">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAccess(s.id)}
                    className="text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
