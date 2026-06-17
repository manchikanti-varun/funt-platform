"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableTh } from "@/components/ui/SortableTh";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { useClientTableSort } from "@/lib/useClientTableSort";
import { AppPageShell } from "@/components/ui";

interface AuditEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByDisplay: string;
  targetEntity: string;
  targetId: string;
  targetIdDisplay: string;
  timestamp: string;
  meta?: unknown;
}

interface AuditResponse {
  logs: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}

function entityLabel(entity: string): string {
  if (entity === "GlobalModule") return "GlobalChapter";
  return entity;
}

export default function AuditLogPage() {
  const searchParams = useSearchParams();
  const { roles } = useAdminUser();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const actionFromUrl = (searchParams.get("action") ?? "").trim();
    setAction(actionFromUrl);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    setIsSuperAdmin(roles.includes(ROLE.SUPER_ADMIN));
  }, [roles]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (performedBy) params.set("performedBy", performedBy);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    params.set("page", String(page));
    params.set("limit", String(limit));
    api<AuditResponse>(`/api/audit?${params}`)
      .then((r) => {
        if (r.success && r.data) setData(r.data);
        else setError(r.message ?? "Failed to load audit logs");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [isSuperAdmin, page, limit, action, performedBy, fromDate, toDate]);

  const getAuditCellValue = useCallback((log: AuditEntry, key: string) => {
    switch (key) {
      case "timestamp":
        return log.timestamp;
      case "action":
        return log.action;
      case "performedBy":
        return log.performedByDisplay;
      case "targetEntity":
        return entityLabel(log.targetEntity);
      case "target":
        return log.targetIdDisplay;
      default:
        return "";
    }
  }, []);

  const { sortedRows, sortKey, sortDir, handleSort } = useClientTableSort(
    data?.logs ?? [],
    getAuditCellValue,
    { defaultSortKey: "timestamp", defaultSortDir: "desc" }
  );

  if (!isSuperAdmin) {
    return (
      <AppPageShell>
        <PageHeader title="Audit logs" subtitle="Super Admin only." />
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Access is restricted to Super Admin accounts.
        </p>
      </AppPageShell>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const pageNumbers = (() => {
    const windowSize = 2;
    const start = Math.max(1, page - windowSize);
    const end = Math.min(totalPages, page + windowSize);
    const pages: number[] = [];
    for (let p = start; p <= end; p += 1) pages.push(p);
    return pages;
  })();

  return (
    <AppPageShell>
      <PageHeader
        title="Audit logs"
        subtitle="Immutable history of important actions. Batches and courses show readable names where possible."
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/audit-hub" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Audit hub</Link>
        <Link href="/audit" className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">System</Link>
        <Link href="/license-key-audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">License keys</Link>
        <Link href="/coupon-audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Coupons</Link>
        <Link href="/audit?action=PAYMENT_UPI_UPDATED" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Payment UPI config</Link>
        <Link href="/payment-qr?section=HISTORY" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">QR history</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[8rem] flex-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Action
            <input
              placeholder="e.g. BATCH_UPDATED"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="input mt-1.5"
            />
          </label>
          <label className="block min-w-[10rem] flex-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Performed by
            <input
              placeholder="Username or user id"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              className="input mt-1.5"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input mt-1.5 w-40" />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input mt-1.5 w-40" />
          </label>
          <button type="button" onClick={() => setPage(1)} className="btn-primary shrink-0">
            Apply filters
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="spinner" />
        </div>
      ) : data && data.logs.length === 0 ? (
        <EmptyState title="No matching entries" description="Try widening the date range or clearing filters." />
      ) : data ? (
        <>
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{data.total}</span> entries · page{" "}
            <span className="font-medium text-slate-800">{data.page}</span> of {totalPages}
            <span className="text-slate-400"> · click column headers to sort this page</span>
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/80">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <SortableTh
                    label="Time"
                    columnKey="timestamp"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="Action"
                    columnKey="action"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="Performed by"
                    columnKey="performedBy"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="Entity"
                    columnKey="targetEntity"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="Target"
                    columnKey="target"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{log.action}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{log.performedByDisplay}</td>
                    <td className="px-4 py-3 text-slate-600">{entityLabel(log.targetEntity)}</td>
                    <td className="max-w-md px-4 py-3 text-slate-800">{log.targetIdDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageSizeSelect
              value={limit}
              onChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm">
              Previous
            </button>
            {pageNumbers[0] && pageNumbers[0] > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    page === 1 ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  1
                </button>
                {pageNumbers[0] > 2 ? <span className="px-1 text-sm text-slate-400">…</span> : null}
              </>
            ) : null}
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  page === p ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ))}
            {pageNumbers.length > 0 && pageNumbers[pageNumbers.length - 1] < totalPages ? (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? <span className="px-1 text-sm text-slate-400">…</span> : null}
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    page === totalPages ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {totalPages}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="btn-secondary text-sm"
            >
              Next
            </button>
            </div>
          </div>
        </>
      ) : null}
    </AppPageShell>
  );
}
