"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLE } from "@funt-platform/constants";
import { api, apiUrl } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";

interface Stats {
  courses: number;
  batches: number;
  globalChapters: number;
  globalAssignments: number;
}

interface BatchSummary {
  id: string;
  name: string;
  startDate?: string;
  status?: string;
}
interface FinanceSummary {
  revenue: { verifiedRevenueRupees: number; verifiedCount: number };
  funnel: { totalAttempts: number; pendingCount: number; rejectedCount: number; verifiedCount: number; conversionRatePercent: number };
  failedReasons: Array<{ reason: string; count: number }>;
}

const STAT_STYLES = [
  { border: "border-l-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700", label: "text-indigo-600" },
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
  { href: "/global-modules", label: "Chapters", icon: "book" },
  { href: "/global-assignments", label: "Assignments", icon: "document" },
  { href: "/courses", label: "Courses", icon: "academic" },
  { href: "/batches", label: "Batches", icon: "users" },
  { href: "/attendance", label: "Attendance", icon: "calendar" },
  { href: "/team-management", label: "Team management", icon: "userGroup" },
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
  const { roles } = useAdminUser();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    courses: 0,
    batches: 0,
    globalChapters: 0,
    globalAssignments: 0,
  });
  const [recentBatches, setRecentBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);

  useEffect(() => {
    // Franchise admins get their own dashboard
    if (roles.includes(ROLE.FRANCHISE_ADMIN)) {
      router.replace("/franchise/dashboard");
      return;
    }
    setRole(roles);

    const isAdminOrSuper = roles.includes(ROLE.ADMIN) || roles.includes(ROLE.SUPER_ADMIN);

    Promise.all([
      api<unknown[]>("/api/courses").then((r) => (Array.isArray(r.data) ? r.data : [])),
      api<BatchSummary[]>("/api/batches").then((r) => (Array.isArray(r.data) ? r.data : [])),
      isAdminOrSuper ? api<unknown[]>("/api/global-chapters").then((r) => (Array.isArray(r.data) ? r.data : [])) : Promise.resolve([]),
      isAdminOrSuper ? api<unknown[]>("/api/global-assignments").then((r) => (Array.isArray(r.data) ? r.data : [])) : Promise.resolve([]),
      isAdminOrSuper ? api<FinanceSummary>("/api/admin/payments/finance").then((r) => (r.success && r.data ? r.data : null)) : Promise.resolve(null),
    ])
      .then(([courses, batches, chapters, assignments, financePayload]) => {
        setStats({
          courses: Array.isArray(courses) ? courses.length : 0,
          batches: Array.isArray(batches) ? batches.length : 0,
          globalChapters: Array.isArray(chapters) ? chapters.length : 0,
          globalAssignments: Array.isArray(assignments) ? assignments.length : 0,
        });
        const batchList = Array.isArray(batches) ? batches : [];
        const sorted = [...batchList].sort((a, b) => {
          const da = (a.startDate ?? "").toString();
          const db = (b.startDate ?? "").toString();
          return db.localeCompare(da);
        });
        setRecentBatches(sorted.slice(0, 5));
        setFinance(financePayload);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roles]);

  const isSuperAdmin = role.includes(ROLE.SUPER_ADMIN);
  const isAdmin = role.includes(ROLE.ADMIN) || isSuperAdmin;
  const isTrainer = role.includes(ROLE.TRAINER);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  const statCards = (isAdmin || isSuperAdmin)
    ? [
        { title: "Courses", value: stats.courses, style: STAT_STYLES[0] },
        { title: "Batches", value: stats.batches, style: STAT_STYLES[1] },
        { title: "Chapters", value: stats.globalChapters, style: STAT_STYLES[2] },
        { title: "Assignments", value: stats.globalAssignments, style: STAT_STYLES[3] },
      ]
    : isTrainer
      ? [
          { title: "Batches", value: stats.batches, style: STAT_STYLES[1] },
        ]
      : [];

  const showQuickLinks = isAdmin || isSuperAdmin;
  const linksToShow = showQuickLinks ? QUICK_LINKS : QUICK_LINKS.filter((l) => l.href === "/batches" || l.href === "/attendance");

  return (
    <div className="w-full space-y-8">
      <header className="admin-hero">
        <div className="relative">
          <p className="label-overline text-indigo-700/90">Overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{getGreeting()}</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600">Counts and shortcuts—jump to content or batches in one tap.</p>
        </div>
      </header>

      {statCards.length > 0 && (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((c) => (
            <div
              key={c.title}
              className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/25 hover:ring-slate-200/80 border-l-4 ${c.style.border} ${c.style.bg}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wider ${c.style.label}`}>{c.title}</p>
              <p className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${c.style.text}`}>{c.value}</p>
            </div>
          ))}
        </section>
      )}

      {showQuickLinks && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Shortcuts</h2>
          <p className="mb-5 text-xs text-slate-500">Frequent destinations</p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {linksToShow.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3.5 text-left ring-1 ring-slate-100/80 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/70 hover:shadow-lg hover:shadow-slate-300/25 hover:ring-indigo-100"
              >
                <QuickLinkIcon icon={link.icon} />
                <span className="text-sm font-medium text-slate-700">{link.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(isAdmin || isSuperAdmin) && finance ? (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Finance visibility (30 days)</h2>
              <p className="text-xs text-slate-500">Revenue, conversion funnel, and failed payment reasons.</p>
            </div>
            <a
              href={apiUrl("/api/admin/payments/finance?format=csv")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><span className="text-slate-500">Revenue</span><p className="text-lg font-bold text-slate-900">₹{finance.revenue.verifiedRevenueRupees.toFixed(2)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><span className="text-slate-500">Attempts</span><p className="text-lg font-bold text-slate-900">{finance.funnel.totalAttempts}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><span className="text-slate-500">Verified</span><p className="text-lg font-bold text-emerald-700">{finance.funnel.verifiedCount}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><span className="text-slate-500">Conversion</span><p className="text-lg font-bold text-indigo-700">{finance.funnel.conversionRatePercent}%</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top failed reasons</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {finance.failedReasons.length ? finance.failedReasons.slice(0, 5).map((r) => (
                <span key={r.reason} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">{r.reason} ({r.count})</span>
              )) : <span className="text-xs text-slate-500">No rejected reasons in this period.</span>}
            </div>
          </div>
        </section>
      ) : null}

      {recentBatches.length > 0 && (isAdmin || isSuperAdmin || isTrainer) && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent batches</h2>
            <Link href="/batches" className="text-sm font-medium text-indigo-600 transition hover:text-indigo-800 hover:underline">
              All batches
            </Link>
          </div>
          <ul className="space-y-2">
            {recentBatches.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/batches/${b.id}/view`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3.5 text-sm ring-1 ring-slate-100/80 transition duration-200 hover:border-indigo-100 hover:bg-indigo-50/50 hover:ring-indigo-100/80"
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
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">System</h2>
          <p className="mb-5 text-sm text-slate-500">Admin controls and grouped audit access</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/team-management" className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-100/80 transition duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md">
              Team management
            </Link>
            <Link href="/analytics" className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-100/80 transition duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md">
              Analytics
            </Link>
            <Link href="/audit-hub" className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-100/80 transition duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md">
              Audit hub
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
