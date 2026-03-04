"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";

interface BatchStudent {
  studentId: string;
  funtId: string;
  name: string;
  enrolledAt: string;
}

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function BatchStudentAccessPage() {
  const params = useParams();
  const id = params.id as string;
  const [batchName, setBatchName] = useState("");
  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [funtId, setFuntId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<{ name: string }>(`/api/batches/${id}`),
      api<BatchStudent[]>(`/api/batches/${id}/students`),
    ]).then(([batchRes, studentsRes]) => {
      if (batchRes.success && batchRes.data) setBatchName(batchRes.data.name);
      if (studentsRes.success && Array.isArray(studentsRes.data)) setStudents(studentsRes.data);
      setLoading(false);
    });
  }, [id]);

  async function addStudent() {
    if (!funtId.trim()) return;
    setActionLoading(true);
    setError("");
    const res = await api(`/api/batches/${id}/students`, {
      method: "POST",
      body: JSON.stringify({ funtId: funtId.trim() }),
    });
    setActionLoading(false);
    if (res.success) {
      setFuntId("");
      const r = await api<BatchStudent[]>(`/api/batches/${id}/students`);
      if (r.success && Array.isArray(r.data)) setStudents(r.data);
    } else setError(res.message ?? "Failed to add.");
  }

  async function bulkAdd() {
    const raw = bulkText.trim();
    if (!raw) return;
    const identifiers = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (identifiers.length === 0) return;
    setActionLoading(true);
    setError("");
    const res = await api<{ enrolled: number; skipped: number; notFound: string[] }>(`/api/batches/${id}/students/bulk`, {
      method: "POST",
      body: JSON.stringify({ identifiers }),
    });
    setActionLoading(false);
    if (res.success && res.data) {
      setBulkText("");
      if (res.data.notFound?.length) setError(`Added: ${res.data.enrolled}, not found: ${res.data.notFound.join(", ")}`);
      const r = await api<BatchStudent[]>(`/api/batches/${id}/students`);
      if (r.success && Array.isArray(r.data)) setStudents(r.data);
    } else setError(res.message ?? "Bulk add failed.");
  }

  async function removeStudent(studentId: string) {
    setActionLoading(true);
    setError("");
    const res = await api(`/api/batches/${id}/students/${studentId}`, { method: "DELETE" });
    setActionLoading(false);
    if (res.success) setStudents((prev) => prev.filter((s) => s.studentId !== studentId));
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BackLink href={`/batches/${id}/view`}>Back to batch</BackLink>
          <span className="text-slate-400">|</span>
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Student access</h1>
          <p className="mt-1 text-sm text-slate-600">{batchName}</p>
          <p className="mt-2 text-sm text-slate-500">
            Students listed here can access this batch’s courses. Add by FUNT ID or bulk (one per line / comma-separated).
          </p>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={funtId}
              onChange={(e) => setFuntId(e.target.value)}
              placeholder="Student FUNT ID"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={addStudent} disabled={actionLoading} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              Add
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Bulk: one FUNT ID per line or comma-separated (or paste JSON array)"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={bulkAdd} disabled={actionLoading} className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Add bulk
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
            <ul className="divide-y divide-slate-100">
              {students.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="font-mono text-slate-700">{s.funtId || s.studentId}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => removeStudent(s.studentId)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700"
                    title="Remove from batch"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            {students.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No students added yet. Add by FUNT ID or bulk above.</p>
            )}
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
