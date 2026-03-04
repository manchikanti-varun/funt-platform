"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface BatchAttendance {
  batchId: string;
  batchName?: string;
  batchCode?: string;
  totalSessions: number;
  presentCount: number;
  percentage: number;
  attendedDates: string[];
}

interface GeneralEvent {
  id: string;
  eventDate: string;
  title?: string;
}

export default function AttendancePage() {
  const [byBatch, setByBatch] = useState<BatchAttendance[]>([]);
  const [events, setEvents] = useState<GeneralEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<BatchAttendance[]>("/api/attendance/me").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<GeneralEvent[]>("/api/general-attendance/me").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
    ])
      .then(([batchData, eventData]) => {
        setByBatch(batchData);
        setEvents(eventData);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalSessionsAttended = byBatch.reduce((s, b) => s + b.presentCount, 0);
  const totalSessions = byBatch.reduce((s, b) => s + b.totalSessions, 0);
  const overallPercentage = totalSessions > 0 ? Math.round((totalSessionsAttended / totalSessions) * 100) : 0;

  const formatDate = (iso: string) => {
    const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatEventDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
        <p className="text-sm text-slate-500">Loading attendance…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <header className="shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attendance</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Attendance</h1>
        <p className="mt-2 text-sm text-slate-600">
          Session attendance by batch (with percentage) and events you attended.
        </p>
      </header>

      {/* Session Attendance */}
      <section className="shrink-0 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-600">Session Attendance</h2>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/20 ring-1 ring-slate-100 overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 to-white px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-stretch gap-4 sm:gap-6">
              <div className="rounded-xl bg-white border border-slate-100 px-4 py-3 shadow-sm min-w-[120px]">
                <p className="text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{totalSessionsAttended}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Sessions Attended</p>
              </div>
              <div className="rounded-xl bg-teal-50 border border-teal-100 px-4 py-3 shadow-sm min-w-[100px]">
                <p className="text-2xl font-bold tabular-nums text-teal-700 sm:text-3xl">{overallPercentage}%</p>
                <p className="mt-1 text-xs font-medium text-teal-600">Attendance</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-100 px-4 py-3 shadow-sm min-w-[100px]">
                <p className="text-2xl font-bold tabular-nums text-slate-700 sm:text-3xl">{totalSessions}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Total Sessions</p>
              </div>
            </div>
            {totalSessions > 0 && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, overallPercentage)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="p-5 sm:p-6">
            {byBatch.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">No Session Attendance Yet</p>
                <p className="mt-1 text-sm text-slate-500">Your session attendance will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {byBatch.map((b) => (
                  <li key={b.batchId} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Batch</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                          {b.batchName || b.batchCode || b.batchId}
                        </p>
                        {(b.batchCode || (!b.batchName && b.batchId)) && (
                          <p className="mt-0.5 font-mono text-[11px] text-slate-500 break-all">
                            {(b.batchCode && b.batchName) ? b.batchCode : (!b.batchName ? b.batchId : null)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 ml-auto">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                            b.percentage >= 75 ? "bg-emerald-100 text-emerald-800" : b.percentage >= 50 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {b.percentage}%
                        </span>
                        <span className="text-sm text-slate-600">
                          {b.presentCount} / {b.totalSessions}
                        </span>
                      </div>
                    </div>
                    {totalSessions > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, b.percentage)}%`,
                              backgroundColor: b.percentage >= 75 ? "#10b981" : b.percentage >= 50 ? "#f59e0b" : "#94a3b8",
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {(b.attendedDates?.length ?? 0) > 0 && (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dates Attended</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(b.attendedDates ?? []).map((d) => (
                            <span
                              key={d}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                              {formatDate(d)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Events Attended */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600">Events Attended</h2>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/20 ring-1 ring-slate-100 overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-slate-800">Events You Attended</p>
            <p className="mt-0.5 text-xs text-slate-500">Bootcamps, workshops, and one-off events (no percentage).</p>
          </div>
          <div>
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center border-t border-slate-100 py-12 text-center px-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">No Events Yet</p>
                <p className="mt-1 text-sm text-slate-500">Events you attend will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:px-6"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{ev.title || "Event"}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{formatEventDate(ev.eventDate)}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                      Attended
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
