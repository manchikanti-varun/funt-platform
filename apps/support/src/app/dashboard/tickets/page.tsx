"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Search, Filter, X, Inbox, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, CheckCircle2,
} from "lucide-react";

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-800",
  URGENT: "bg-red-50 text-red-700",
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-indigo-50 text-indigo-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-cyan-50 text-cyan-700",
  WAITING_FOR_STUDENT: "bg-amber-50 text-amber-700",
  WAITING_FOR_SUPPORT: "bg-orange-50 text-orange-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
  ESCALATED: "bg-red-50 text-red-700",
};

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
  slaBreached?: boolean;
  createdAt: string;
}

interface ListResult {
  tickets: TicketRow[];
  total: number;
  page: number;
  limit: number;
}

export default function TicketsPage() {
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (search.trim()) params.set("search", search.trim());
    const r = await api<ListResult>(`/api/tickets?${params.toString()}`);
    if (r.success && r.data) setResult(r.data);
    setLoading(false);
  }, [page, statusFilter, priorityFilter, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = result ? Math.ceil(result.total / (result.limit || 20)) : 1;
  const hasFilters = !!(search || statusFilter || priorityFilter);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Support Tickets</h1>
            <p className="text-xs text-slate-500">View and respond to all student tickets.</p>
          </div>
          {result && (
            <span className="text-xs text-slate-400">{result.total} ticket{result.total !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search ticket # or subject..."
              className="h-8 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-300 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 focus:border-indigo-300 focus:outline-none"
          >
            <option value="">All Statuses</option>
            {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_STUDENT","WAITING_FOR_SUPPORT","RESOLVED","CLOSED","ESCALATED"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 focus:border-indigo-300 focus:outline-none"
          >
            <option value="">All Priorities</option>
            {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setStatusFilter(""); setPriorityFilter(""); setPage(1); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="spinner" /></div>
        ) : !result?.tickets.length ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Inbox className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">{hasFilters ? "No tickets match filters" : "No tickets yet"}</p>
            <p className="mt-1 text-xs text-slate-400">{hasFilters ? "Try adjusting your filters." : "Tickets assigned to you will appear here."}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {result.tickets.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/tickets/${t.id}`}
                className={`flex items-center gap-4 px-5 py-4 transition hover:bg-indigo-50/40 ${t.slaBreached ? "bg-red-50/30" : ""}`}
              >
                {/* Priority dot */}
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  t.priority === "URGENT" ? "bg-red-500" : t.priority === "HIGH" ? "bg-amber-500" : t.priority === "MEDIUM" ? "bg-blue-500" : "bg-slate-400"
                }`} />

                {/* Main info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold text-slate-400">{t.ticketNumber}</span>
                    {t.slaBreached && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{t.subject}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{t.createdByName}</span>
                    <span>·</span>
                    <span>{t.category.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{timeAgo(t.createdAt)}</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500"}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE[t.priority] ?? "bg-slate-100 text-slate-600"}`}>
                    {t.priority}
                  </span>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3">
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary !p-1.5 text-xs disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary !p-1.5 text-xs disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
