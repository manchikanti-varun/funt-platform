"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  studentName: string;
  studentUsername: string;
  batchName: string;
  courseTitle: string;
  amountFormatted: string;
  issuedAt: string;
}

interface BatchOption {
  id: string;
  name: string;
  courseSnapshots?: Array<{ courseId?: string; title?: string }>;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterBatchId, setFilterBatchId] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [studentId, setStudentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [amountRupees, setAmountRupees] = useState("");
  const [lineItemType, setLineItemType] = useState<"SERVICE" | "GOODS">("SERVICE");

  const courseOptions = useMemo(
    () => batches.find((b) => b.id === batchId)?.courseSnapshots ?? [],
    [batches, batchId]
  );

  const load = useCallback(() => {
    setLoading(true);
    const qs = filterBatchId ? `?batchId=${encodeURIComponent(filterBatchId)}` : "";
    api<InvoiceRow[]>(`/api/admin/invoices${qs}`)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setInvoices(r.data);
        else setInvoices([]);
      })
      .finally(() => setLoading(false));
  }, [filterBatchId]);

  useEffect(() => {
    api<BatchOption[]>("/api/batches").then((r) => {
      if (r.success && Array.isArray(r.data)) setBatches(r.data);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setGenerating(true);
    const body: Record<string, string | number> = {
      studentId: studentId.trim(),
      batchId,
    };
    if (courseId) body.courseId = courseId;
    if (amountRupees.trim()) body.amountRupees = Number(amountRupees);
    body.lineItemType = lineItemType;

    const res = await api<{ invoiceNumber: string }>("/api/admin/invoices", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setGenerating(false);

    if (res.success && res.data) {
      setMsg({ type: "success", text: `Created ${res.data.invoiceNumber}.` });
      setStudentId("");
      setAmountRupees("");
      load();
    } else {
      setMsg({ type: "error", text: res.message ?? "Could not create invoice." });
    }
  }

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
        <div className="flex gap-3 text-sm font-semibold text-teal-700">
          <Link href="/invoices/settings" className="hover:underline">
            Invoice settings
          </Link>
          <Link href="/invoices/sample" className="hover:underline">
            Sample
          </Link>
        </div>
      </div>

      <form onSubmit={generateInvoice} className="card mt-6 max-w-md space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Student</label>
          <input
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="input"
            placeholder="Username or ID"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Batch</label>
          <select
            required
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setCourseId("");
            }}
            className="input"
          >
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        {courseOptions.length > 1 ? (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Course</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input">
              <option value="">Default</option>
              {courseOptions.map((c) => (
                <option key={c.courseId} value={c.courseId ?? ""}>
                  {c.title ?? c.courseId}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Line type</label>
          <select
            value={lineItemType}
            onChange={(e) => setLineItemType(e.target.value as "SERVICE" | "GOODS")}
            className="input"
          >
            <option value="SERVICE">Course / service (SAC)</option>
            <option value="GOODS">Kit / goods (HSN)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Total amount (₹)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            className="input"
            placeholder="Batch price if empty"
          />
        </div>
        {msg ? (
          <p className={msg.type === "success" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.text}</p>
        ) : null}
        <button type="submit" disabled={generating} className="btn-primary">
          {generating ? "Saving…" : "Create invoice"}
        </button>
      </form>

      <div className="mt-8">
        <select
          value={filterBatchId}
          onChange={(e) => setFilterBatchId(e.target.value)}
          className="input mb-4 max-w-xs"
          aria-label="Filter batch"
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <DataPanel>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No invoices.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2">
                        {inv.studentName || inv.studentUsername}
                      </td>
                      <td className="px-3 py-2">
                        {inv.courseTitle || inv.batchName}
                      </td>
                      <td className="px-3 py-2">{inv.amountFormatted}</td>
                      <td className="px-3 py-2">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <Link href={`/invoices/${inv.id}`} className="text-teal-700 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataPanel>
      </div>
    </AppPageShell>
  );
}
