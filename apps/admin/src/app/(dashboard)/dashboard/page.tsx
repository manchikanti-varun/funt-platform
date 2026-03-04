"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLE } from "@funt-platform/constants";
import { api } from "@/lib/api";
import { getToken } from "@/lib/api";
import { parseJwtPayload } from "@/lib/auth";

interface Stats {
  courses: number;
  batches: number;
  globalModules: number;
  globalAssignments: number;
}

interface BatchSummary {
  id: string;
  name: string;
  startDate?: string;
  status?: string;
}

const STAT_STYLES = [
  { border: "border-l-teal-500", bg: "bg-teal-50", text: "text-teal-700", label: "text-teal-600" },
  { border: "border-l-slate-500", bg: "bg-slate-50", text: "text-slate-700", label: "text-slate-600" },
  { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-700", label: "text-amber-600" },
  { border: "border-l-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "text-emerald-600" },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_LINKS = [
  { href: "/global-modules", label: "Modules", icon: "book" },
  { href: "/global-assignments", label: "Assignments", icon: "document" },
  { href: "/courses", label: "Courses", icon: "academic" },
  { href: "/batches", label: "Batches", icon: "users" },
  { href: "/attendance", label: "Attendance", icon: "calendar" },
  { href: "/admin-management", label: "Admins", icon: "userGroup" },
];

function QuickLinkIcon({ icon }: { icon: string }) {
  const cls = "h-6 w-6 shrink-0 text-slate-500";
  switch (icon) {
    case "book":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "document":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "academic":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case "search":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4v4m-9 4h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "userGroup":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    courses: 0,
    batches: 0,
    globalModules: 0,
    globalAssignments: 0,
  });
  const [recentBatches, setRecentBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string[]>([]);

  useEffect(() => {
    const token = getToken();
    const payload = token ? parseJwtPayload(token) : null;
    if (payload) setRole(payload.roles ?? []);

    const isAdminOrSuper = payload?.roles?.includes(ROLE.ADMIN) || payload?.roles?.includes(ROLE.SUPER_ADMIN);

    Promise.all([
      api<unknown[]>("/api/courses").then((r) => (Array.isArray(r.data) ? r.data : [])),
      api<BatchSummary[]>("/api/batches").then((r) => (Array.isArray(r.data) ? r.data : [])),
      isAdminOrSuper ? api<unknown[]>("/api/global-modules").then((r) => (Array.isArray(r.data) ? r.data : [])) : Promise.resolve([]),
      isAdminOrSuper ? api<unknown[]>("/api/global-assignments").then((r) => (Array.isArray(r.data) ? r.data : [])) : Promise.resolve([]),
    ])
      .then(([courses, batches, modules, assignments]) => {
        setStats({
          courses: Array.isArray(courses) ? courses.length : 0,
          batches: Array.isArray(batches) ? batches.length : 0,
          globalModules: Array.isArray(modules) ? modules.length : 0,
          globalAssignments: Array.isArray(assignments) ? assignments.length : 0,
        });
        const batchList = Array.isArray(batches) ? batches : [];
        const sorted = [...batchList].sort((a, b) => {
          const da = (a.startDate ?? "").toString();
          const db = (b.startDate ?? "").toString();
          return db.localeCompare(da);
        });
        setRecentBatches(sorted.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isSuperAdmin = role.includes(ROLE.SUPER_ADMIN);
  const isAdmin = role.includes(ROLE.ADMIN) || isSuperAdmin;
  const isTrainer = role.includes(ROLE.TRAINER);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
          <p className="text-sm text-slate-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const statCards = (isAdmin || isSuperAdmin)
    ? [
        { title: "Courses", value: stats.courses, style: STAT_STYLES[0] },
        { title: "Batches", value: stats.batches, style: STAT_STYLES[1] },
        { title: "Global Modules", value: stats.globalModules, style: STAT_STYLES[2] },
        { title: "Global Assignments", value: stats.globalAssignments, style: STAT_STYLES[3] },
      ]
    : isTrainer
      ? [
          { title: "Batches", value: stats.batches, style: STAT_STYLES[1] },
        ]
      : [];

  const showQuickLinks = isAdmin || isSuperAdmin;
  const linksToShow = showQuickLinks ? QUICK_LINKS : QUICK_LINKS.filter((l) => l.href === "/batches" || l.href === "/attendance");

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-teal-50/60 via-white to-slate-50/40 p-6 shadow-lg shadow-slate-300/10 ring-1 ring-slate-100/80">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">{getGreeting()}</h1>
        <p className="mt-1 text-sm text-slate-600">Overview and shortcuts below.</p>
      </header>

      {statCards.length > 0 && (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((c) => (
            <div
              key={c.title}
              className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/25 hover:ring-slate-200/80 border-l-4 ${c.style.border} ${c.style.bg}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wider ${c.style.label}`}>{c.title}</p>
              <p className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${c.style.text}`}>{c.value}</p>
            </div>
          ))}
        </section>
      )}

      {showQuickLinks && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/60">
          <h2 className="mb-5 text-lg font-semibold text-slate-800">Shortcuts</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {linksToShow.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3.5 text-left ring-1 ring-slate-100/80 transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/70 hover:shadow-lg hover:shadow-teal-900/5 hover:ring-teal-100"
              >
                <QuickLinkIcon icon={link.icon} />
                <span className="text-sm font-medium text-slate-700">{link.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentBatches.length > 0 && (isAdmin || isSuperAdmin || isTrainer) && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/60">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent Batches</h2>
            <Link href="/batches" className="text-sm font-medium text-teal-600 transition hover:text-teal-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {recentBatches.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/batches/${b.id}/view`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3.5 text-sm ring-1 ring-slate-100/60 transition duration-200 hover:border-teal-100 hover:bg-teal-50/50 hover:ring-teal-100/80"
                >
                  <span className="font-medium text-slate-800">{b.name}</span>
                  <span className="text-xs text-slate-500">
                    {b.startDate ? (typeof b.startDate === "string" ? b.startDate.slice(0, 10) : "") : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isSuperAdmin && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/60">
          <h2 className="mb-1 text-lg font-semibold text-slate-800">Governance</h2>
          <p className="mb-5 text-sm text-slate-500">Audit &amp; controls</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/audit" className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-100/80 transition duration-200 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md">
              Audit
            </Link>
            <Link href="/admin-management" className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-100/80 transition duration-200 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md">
              Admins
            </Link>
            <Link href="/analytics" className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-100/80 transition duration-200 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md">
              Analytics
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
