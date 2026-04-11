"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface PendingRow {
  id: string;
  kind: "COURSE" | "SHOP";
  studentId: string;
  studentName: string;
  studentUsername: string;
  batchId: string;
  courseId: string;
  productId: string;
  productName: string;
  transactionId: string;
  paidAt: string;
  createdAt?: string;
}

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<PendingRow[]>("/api/admin/payments/pending")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setRows(r.data);
        else setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function verify(id: string) {
    setActingId(id);
    setMsg(null);
    const res = await api<{ assignedLicenseKey?: string; kind?: string }>(
      `/api/admin/payments/${encodeURIComponent(id)}/verify`,
      { method: "POST" }
    );
    setActingId(null);
    if (res.success) {
      const key = res.data?.assignedLicenseKey;
      const base = res.message ?? "Verified.";
      setMsg(key && res.data?.kind === "COURSE" ? `${base} License key (recorded): ${key}` : base);
      load();
    } else setMsg(res.message ?? "Failed");
  }

  async function reject(id: string) {
    const reason = typeof window !== "undefined" ? window.prompt("Optional note for the student (reason for rejection):") : null;
    if (reason === null) return;
    setActingId(id);
    setMsg(null);
    const res = await api(`/api/admin/payments/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    setActingId(null);
    if (res.success) {
      setMsg(res.message ?? "Rejected.");
      load();
    } else setMsg(res.message ?? "Failed");
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment verifications</h1>
        <p className="mt-1 text-sm text-slate-600">
          <strong>Verify &amp; assign license key</strong> for course payments: student is enrolled, access is on, and a single-use license row is recorded for audit. Shop payments fulfill the order only.
        </p>
      </div>
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No pending payments.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Student</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Detail</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Transaction</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Paid at</th>
                <th className="px-4 py-3 font-semibold text-slate-700 w-52">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{r.kind}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.studentName || "—"}</p>
                    <p className="text-xs text-slate-500">{r.studentUsername}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.kind === "SHOP" ? (
                      <>
                        <p className="font-medium">{r.productName || "Product"}</p>
                        <p className="text-xs text-slate-500">{r.productId}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs">Batch: {r.batchId || "—"}</p>
                        <p className="text-xs">Course: {r.courseId || "—"}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.transactionId}</td>
                  <td className="px-4 py-3 text-slate-600">{r.paidAt ? new Date(r.paidAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actingId === r.id}
                        onClick={() => verify(r.id)}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {actingId === r.id ? "…" : r.kind === "COURSE" ? "Verify & license" : "Verify"}
                      </button>
                      <button
                        type="button"
                        disabled={actingId === r.id}
                        onClick={() => reject(r.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
