"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { ROLE } from "@funt-platform/constants";

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-800",
  APPROVED:  "bg-emerald-100 text-emerald-800",
  REJECTED:  "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

const LEAVE_TYPES = ["SICK","CASUAL","PERSONAL","EMERGENCY","WORK_FROM_HOME","COMP_OFF","UNPAID","CUSTOM"];

interface LeaveRow {
  id: string;
  leaveType: string;
  customLeaveType?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  reason: string;
  status: string;
  reviewRemarks?: string;
  createdAt: string;
}

interface Balance { totalLeaves: number; usedLeaves: number; remainingLeaves: number; year: number }

interface Policy { allowHalfDay: boolean; leaveTypes: string[]; customLeaveTypes: string[] }

export default function MyLeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Form state
  const [leaveType, setLeaveType] = useState("SICK");
  const [customLeaveType, setCustomLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [leavesRes, balanceRes, policyRes] = await Promise.all([
      api<{ leaves: LeaveRow[] }>("/api/leaves/my?limit=50"),
      api<Balance>("/api/leaves/my/balance"),
      api<Policy>("/api/leaves/policy?year=0"),
    ]);
    if (leavesRes.success && leavesRes.data) setLeaves(leavesRes.data.leaves ?? []);
    if (balanceRes.success && balanceRes.data) setBalance(balanceRes.data);
    if (policyRes.success && policyRes.data) setPolicy(policyRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!startDate || !endDate) { setFormError("Start and end dates are required."); return; }
    if (new Date(endDate) < new Date(startDate)) { setFormError("End date cannot be before start date."); return; }
    if (!reason.trim()) { setFormError("Reason is required."); return; }
    setSubmitting(true);
    const res = await api("/api/leaves", {
      method: "POST",
      body: JSON.stringify({
        leaveType,
        customLeaveType: leaveType === "CUSTOM" ? customLeaveType : undefined,
        startDate,
        endDate,
        isHalfDay,
        reason,
      }),
    });
    setSubmitting(false);
    if (res.success) {
      setFormSuccess("Leave request submitted successfully.");
      setShowForm(false);
      setStartDate(""); setEndDate(""); setReason("");
      setIsHalfDay(false); setLeaveType("SICK");
      void load();
    } else {
      setFormError(res.message ?? "Failed to submit leave.");
    }
  }

  async function cancelLeave(id: string) {
    setCancellingId(id);
    await api(`/api/leaves/${id}/cancel`, { method: "PATCH", body: JSON.stringify({}) });
    setCancellingId(null);
    void load();
  }

  const allTypes = policy
    ? [...policy.leaveTypes, ...policy.customLeaveTypes]
    : LEAVE_TYPES;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <BackLink href="/leaves">Back to Leave Management</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="My Leaves" subtitle="Apply for leave and track your requests." />
        <button
          onClick={() => { setShowForm((s) => !s); setFormError(""); setFormSuccess(""); }}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          {showForm ? "Cancel" : "+ Apply Leave"}
        </button>
      </div>

      {/* Balance card */}
      {balance && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Leaves", value: balance.totalLeaves, color: "border-l-teal-500 text-teal-700" },
            { label: "Used",         value: balance.usedLeaves,  color: "border-l-amber-500 text-amber-700" },
            { label: "Remaining",    value: balance.remainingLeaves, color: "border-l-emerald-500 text-emerald-700" },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${c.color.split(" ")[0]}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${c.color.split(" ")[1]}`}>{c.label} ({balance.year})</p>
              <p className={`mt-1 text-3xl font-black tabular-nums ${c.color.split(" ")[1]}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {formSuccess && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {formSuccess}
        </p>
      )}

      {/* Apply form */}
      {showForm && (
        <form onSubmit={(e) => void submitLeave(e)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Apply for Leave</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none"
              >
                {allTypes.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            {leaveType === "CUSTOM" && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Custom Leave Name</label>
                <input
                  value={customLeaveType}
                  onChange={(e) => setCustomLeaveType(e.target.value)}
                  className="input w-full"
                  placeholder="e.g. Study leave"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="input w-full"
                min={startDate}
              />
            </div>
          </div>

          {policy?.allowHalfDay && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={(e) => setIsHalfDay(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Half-day leave
            </label>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Reason <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              placeholder="Describe the reason for your leave…"
            />
          </div>

          {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Submitting…</>
              ) : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* History table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Leave History</h2>
        </div>
        {leaves.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-slate-500">
            No leave requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  {["Type", "From", "To", "Days", "Status", "Remarks", "Applied", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {l.leaveType === "CUSTOM" ? (l.customLeaveType ?? "Custom") : l.leaveType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.startDate.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-3 text-slate-600">{l.endDate.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-3 text-slate-700">{l.isHalfDay ? "½" : l.totalDays}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{l.reviewRemarks || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {(l.status === "PENDING" || l.status === "APPROVED") && (
                        <button
                          onClick={() => void cancelLeave(l.id)}
                          disabled={cancellingId === l.id}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40"
                        >
                          {cancellingId === l.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
