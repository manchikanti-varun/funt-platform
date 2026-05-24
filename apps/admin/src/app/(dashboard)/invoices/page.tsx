"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Alert, AppPageShell, EmptyState, PageSection } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import {
  AdminSpinner,
  FieldLabel,
  InvoicePageActions,
  InvoiceSubNav,
  LineTypePills,
  PaymentsCommerceNav,
  StatCard,
} from "@/components/invoices/InvoiceAdminUi";

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
  const [search, setSearch] = useState("");
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

  const filterBatchName = batches.find((b) => b.id === filterBatchId)?.name;

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

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const hay = [
        inv.invoiceNumber,
        inv.studentName,
        inv.studentUsername,
        inv.courseTitle,
        inv.batchName,
        inv.amountFormatted,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, search]);

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

    const res = await api<{ invoiceNumber: string; id?: string }>("/api/admin/invoices", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setGenerating(false);

    if (res.success && res.data) {
      setMsg({ type: "success", text: `Invoice ${res.data.invoiceNumber} created.` });
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
      <PageHeader
        title="Invoices"
        subtitle="GST tax invoices for enrollments and kit sales. Issued automatically on enrollment; students download PDFs from the LMS."
        actions={<InvoicePageActions />}
      />

      <PaymentsCommerceNav />
      <InvoiceSubNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Invoices" value={loading ? "—" : invoices.length} hint="In current filter" />
        <StatCard
          label="Batch filter"
          value={filterBatchName ?? "All batches"}
          hint={filterBatchId ? "Scoped list" : "No batch filter"}
        />
        <StatCard label="Auto-issue" value="On enroll" hint="Manual create available below" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,400px)_1fr]">
        <PageSection title="Create invoice" subtitle="Issue a tax invoice manually for a student and batch.">
          <form onSubmit={generateInvoice} className="space-y-5">
            <div>
              <FieldLabel hint="Username or MongoDB ID">Student</FieldLabel>
              <input
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="input"
                placeholder="e.g. srikar.ch"
              />
            </div>
            <div>
              <FieldLabel>Batch</FieldLabel>
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
                <FieldLabel>Course</FieldLabel>
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input">
                  <option value="">Default course</option>
                  {courseOptions.map((c) => (
                    <option key={c.courseId} value={c.courseId ?? ""}>
                      {c.title ?? c.courseId}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <FieldLabel>Line type</FieldLabel>
              <LineTypePills value={lineItemType} onChange={setLineItemType} />
            </div>
            <div>
              <FieldLabel hint="Tax-inclusive total in INR. Uses batch price if empty.">
                Total amount (₹)
              </FieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="input"
                placeholder="4999.00"
              />
            </div>
            {msg ? <Alert variant={msg.type}>{msg.text}</Alert> : null}
            <button type="submit" disabled={generating} className="btn-primary w-full">
              {generating ? "Creating…" : "Create invoice"}
            </button>
          </form>
        </PageSection>

        <PageSection
          title="All invoices"
          subtitle={
            loading
              ? "Loading…"
              : `${filteredInvoices.length} shown${search.trim() ? ` (filtered)` : ""}`
          }
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice, student…"
                className="input text-sm sm:min-w-[200px]"
                aria-label="Search invoices"
              />
              <select
                value={filterBatchId}
                onChange={(e) => setFilterBatchId(e.target.value)}
                className="input text-sm sm:max-w-[200px]"
                aria-label="Filter by batch"
              >
                <option value="">All batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {loading ? (
            <AdminSpinner />
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Invoices are created automatically on enrollment, or use the form to issue one manually."
            />
          ) : (
            <div className="-mx-5 -mb-5 overflow-hidden rounded-b-2xl border-t border-slate-200 sm:-mx-6 sm:-mb-6">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Invoice
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Student
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Course
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <span className="badge-info font-mono !rounded-md !px-2 !py-0.5 !text-[11px]">
                            {inv.invoiceNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {inv.studentName || inv.studentUsername}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{inv.courseTitle || inv.batchName}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{inv.amountFormatted}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(inv.issuedAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500"
                          >
                            View / PDF
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PageSection>
      </div>
    </AppPageShell>
  );
}
