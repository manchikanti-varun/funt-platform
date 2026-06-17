"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageSection, useAppDialog } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

interface PendingRow {
  id: string;
  kind: "COURSE" | "SHOP";
  studentId: string;
  studentName: string;
  studentUsername: string;
  batchId: string;
  batchName?: string;
  courseId: string;
  courseTitle?: string;
  productId: string;
  productName: string;
  transactionId: string;
  paidAt: string;
  createdAt?: string;
  paymentMethod?: string;
  amountPaise?: number;
  payerName?: string;
  razorpayVerified?: boolean;
  riskFlags?: string[];
  riskEscalatedAt?: string;
}

export default function AdminPaymentsPage() {
  const dialog = useAppDialog();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"ALL" | "COURSE" | "SHOP">("ALL");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api<PendingRow[]>(`/api/admin/payments/pending${flaggedOnly ? "?queue=risk" : ""}`)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setRows(r.data);
        else setRows([]);
      })
      .finally(() => setLoading(false));
  }, [flaggedOnly]);

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
    const reason = await dialog.prompt({
      title: "Reject payment",
      label: "Optional note for the student",
      placeholder: "Reason for rejection",
      optional: true,
      confirmLabel: "Reject",
    });
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
        <div className="spinner" />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const filteredRows = rows.filter((r) => {
    if (kindFilter !== "ALL" && r.kind !== kindFilter) return false;
    if (!q) return true;
    const hay = [
      r.studentName,
      r.studentUsername,
      r.courseTitle,
      r.batchName,
      r.productName,
      r.transactionId,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <PageHeader
        title="Payment verifications"
        subtitle="Course payments that used manual UPI appear here until you verify them. Razorpay course checkouts are confirmed automatically for the student (no action needed). Shop orders still require your confirmation."
      />
      {msg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100/80">
          {msg}
        </div>
      ) : null}
      <PageSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter payments">
            {(
              [
                { id: "ALL" as const, label: "All" },
                { id: "COURSE" as const, label: "Course" },
                { id: "SHOP" as const, label: "Shop" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setKindFilter(id)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  kindFilter === id
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:inline" aria-hidden />
            <button
              type="button"
              onClick={() => setFlaggedOnly((v) => !v)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                flaggedOnly
                  ? "bg-amber-600 text-white shadow-sm"
                  : "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
            >
              Flagged
            </button>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or transaction"
            className="input w-full sm:max-w-xs"
            aria-label="Search payments"
          />
        </div>
      </PageSection>
      {filteredRows.length === 0 ? (
        <EmptyState title="No pending payments" description="New submissions will appear here when students pay or submit UPI details." />
      ) : (
        <DataPanel>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Student</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Detail</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Method</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Amount / payer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Transaction</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Paid at</th>
                <th className="w-52 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((r) => (
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
                        <p className="font-medium text-slate-900">{r.productName || "Product"}</p>
                        <p className="font-mono text-xs text-slate-500">{r.productId}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-900">{r.courseTitle?.trim() || "Course"}</p>
                        <p className="text-sm text-slate-600">{r.batchName?.trim() || "Batch"}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {r.paymentMethod === "RAZORPAY" ? "Razorpay" : "UPI / manual"}
                    </span>
                    {r.razorpayVerified ? (
                      <span className="mt-1 block text-[10px] font-medium text-emerald-700">Signature OK</span>
                    ) : null}
                    {Array.isArray(r.riskFlags) && r.riskFlags.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.riskFlags.map((f) => (
                          <span key={f} className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            {f.replace("VELOCITY_", "velocity: ")}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {r.amountPaise != null && r.amountPaise > 0 ? (
                      <span className="font-mono font-medium">₹{(r.amountPaise / 100).toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {r.payerName ? <span className="mt-1 block text-slate-500">{r.payerName}</span> : null}
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
                        {actingId === r.id ? "…" : r.kind === "COURSE" ? "Verify & issue license" : "Verify"}
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
        </DataPanel>
      )}
    </AppPageShell>
  );
}
