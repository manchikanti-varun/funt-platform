"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/api";
import { parseJwtPayload } from "@/lib/auth";
import { ROLE } from "@funt-platform/constants";

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

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const token = getToken();
    const payload = token ? parseJwtPayload(token) : null;
    setIsSuperAdmin(payload?.roles?.includes(ROLE.SUPER_ADMIN) ?? false);
  }, []);

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
  }, [isSuperAdmin, page, action, performedBy, fromDate, toDate]);

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
        <p className="text-amber-600">Access restricted to Super Admin (backend: GET /api/audit).</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
      <p className="text-sm text-slate-600">From <code className="rounded bg-slate-100 px-1 text-xs">GET /api/audit</code>. Filter by action, performedBy, date range.</p>
      <div className="card flex flex-wrap gap-4">
        <input
          placeholder="Action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="input w-48"
        />
        <input
          placeholder="Performed by (FUNT ID or user id)"
          value={performedBy}
          onChange={(e) => setPerformedBy(e.target.value)}
          className="input w-48"
        />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input w-40" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input w-40" />
        <button type="button" onClick={() => setPage(1)} className="btn-primary">Filter</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : data ? (
        <>
          <p className="text-slate-600 text-sm">Total: {data.total} · Page {data.page}</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Performed by</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Target ID (FUNT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{log.action}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{log.performedByDisplay}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{log.targetEntity}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{log.targetIdDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-primary">Previous</button>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={data.logs.length < limit} className="btn-primary">Next</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
