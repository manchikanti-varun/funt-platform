"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";

interface StudentAttendanceRow {
  studentId: string;
  funtId: string;
  name: string;
  sessions: Array<{ date: string; status: string }>;
  presentCount: number;
  totalSessions: number;
  percentage: number;
}

interface BatchSession {
  id: string;
  sessionDate: string;
  markedBy: string;
  attendanceRecords: Array<{ studentId: string; status: string }>;
  createdAt: string;
}

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50";

export default function BatchAttendancePage() {
  const params = useParams();
  const id = params.id as string;
  const [batchName, setBatchName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [funtIdsPaste, setFuntIdsPaste] = useState("");
  const [markLoading, setMarkLoading] = useState(false);
  const [markMessage, setMarkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [byStudent, setByStudent] = useState<StudentAttendanceRow[]>([]);
  const [byStudentLoading, setByStudentLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [sessions, setSessions] = useState<BatchSession[]>([]);
  const [editSessionDate, setEditSessionDate] = useState<string | null>(null);
  const [editPaste, setEditPaste] = useState("");
  const [addPresentLoading, setAddPresentLoading] = useState(false);
  const [addPresentMessage, setAddPresentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function loadSessions() {
    if (!id) return;
    api<Array<{ id: string; sessionDate: string; markedBy: string; attendanceRecords: Array<{ studentId: string; status: string }>; createdAt: string }>>(`/api/attendance/batch/${id}`).then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setSessions(r.data.map((s) => ({
          ...s,
          sessionDate: new Date(s.sessionDate).toISOString().slice(0, 10),
        })));
      }
    });
  }

  function loadByStudent() {
    if (!id) return;
    api<StudentAttendanceRow[]>(`/api/attendance/batch/${id}/students`).then((r) => {
      if (r.success && Array.isArray(r.data)) setByStudent(r.data);
    });
  }

  useEffect(() => {
    if (!id) return;
    api<{ name: string }>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) setBatchName(r.data.name);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setByStudentLoading(true);
    api<StudentAttendanceRow[]>(`/api/attendance/batch/${id}/students`).then((r) => {
      if (r.success && Array.isArray(r.data)) setByStudent(r.data);
      setByStudentLoading(false);
    });
    loadSessions();
  }, [id]);

  async function markAttendance(e: React.FormEvent) {
    e.preventDefault();
    const raw = funtIdsPaste.trim();
    if (!raw) {
      setMarkMessage({ type: "error", text: "Paste at least one FUNT ID." });
      return;
    }
    const funtIds = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (funtIds.length === 0) {
      setMarkMessage({ type: "error", text: "Paste at least one FUNT ID." });
      return;
    }
    const date = sessionDate || new Date().toISOString().slice(0, 10);
    setMarkLoading(true);
    setMarkMessage(null);
    const res = await api<{ notFound?: string[] }>(`/api/attendance/batch/${id}/mark-by-ids`, {
      method: "POST",
      body: JSON.stringify({ sessionDate: date, funtIds }),
    });
    setMarkLoading(false);
    if (res.success) {
      setMarkMessage({
        type: "success",
        text: res.data?.notFound?.length
          ? `Marked present for ${date}. Not found: ${res.data.notFound.join(", ")}`
          : `Attendance marked for ${date}.`,
      });
      setFuntIdsPaste("");
      loadSessions();
      loadByStudent();
    } else {
      setMarkMessage({ type: "error", text: res.message ?? "Failed to mark attendance." });
    }
  }

  async function addRemainingPresent(sessionDateStr: string, e: React.FormEvent) {
    e.preventDefault();
    const raw = editPaste.trim();
    if (!raw) {
      setAddPresentMessage({ type: "error", text: "Paste at least one FUNT ID." });
      return;
    }
    const funtIds = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (funtIds.length === 0) {
      setAddPresentMessage({ type: "error", text: "Paste at least one FUNT ID." });
      return;
    }
    setAddPresentLoading(true);
    setAddPresentMessage(null);
    const res = await api<{ addedCount?: number; alreadyMarkedCount?: number; notFound?: string[] }>(`/api/attendance/batch/${id}/add-present`, {
      method: "POST",
      body: JSON.stringify({ sessionDate: sessionDateStr, funtIds }),
    });
    setAddPresentLoading(false);
    if (res.success && res.data) {
      const added = res.data.addedCount ?? 0;
      const already = res.data.alreadyMarkedCount ?? 0;
      const nf = res.data.notFound?.length ? ` Not found: ${res.data.notFound.join(", ")}` : "";
      setAddPresentMessage({
        type: "success",
        text: `Added ${added} present. Already marked: ${already}.${nf}`,
      });
      setEditPaste("");
      setEditSessionDate(null);
      loadSessions();
      loadByStudent();
    } else {
      setAddPresentMessage({ type: "error", text: res.message ?? "Failed to add." });
    }
  }

  if (!id) return null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BackLink href={`/batches/${id}/view`}>Back to batch</BackLink>
          <span className="text-slate-400">|</span>
          <Link href={`/batches/${id}/student-access`} className={NAV_LINK_CLASS}>Student access</Link>
          <Link href={`/batches/${id}/moderators`} className={NAV_LINK_CLASS}>Moderators</Link>
          <Link href={`/batches/${id}/submissions`} className={NAV_LINK_CLASS}>Submissions</Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto space-y-6">
        {/* Mark attendance: date + paste FUNT IDs */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
          <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white px-6 py-6">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Mark attendance</h1>
            <p className="mt-1 text-sm text-slate-600">{batchName}</p>
            <p className="mt-2 text-sm text-slate-500">
              Pick a session date and paste FUNT student IDs, one per line or comma-separated. Those listed will be marked present for this batch on that date.
            </p>
          </div>
          <form onSubmit={markAttendance} className="p-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Session date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">FUNT student IDs</label>
              <textarea
                value={funtIdsPaste}
                onChange={(e) => { setFuntIdsPaste(e.target.value); setMarkMessage(null); }}
                placeholder="FS-26-00001, FS-26-00002&#10;or one per line"
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono placeholder:text-slate-400"
              />
            </div>
            {markMessage && (
              <p className={markMessage.type === "success" ? "text-sm font-medium text-emerald-600" : "text-sm font-medium text-red-600"}>
                {markMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={markLoading || !funtIdsPaste.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {markLoading ? "Marking…" : "Mark present"}
            </button>
          </form>
        </div>

        {/* Existing sessions – Edit / Add remaining */}
        {sessions.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
            <div className="border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white px-6 py-6">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Existing sessions</h2>
              <p className="mt-1 text-sm text-slate-600">Missed someone? Click Edit, paste the remaining FUNT IDs, and add. Already-marked students are not duplicated.</p>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {sessions.map((s) => {
                  const presentCount = s.attendanceRecords.filter((r) => r.status === "PRESENT").length;
                  const isEditing = editSessionDate === s.sessionDate;
                  return (
                    <li key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div>
                          <span className="font-medium text-slate-800">{s.sessionDate}</span>
                          <span className="ml-2 text-sm text-slate-500">{presentCount} present</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditSessionDate(isEditing ? null : s.sessionDate);
                            setEditPaste("");
                            setAddPresentMessage(null);
                          }}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                        >
                          {isEditing ? "Cancel" : "Edit (add remaining)"}
                        </button>
                      </div>
                      {isEditing && (
                        <form onSubmit={(e) => addRemainingPresent(s.sessionDate, e)} className="border-t border-slate-200 bg-white p-4 space-y-3">
                          <label className="block text-sm font-semibold text-slate-700">Paste FUNT IDs to add (no duplicates for already marked)</label>
                          <textarea
                            value={editPaste}
                            onChange={(e) => { setEditPaste(e.target.value); setAddPresentMessage(null); }}
                            placeholder="FS-26-00003, FS-26-00004"
                            rows={3}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                          />
                          {addPresentMessage && (
                            <p className={addPresentMessage.type === "success" ? "text-sm font-medium text-emerald-600" : "text-sm font-medium text-red-600"}>
                              {addPresentMessage.text}
                            </p>
                          )}
                          <button
                            type="submit"
                            disabled={addPresentLoading || !editPaste.trim()}
                            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {addPresentLoading ? "Adding…" : "Add remaining"}
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Attendance by student */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Attendance by student</h2>
            <p className="mt-1 text-sm text-slate-600">Per-student view with present/absent dates and percentage. Expand a row to see session-by-session.</p>
            {!byStudentLoading && byStudent.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4 rounded-xl bg-white/80 border border-slate-100 px-4 py-3 shadow-sm">
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-500">Students</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-800">{byStudent.length}</span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-500">Sessions</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-800">{byStudent[0]?.totalSessions ?? 0}</span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-500">Avg attendance</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                    {byStudent.length
                      ? Math.round(byStudent.reduce((a, r) => a + r.percentage, 0) / byStudent.length)
                      : 0}%
                  </span>
                </span>
              </div>
            )}
          </div>
          <div className="p-6">
            {byStudentLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
                <p className="mt-4 text-sm text-slate-500">Loading attendance…</p>
              </div>
            ) : byStudent.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">No students or sessions yet</p>
                <p className="mt-1 text-sm text-slate-500">Add students in Student access and mark attendance above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-inner">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                      <th className="px-4 py-3.5 font-semibold text-slate-600">Student</th>
                      <th className="px-4 py-3.5 font-semibold text-slate-600">FUNT ID</th>
                      <th className="px-4 py-3.5 font-semibold text-slate-600 text-center w-24">Present</th>
                      <th className="px-4 py-3.5 font-semibold text-slate-600 text-center w-24">Sessions</th>
                      <th className="px-4 py-3.5 font-semibold text-slate-600 text-center w-32">Attendance</th>
                      <th className="px-4 py-3.5 font-semibold text-slate-600 w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byStudent.map((row, idx) => (
                      <React.Fragment key={row.studentId}>
                        <tr className={`transition-colors hover:bg-slate-50/80 ${idx % 2 === 1 ? "bg-slate-50/30" : ""}`}>
                          <td className="px-4 py-3.5">
                            <span className="font-medium text-slate-900">{row.name || "—"}</span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-600 text-xs">{row.funtId}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              {row.presentCount}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-600">{row.totalSessions}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 min-w-[60px] max-w-[100px] overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${row.percentage}%`,
                                    backgroundColor:
                                      row.percentage >= 75 ? "#10b981" : row.percentage >= 50 ? "#f59e0b" : "#ef4444",
                                  }}
                                />
                              </div>
                              <span
                                className={`shrink-0 text-xs font-bold tabular-nums ${
                                  row.percentage >= 75 ? "text-emerald-700" : row.percentage >= 50 ? "text-amber-700" : "text-red-700"
                                }`}
                              >
                                {row.percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => setExpandedStudent(expandedStudent === row.studentId ? null : row.studentId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                            >
                              {expandedStudent === row.studentId ? (
                                <>
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                  </svg>
                                  Hide dates
                                </>
                              ) : (
                                <>
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                  Show dates
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                        {expandedStudent === row.studentId ? (
                          <tr className="bg-indigo-50/50">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Session-by-session</p>
                                {row.sessions.length === 0 ? (
                                  <p className="text-sm text-slate-500">No sessions recorded.</p>
                                ) : (
                                  <ul className="flex flex-wrap gap-2">
                                    {row.sessions.map((s) => (
                                      <li
                                        key={s.date}
                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                                          s.status === "PRESENT"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        {s.status === "PRESENT" ? (
                                          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        ) : (
                                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        )}
                                        {s.date}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
