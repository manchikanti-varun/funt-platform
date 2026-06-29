"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageSection, useAppDialog } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { ROLE } from "@funt-platform/constants";

interface PromiseRow {
  promiseId: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  batchId: string;
  courseId: string;
  milestoneId: string;
  milestoneTitle: string;
  amountPaise: number;
  amountRupees: number;
  currency: string;
  status: string;
  promiseDate: string;
  dueDate: string;
  daysRemaining: number;
  reason?: string;
  remarks?: string;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  paidAt?: string;
  suspendedAt?: string;
  remindersSent: number;
}

interface Analytics {
  totalRequests: number;
  approvalRate: number;
  avgDaysPromised: number;
  avgPaymentDelay: number;
  overduePercentage: number;
  recoveryRate: number;
  revenuePendingRupees: number;
  revenueCollectedRupees: number;
  byStatus: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  PROMISED: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAID: "bg-teal-100 text-teal-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  REJECTED: "bg-rose-100 text-rose-700",
  SUSPENDED: "bg-amber-100 text-amber-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function PaymentPromisesPage() {
  const dialog = useAppDialog();
  const [rows, setRows] = useState<PromiseRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const qs = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
    Promise.all([
      api<{ promises: PromiseRow[]; total: number }>(`/api/payment-promises/admin${qs}`),
      api<Analytics>("/api/payment-promises/analytics"),
    ]).then(([listRes, analyticsRes]) => {
      if (listRes.success && listRes.data) setRows(listRes.data.promises ?? []);
      if (analyticsRes.success && analyticsRes.data) setAnalytics(analyticsRes.data);
    }).finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    const dueDateStr = await dialog.prompt({
      title: "Approve Payment Promise",
      label: "Override due date (optional, leave blank to keep student's date)",
      placeholder: "YYYY-MM-DD",
      optional: true,
      confirmLabel: "Approve",
    });
    if (dueDateStr === null) return;
    setActingId(id);
    setMsg(null);
    const body: Record<string, string> = {};
    if (dueDateStr.trim()) body.adminDueDate = dueDateStr.trim();
    const res = await api(`/api/payment-promises/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setActingId(null);
    if (res.success) { setMsg("Promise approved — temporary access granted."); load(); }
    else setMsg(res.message ?? "Failed to approve");
  }

  async function reject(id: string) {
    const note = await dialog.prompt({
      title: "Reject Payment Promise",
      label: "Reason (optional)",
      placeholder: "Why is this being rejected?",
      optional: true,
      confirmLabel: "Reject",
    });
    if (note === null) return;
    setActingId(id);
    setMsg(null);
    const res = await api(`/api/payment-promises/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectionNote: note.trim() || undefined }),
    });
    setActingId(null);
    if (res.success) { setMsg("Promise rejected."); load(); }
    else setMsg(res.message ?? "Failed to reject");
  }

  async function markPaid(id: string) {
    const paymentId = await dialog.prompt({
      title: "Mark as Paid",
      label: "Payment/Transaction ID",
      placeholder: "Enter the payment reference",
      confirmLabel: "Confirm Payment",
    });
    if (!paymentId?.trim()) return;
    setActingId(id);
    setMsg(null);
    const res = await api(`/api/payment-promises/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ paymentId: paymentId.trim() }),
    });
    setActingId(null);
    if (res.success) { setMsg("Marked as paid. Access confirmed."); load(); }
    else setMsg(res.message ?? "Failed");
  }

  async function reactivate(id: string) {
    const ok = await dialog.confirm({
      title: "Reactivate Access",
      message: "This will restore the student's milestone access. Continue?",
      confirmLabel: "Reactivate",
    });
    if (!ok) return;
    setActingId(id);
    const res = await api(`/api/payment-promises/${id}/reactivate`, { method: "POST" });
    setActingId(null);
    if (res.success) { setMsg("Access reactivated."); load(); }
    else setMsg(res.message ?? "Failed");
  }

  async function cancelPromise(id: string) {
    const ok = await dialog.confirm({
      title: "Cancel Promise",
      message: "This will revoke temporary access if active. Continue?",
      confirmLabel: "Cancel Promise",
    });
    if (!ok) return;
    setActingId(id);
    const res = await api(`/api/payment-promises/${id}`, { method: "DELETE" });
    setActingId(null);
    if (res.success) { setMsg("Promise cancelled."); load(); }
    else setMsg(res.message ?? "Failed");
  }

  async function changeDueDate(id: string) {
    const newDate = await dialog.prompt({
      title: "Change Due Date",
      label: "New due date",
      placeholder: "YYYY-MM-DD",
      confirmLabel: "Update",
    });
    if (!newDate?.trim()) return;
    setActingId(id);
    const res = await api(`/api/payment-promises/${id}/due-date`, {
      method: "PATCH",
      body: JSON.stringify({ newDueDate: newDate.trim() }),
    });
    setActingId(null);
    if (res.success) { setMsg("Due date updated."); load(); }
    else setMsg(res.message ?? "Failed");
  }

  async function processOverdue() {
    const ok = await dialog.confirm({
      title: "Process Overdue Promises",
      message: "This will suspend access for all promises past their due date. Continue?",
      confirmLabel: "Process",
    });
    if (!ok) return;
    const res = await api("/api/payment-promises/process-overdue", { method: "POST" });
    if (res.success) { setMsg(res.message ?? "Processed."); load(); }
    else setMsg(res.message ?? "Failed");
  }

  async function sendReminders() {
    const res = await api("/api/payment-promises/send-reminders", { method: "POST" });
    if (res.success) setMsg(res.message ?? "Reminders sent.");
    else setMsg(res.message ?? "Failed");
  }

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (!q) return true;
    return [r.studentName, r.studentUsername, r.milestoneTitle, r.promiseId]
      .join(" ").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[ROLE.SUPER_ADMIN, ROLE.ADMIN]} fallbackHref="/dashboard" />
      <PageHeader
        title="Payment Promises"
        subtitle="Track and manage pay-later requests from students. Approve, extend, or suspend access based on payment commitments."
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={sendReminders} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Send Reminders
            </button>
            <button type="button" onClick={processOverdue} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
              Process Overdue
            </button>
          </div>
        }
      />

      {msg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100/80">
          {msg}
          <button type="button" onClick={() => setMsg(null)} className="ml-2 text-emerald-600 underline">dismiss</button>
        </div>
      )}

      {/* Analytics cards */}
      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Requests" value={analytics.totalRequests} />
          <StatCard label="Approval Rate" value={`${analytics.approvalRate}%`} />
          <StatCard label="Revenue Pending" value={`₹${analytics.revenuePendingRupees.toLocaleString("en-IN")}`} />
          <StatCard label="Revenue Collected" value={`₹${analytics.revenueCollectedRupees.toLocaleString("en-IN")}`} />
          <StatCard label="Avg Days Promised" value={analytics.avgDaysPromised} />
          <StatCard label="Avg Payment Delay" value={`${analytics.avgPaymentDelay}d`} />
          <StatCard label="Overdue %" value={`${analytics.overduePercentage}%`} />
          <StatCard label="Recovery Rate" value={`${analytics.recoveryRate}%`} />
        </div>
      )}

      {/* Filters */}
      <PageSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
            {["ALL", "PROMISED", "ACTIVE", "OVERDUE", "PAID", "CANCELLED", "REJECTED"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  statusFilter === s ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                {s !== "ALL" && analytics?.byStatus[s] ? ` (${analytics.byStatus[s]})` : ""}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or milestone"
            className="input w-full sm:max-w-xs"
            aria-label="Search promises"
          />
        </div>
      </PageSection>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No payment promises" description="Promises will appear here when students request pay-later access." />
      ) : (
        <DataPanel>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Student</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Milestone</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Due Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Days Left</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Reason</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Requested</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.promiseId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.studentName || "—"}</p>
                      <p className="text-xs text-slate-500">{r.studentUsername}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.milestoneTitle}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">₹{r.amountRupees}</td>
                    <td className="px-4 py-3 text-slate-700">{new Date(r.dueDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${r.daysRemaining < 0 ? "text-red-600" : r.daysRemaining <= 3 ? "text-amber-600" : "text-slate-700"}`}>
                        {r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d overdue` : `${r.daysRemaining}d`}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-xs text-slate-500" title={r.reason}>{r.reason || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.requestedAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <RowActions
                        row={r}
                        acting={actingId === r.promiseId}
                        onApprove={() => approve(r.promiseId)}
                        onReject={() => reject(r.promiseId)}
                        onMarkPaid={() => markPaid(r.promiseId)}
                        onReactivate={() => reactivate(r.promiseId)}
                        onCancel={() => cancelPromise(r.promiseId)}
                        onChangeDue={() => changeDueDate(r.promiseId)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      )}
    </AppPageShell>
  );
}

// ─── Row Actions (contextual buttons based on status) ─────────────────────────

function RowActions({
  row,
  acting,
  onApprove,
  onReject,
  onMarkPaid,
  onReactivate,
  onCancel,
  onChangeDue,
}: {
  row: PromiseRow;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onMarkPaid: () => void;
  onReactivate: () => void;
  onCancel: () => void;
  onChangeDue: () => void;
}) {
  const btnBase = "rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50";
  const btnPrimary = `${btnBase} bg-teal-600 text-white hover:bg-teal-700`;
  const btnDanger = `${btnBase} border border-red-200 text-red-700 hover:bg-red-50`;
  const btnSecondary = `${btnBase} border border-slate-200 text-slate-700 hover:bg-slate-50`;

  return (
    <div className="flex flex-wrap gap-1.5">
      {row.status === "PROMISED" && (
        <>
          <button type="button" disabled={acting} onClick={onApprove} className={btnPrimary}>Approve</button>
          <button type="button" disabled={acting} onClick={onReject} className={btnDanger}>Reject</button>
        </>
      )}
      {row.status === "ACTIVE" && (
        <>
          <button type="button" disabled={acting} onClick={onMarkPaid} className={btnPrimary}>Mark Paid</button>
          <button type="button" disabled={acting} onClick={onChangeDue} className={btnSecondary}>Extend</button>
          <button type="button" disabled={acting} onClick={onCancel} className={btnDanger}>Cancel</button>
        </>
      )}
      {(row.status === "OVERDUE" || row.status === "SUSPENDED") && (
        <>
          <button type="button" disabled={acting} onClick={onMarkPaid} className={btnPrimary}>Mark Paid</button>
          <button type="button" disabled={acting} onClick={onReactivate} className={btnSecondary}>Reactivate</button>
          <button type="button" disabled={acting} onClick={onChangeDue} className={btnSecondary}>Extend</button>
        </>
      )}
    </div>
  );
}
