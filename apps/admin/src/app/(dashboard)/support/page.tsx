"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { PageHeader } from "@/components/ui/PageHeader";

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH:   "bg-amber-100 text-amber-800",
  URGENT: "bg-red-100 text-red-800",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN:                  "bg-indigo-100 text-indigo-800",
  ASSIGNED:              "bg-blue-100 text-blue-700",
  IN_PROGRESS:           "bg-cyan-100 text-cyan-800",
  WAITING_FOR_STUDENT:   "bg-amber-100 text-amber-800",
  WAITING_FOR_SUPPORT:   "bg-orange-100 text-orange-800",
  RESOLVED:              "bg-emerald-100 text-emerald-800",
  CLOSED:                "bg-slate-100 text-slate-600",
  ESCALATED:             "bg-red-100 text-red-800",
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
  slaDueAt?: string;
  slaBreached?: boolean;
  createdAt: string;
}

interface ListResult { tickets: TicketRow[]; total: number; page: number; limit: number }

export default function SupportDeskPage() {
  const router = useRouter();
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Direct ticket lookup by TKT number
  const [tktInput, setTktInput] = useState("");
  const [tktLookupLoading, setTktLookupLoading] = useState(false);
  const [tktError, setTktError] = useState("");
  const tktRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { void load(); }, [load]);

  const totalPages = result ? Math.ceil(result.total / (result.limit || 20)) : 1;

  async function findByTicketNumber(e: React.FormEvent) {
    e.preventDefault();
    const raw = tktInput.trim().toUpperCase();
    if (!raw) return;
    setTktError("");
    setTktLookupLoading(true);
    // Search by ticket number using the existing search endpoint
    const r = await api<ListResult>(`/api/tickets?search=${encodeURIComponent(raw)}&limit=5`);
    setTktLookupLoading(false);
    if (r.success && r.data && r.data.tickets.length > 0) {
      // Find exact match first, then partial
      const exact = r.data.tickets.find((t) => t.ticketNumber.toUpperCase() === raw);
      const match = exact ?? r.data.tickets[0];
      router.push(`/support/${match.id}`);
    } else {
      setTktError(`No ticket found matching "${raw}"`);
    }
  }

  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.TRAINER]} fallbackHref="/dashboard" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Support Desk" subtitle="Manage all student and parent support tickets." />
        <div className="flex flex-wrap gap-2">
          <Link href="/support/analytics" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">Analytics</Link>
          <Link href="/support/sla" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">SLA Dashboard</Link>
        </div>
      </div>

      {/* ── Find ticket by ID ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 px-5 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-700">Find ticket by number</p>
        <form onSubmit={(e) => void findByTicketNumber(e)} className="flex flex-wrap items-center gap-2">
          <input
            ref={tktRef}
            value={tktInput}
            onChange={(e) => { setTktInput(e.target.value); setTktError(""); }}
            placeholder="e.g. TKT-2026-000042"
            className="w-64 rounded-xl border border-indigo-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!tktInput.trim() || tktLookupLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {tktLookupLoading ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Finding…</>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
                </svg>
                Find Ticket
              </>
            )}
          </button>
          {tktError && <p className="text-sm font-medium text-red-600">{tktError}</p>}
        </form>
        <p className="mt-2 text-xs text-indigo-600/70">Students can share their ticket number (e.g. TKT-2026-000042) and you can jump straight to it here.</p>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by subject or ticket #…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none w-64"
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none">
          <option value="">All Statuses</option>
          {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_STUDENT","WAITING_FOR_SUPPORT","RESOLVED","CLOSED","ESCALATED"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none">
          <option value="">All Priorities</option>
          {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none">
          <option value="">All Categories</option>
          {["COURSE_ACCESS","ASSIGNMENT","ATTENDANCE","CERTIFICATE","PAYMENT","ENROLLMENT","SHOP_ORDER","TECHNICAL_ISSUE","BUG_REPORT","FEATURE_REQUEST","GENERAL_QUERY"].map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </select>
        <button onClick={() => { setSearch(""); setStatusFilter(""); setPriorityFilter(""); setCategoryFilter(""); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
          </div>
        ) : !result?.tickets.length ? (
          <div className="flex min-h-[160px] items-center justify-center text-sm text-slate-500">No tickets found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Ticket #","Subject","From","Category","Priority","Status","Assigned To","SLA","Created"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.tickets.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-50/50 ${t.slaBreached ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{t.ticketNumber}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="truncate font-medium text-slate-800">{t.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{t.createdByName}</p>
                      <p className="text-xs text-slate-500">{t.createdByRole.replace("_", " ")}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{t.category.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[t.priority] ?? "bg-slate-100 text-slate-600"}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[t.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {t.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{t.assignedToName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {t.slaDueAt ? (
                        <span className={t.slaBreached ? "font-semibold text-red-600" : "text-slate-500"}>
                          {t.slaBreached ? "⚠ Breached" : new Date(t.slaDueAt).toLocaleDateString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/support/${t.id}`} className="text-sm font-medium text-teal-600 hover:text-teal-800">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{result?.total ?? 0} total tickets</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50">Previous</button>
            <span className="px-2 py-1.5">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
