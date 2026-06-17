"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { PageHeader } from "@/components/ui/PageHeader";

// ─── Colour maps ──────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  LOW:    "bg-slate-400",
  MEDIUM: "bg-blue-500",
  HIGH:   "bg-amber-500",
  URGENT: "bg-red-500",
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW:    "bg-slate-100 text-slate-600 ring-slate-200",
  MEDIUM: "bg-blue-50 text-blue-700 ring-blue-200",
  HIGH:   "bg-amber-50 text-amber-800 ring-amber-200",
  URGENT: "bg-red-50 text-red-700 ring-red-200",
};

const STATUS_BADGE: Record<string, string> = {
  OPEN:                 "bg-indigo-50 text-indigo-700 ring-indigo-200",
  ASSIGNED:             "bg-blue-50 text-blue-700 ring-blue-200",
  IN_PROGRESS:          "bg-cyan-50 text-cyan-700 ring-cyan-200",
  WAITING_FOR_STUDENT:  "bg-amber-50 text-amber-700 ring-amber-200",
  WAITING_FOR_SUPPORT:  "bg-orange-50 text-orange-700 ring-orange-200",
  RESOLVED:             "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CLOSED:               "bg-slate-100 text-slate-500 ring-slate-200",
  ESCALATED:            "bg-red-50 text-red-700 ring-red-200",
};

