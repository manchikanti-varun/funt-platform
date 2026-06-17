"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { BackLink } from "@/components/ui/BackLink";
import { ROLE } from "@funt-platform/constants";

const STATUS_DOT: Record<string, string> = {
  PENDING:   "bg-amber-400",
  APPROVED:  "bg-emerald-500",
  REJECTED:  "bg-red-400",
  CANCELLED: "bg-slate-300",
};

const ROLE_COLOR: Record<string, string> = {
  TRAINER:    "text-indigo-700",
  ADMIN:      "text-teal-700",
  SUPER_ADMIN: "text-violet-700",
};

interface CalendarLeave {
  id: string;
  requestedByName: string;
  requestedByRole: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  status: string;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function LeaveCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [leaves, setLeaves] = useState<CalendarLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<CalendarLeave[]>(`/api/leaves/calendar?year=${year}&month=${month}`);
    if (r.success && Array.isArray(r.data)) setLeaves(r.data);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { void load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  function getLeavesForDay(day: number): CalendarLeave[] {
    const d = new Date(year, month - 1, day);
    return leaves.filter((l) => {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      return d >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) &&
             d <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
    });
  }

  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <BackLink href="/leaves">Back to Leave Management</BackLink>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Leave Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">←</button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-slate-800">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">→</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(STATUS_DOT).map(([s, cls]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="spinner" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500">{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/40" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayLeaves = getLeavesForDay(day);
              const isToday = now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
              return (
                <div
                  key={day}
                  className={`min-h-[80px] border-b border-r border-slate-100 p-1.5 ${isToday ? "bg-teal-50" : ""}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-teal-600 text-white" : "text-slate-600"}`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayLeaves.slice(0, 3).map((l) => (
                      <Link
                        key={l.id}
                        href={`/leaves/${l.id}`}
                        className="flex items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-[10px] hover:bg-slate-100"
                        title={`${l.requestedByName} – ${l.status}`}
                      >
                        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[l.status] ?? "bg-slate-300"}`} />
                        <span className={`truncate font-medium ${ROLE_COLOR[l.requestedByRole] ?? "text-slate-700"}`}>
                          {l.requestedByName.split(" ")[0]}
                          {l.isHalfDay ? " ½" : ""}
                        </span>
                      </Link>
                    ))}
                    {dayLeaves.length > 3 && (
                      <p className="px-1 text-[10px] text-slate-400">+{dayLeaves.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
