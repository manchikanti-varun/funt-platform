"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";
import { AccessToggleIconButton, DeleteIconButton } from "@/components/ui/actionIconButtons";

interface BatchStudent {
  enrollmentId: string;
  studentId: string;
  username: string;
  name: string;
  enrolledAt: string;
  accessBlocked?: boolean;
  courseAccessBlocked?: Record<string, boolean>;
}

interface BatchCourseSnapshot {
  courseId?: string;
  title?: string;
}

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function BatchStudentAccessPage() {
  const params = useParams();
  const id = params.id as string;
  const [batchName, setBatchName] = useState("");
  const [courseSnapshots, setCourseSnapshots] = useState<BatchCourseSnapshot[]>([]);
  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [username, setUsername] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<{ name: string; courseSnapshots?: BatchCourseSnapshot[]; courseSnapshot?: BatchCourseSnapshot }>(`/api/batches/${id}`),
      api<BatchStudent[]>(`/api/batches/${id}/students`),
    ]).then(([batchRes, studentsRes]) => {
      if (batchRes.success && batchRes.data) {
        setBatchName(batchRes.data.name);
        const snaps =
          Array.isArray(batchRes.data.courseSnapshots) && batchRes.data.courseSnapshots.length > 0
            ? batchRes.data.courseSnapshots
            : batchRes.data.courseSnapshot
              ? [batchRes.data.courseSnapshot]
              : [];
        setCourseSnapshots(snaps);
      }
      if (studentsRes.success && Array.isArray(studentsRes.data)) setStudents(studentsRes.data);
      setLoading(false);
    });
  }, [id]);

  async function addStudent() {
    if (!username.trim()) return;
    setActionLoading(true);
    setError("");
    const res = await api(`/api/batches/${id}/students`, {
      method: "POST",
      body: JSON.stringify({ username: username.trim() }),
    });
    setActionLoading(false);
    if (res.success) {
      setUsername("");
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

  async function setAccessBlocked(enrollmentId: string, blocked: boolean) {
    setActionLoading(true);
    setError("");
    const res = await api(`/api/admin/enrollments/${encodeURIComponent(enrollmentId)}/access`, {
      method: "PATCH",
      body: JSON.stringify({ blocked }),
    });
    setActionLoading(false);
    if (res.success) {
      setStudents((prev) =>
        prev.map((s) => (s.enrollmentId === enrollmentId ? { ...s, accessBlocked: blocked } : s))
      );
    } else setError(res.message ?? "Could not update access.");
  }

  async function setCourseAccessBlocked(enrollmentId: string, courseId: string, blocked: boolean) {
    if (!enrollmentId || !courseId) return;
    setActionLoading(true);
    setError("");
    const res = await api(`/api/admin/enrollments/${encodeURIComponent(enrollmentId)}/course-access`, {
      method: "PATCH",
      body: JSON.stringify({ courseId, blocked }),
    });
    setActionLoading(false);
    if (res.success) {
      setStudents((prev) =>
        prev.map((s) => {
          if (s.enrollmentId !== enrollmentId) return s;
          const next = { ...(s.courseAccessBlocked ?? {}) };
          if (blocked) next[courseId] = true;
          else delete next[courseId];
          return { ...s, courseAccessBlocked: next };
        })
      );
    } else setError(res.message ?? "Could not update course access.");
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Batch access</h1>
          <p className="mt-1 text-sm text-slate-600">{batchName}</p>
          <p className="mt-2 text-sm text-slate-500">Enrolled learners for this batch. Lock = pause LMS access for all courses in this batch; trash = remove enrollment.</p>
          <p className="mt-1 text-xs text-slate-500">You can optionally block specific courses in this batch snapshot per student.</p>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Student username"
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
              placeholder="Bulk: one username per line or comma-separated (or paste JSON array)"
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
                <li key={s.studentId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-slate-700">{s.username || s.studentId}</span>
                      <span className="min-w-0 truncate text-slate-600">{s.name}</span>
                    </div>
                    {courseSnapshots.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {courseSnapshots.map((c, idx) => {
                          const cId = String(c.courseId ?? "").trim();
                          if (!cId) return null;
                          const blockedByBatch = !!s.accessBlocked;
                          const blockedByCourse = !!s.courseAccessBlocked?.[cId];
                          const blocked = blockedByBatch || blockedByCourse;
                          return (
                            <button
                              key={`${s.studentId}-${cId}-${idx}`}
                              type="button"
                              disabled={actionLoading || !s.enrollmentId || blockedByBatch}
                              onClick={() => setCourseAccessBlocked(s.enrollmentId, cId, !blockedByCourse)}
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                                blocked
                                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                              title={
                                blockedByBatch
                                  ? "Batch access is locked. Unlock batch access first."
                                  : blockedByCourse
                                    ? "Course access blocked for this student."
                                    : "Course access allowed for this student."
                              }
                            >
                              {c.title ?? "Course"}: {blockedByBatch ? "Blocked (Batch locked)" : blockedByCourse ? "Blocked" : "Allowed"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-start">
                    <AccessToggleIconButton
                      accessBlocked={!!s.accessBlocked}
                      disabled={actionLoading || !s.enrollmentId}
                      onClick={() => setAccessBlocked(s.enrollmentId, !s.accessBlocked)}
                    />
                    <DeleteIconButton
                      disabled={actionLoading}
                      onClick={() => removeStudent(s.studentId)}
                      title="Remove from batch"
                      aria-label="Remove student from batch"
                    />
                  </div>
                </li>
              ))}
            </ul>
            {students.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No students added yet. Add by username or bulk above.</p>
            )}
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