// Small SVG icon per status
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "OPEN":
      return (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "ASSIGNED":
      return (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "IN_PROGRESS":
      return (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "RESOLVED":
      return (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case "CLOSED":
      return (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case "ESCALATED":
      return (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      );
    default:
      return (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" />
        </svg>
      );
  }
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TicketRow {
  id: string;
  ticketNumber: string;
  createdByName: string;
  createdByUsername: string;
  createdByRole: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  assignedToName?: string;
  slaDueAt?: string;
  slaBreached?: boolean;
  createdAt: string;
}

interface ListResult {
  tickets: TicketRow[];
  total: number;
  page: number;
  limit: number;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  accentClass: string; // border-l-* colour
  textClass: string;
  icon: React.ReactNode;
  loading?: boolean;
}

function StatCard({ label, value, accentClass, textClass, icon, loading }: StatCardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${accentClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-12 animate-pulse rounded-md bg-slate-100" />
          ) : (
            <p className={`mt-1 text-2xl font-bold tabular-nums ${textClass}`}>{value}</p>
          )}
        </div>
        <div className={`rounded-xl p-2 ${accentClass.replace("border-l-", "bg-").replace("-500", "-50").replace("-400", "-50")}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-5">
        <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-slate-700">No tickets found</p>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters
          ? "Try adjusting your filters or clearing the search."
          : "When students submit support tickets, they will appear here."}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupportDeskPage() {
  const router = useRouter();

  // ── List state ──────────────────────────────────────────────────────────────
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ── Stat cards state ─────────────────────────────────────────────────────────
  const [statsLoading, setStatsLoading] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const [resolvedToday, setResolvedToday] = useState(0);

  // ── TKT lookup ───────────────────────────────────────────────────────────────
  const [tktInput, setTktInput] = useState("");
  const [tktLookupLoading, setTktLookupLoading] = useState(false);
  const [tktError, setTktError] = useState("");
  const tktRef = useRef<HTMLInputElement>(null);

  // ── Load stat cards ──────────────────────────────────────────────────────────
  useEffect(() => {
    setStatsLoading(true);
    Promise.allSettled([
      api<{ openTotal: number; openToday: number; slaBreachCount: number; dueSoonCount: number }>("/api/tickets/sla"),
      api<{ summary: { open: number; openToday: number; slaBreaches: number }; byStatus: { status: string; count: number }[] }>("/api/tickets/analytics"),
    ]).then(([slaRes, analyticsRes]) => {
      const sla = slaRes.status === "fulfilled" && slaRes.value.success ? slaRes.value.data : null;
      const analytics = analyticsRes.status === "fulfilled" && analyticsRes.value.success ? analyticsRes.value.data : null;

      // Open: prefer SLA endpoint's openTotal, fallback to analytics summary.open
      setOpenCount(sla?.openTotal ?? analytics?.summary?.open ?? 0);

      // Pending: sum of WAITING_FOR_STUDENT + WAITING_FOR_SUPPORT from byStatus
      const byStatus = analytics?.byStatus ?? [];
      const pending = byStatus
        .filter((s) => s.status === "WAITING_FOR_STUDENT" || s.status === "WAITING_FOR_SUPPORT")
        .reduce((acc, s) => acc + s.count, 0);
      setPendingCount(pending);

      // Escalated: from byStatus
      const escalated = byStatus.find((s) => s.status === "ESCALATED")?.count ?? 0;
      setEscalatedCount(escalated);

      // Resolved Today: SLA openToday is actually "opened today" — use analytics summary.openToday as a proxy
      // resolvedToday is not directly returned; use SLA dueSoonCount as a useful metric instead
      setResolvedToday(analytics?.summary?.openToday ?? sla?.openToday ?? 0);
    }).finally(() => setStatsLoading(false));
  }, []);

  // ── Load ticket list ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (search) params.set("search", search);
    const r = await api<ListResult>(`/api/tickets?${params.toString()}`);
    if (r.success && r.data) setResult(r.data);
    setLoading(false);
  }, [page, statusFilter, priorityFilter, categoryFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = result ? Math.ceil(result.total / (result.limit || 20)) : 1;
  const hasFilters = !!(search || statusFilter || priorityFilter || categoryFilter);

  // ── TKT lookup ───────────────────────────────────────────────────────────────
  async function findByTicketNumber(e: React.FormEvent) {
    e.preventDefault();
    const raw = tktInput.trim().toUpperCase();
    if (!raw) return;
    setTktError("");
    setTktLookupLoading(true);
    const r = await api<ListResult>(`/api/tickets?search=${encodeURIComponent(raw)}&limit=5`);
    setTktLookupLoading(false);
    if (r.success && r.data && r.data.tickets.length > 0) {
      const exact = r.data.tickets.find((t) => t.ticketNumber.toUpperCase() === raw);
      const match = exact ?? r.data.tickets[0];
      router.push(`/support/${match.id}`);
    } else {
      setTktError(`No ticket found matching "${raw}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.TRAINER]} fallbackHref="/dashboard" />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Support Desk"
          subtitle="Manage all student and parent support tickets."
        />
        <div className="flex flex-wrap items-center gap-2">
          {/* Inline TKT lookup bar */}
          <form
            onSubmit={(e) => void findByTicketNumber(e)}
            className="flex items-center gap-1.5"
          >
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
              </svg>
              <input
                ref={tktRef}
                value={tktInput}
                onChange={(e) => {
                  setTktInput(e.target.value);
                  setTktError("");
                }}
                placeholder="TKT-2026-000042"
                className="h-9 w-44 rounded-xl border border-slate-300 bg-white pl-9 pr-3 font-mono text-xs text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={!tktInput.trim() || tktLookupLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {tktLookupLoading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "Jump"
              )}
            </button>
            {tktError && (
              <span className="max-w-[180px] text-xs font-medium text-red-600">{tktError}</span>
            )}
          </form>

          <div className="h-6 w-px bg-slate-200" />

          <Link
            href="/support/analytics"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </Link>
          <Link
            href="/support/sla"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            SLA Dashboard
          </Link>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open Tickets"
          value={openCount}
          accentClass="border-l-indigo-500"
          textClass="text-indigo-700"
          loading={statsLoading}
          icon={
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          }
        />
        <StatCard
          label="Awaiting Response"
          value={pendingCount}
          accentClass="border-l-amber-500"
          textClass="text-amber-700"
          loading={statsLoading}
          icon={
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Escalated"
          value={escalatedCount}
          accentClass="border-l-red-500"
          textClass="text-red-700"
          loading={statsLoading}
          icon={
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          }
        />
        <StatCard
          label="Opened Today"
          value={resolvedToday}
          accentClass="border-l-emerald-500"
          textClass="text-emerald-700"
          loading={statsLoading}
          icon={
            <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Filters row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
          </svg>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search subject or ticket #…"
            className="h-9 w-60 rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 placeholder:text-slate-400"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
          </svg>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-7 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All Statuses</option>
            {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_STUDENT","WAITING_FOR_SUPPORT","RESOLVED","CLOSED","ESCALATED"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-7 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All Priorities</option>
            {["LOW","MEDIUM","HIGH","URGENT"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-7 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All Categories</option>
            {["COURSE_ACCESS","ASSIGNMENT","ATTENDANCE","CERTIFICATE","PAYMENT","ENROLLMENT","SHOP_ORDER","TECHNICAL_ISSUE","BUG_REPORT","FEATURE_REQUEST","GENERAL_QUERY"].map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setPriorityFilter("");
              setCategoryFilter("");
              setPage(1);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}

        {result && (
          <span className="ml-auto text-sm text-slate-500">
            {result.total.toLocaleString()} ticket{result.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <div className="spinner" />
          </div>
        ) : !result?.tickets.length ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr>
                  {[
                    "Ticket #",
                    "Subject",
                    "From",
                    "Category",
                    "Priority",
                    "Status",
                    "Assigned To",
                    "SLA Due",
                    "Created",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.tickets.map((t) => (
                  <tr
                    key={t.id}
                    className={`group transition-colors hover:bg-teal-50/40 ${
                      t.slaBreached ? "bg-red-50/40 hover:bg-red-50/60" : ""
                    }`}
                  >
                    {/* Ticket number */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {t.ticketNumber}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="truncate font-medium text-slate-800 leading-snug">{t.subject}</p>
                    </td>

                    {/* From */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-slate-800">{t.createdByName}</p>
                      <p className="text-xs text-slate-400">{t.createdByRole.replace(/_/g, " ")}</p>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">{t.category.replace(/_/g, " ")}</span>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          PRIORITY_BADGE[t.priority] ?? "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            PRIORITY_DOT[t.priority] ?? "bg-slate-400"
                          }`}
                        />
                        {t.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500 ring-slate-200"
                        }`}
                      >
                        <StatusIcon status={t.status} />
                        {t.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Assigned to */}
                    <td className="px-4 py-3">
                      {t.assignedToName ? (
                        <span className="text-xs font-medium text-slate-700">{t.assignedToName}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* SLA */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.slaDueAt ? (
                        t.slaBreached ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                            </svg>
                            Breached
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {new Date(t.slaDueAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    {/* Quick actions */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/support/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 group-hover:shadow-md"
                      >
                        View
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages} &mdash; {result?.total.toLocaleString() ?? 0} total
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            {/* Page number pills */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const half = 2;
                let start = Math.max(1, page - half);
                const end = Math.min(totalPages, start + 4);
                start = Math.max(1, end - 4);
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-9 min-w-[36px] rounded-xl border px-3 text-sm font-medium transition ${
                      p === page
                        ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              Next
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
