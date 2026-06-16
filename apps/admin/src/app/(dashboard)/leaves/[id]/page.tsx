"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";
import { RequireRoles } from "@/components/auth/RequireRoles";

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED:  "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED:  "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

interface LeaveDetail {
  id: string;
  requestedByName: string;
  requestedByUsername: string;
  requestedByRole: string;
  leaveType: string;
  customLeaveType?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  reason: string;
  attachment?: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  cancelledAt?: string;
  affectedBatches?: string[];
  substituteTrainerId?: string;
  leaveImpactNotes?: string;
  createdAt: string;
}

export default function LeaveDetailPage() {
  const { roles } = useAdminUser();
  const params = useParams();
  const id = params.id as string;
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);
  const isAdmin = roles.includes(ROLE.ADMIN) || isSuperAdmin;

  const [leave, setLeave] = useState<LeaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!id) return;
    api<LeaveDetail>(`/api/leaves/${id}`).then((r) => {
      if (r.success && r.data) {
        setLeave(r.data);
      }
      setLoading(false);
    });
  }, [id]);

  async function doAction(action: "approve" | "reject") {
    if (action === "reject" && !remarks.trim()) {
      setError("Review remarks are required when rejecting.");
      return;
    }
    setError("");
    setActionLoading(true);
    const res = await api(`/api/leaves/${id}/${action}`, {
      method: "PATCH",
      body: JSON.stringify({ reviewRemarks: remarks }),
    });
    setActionLoading(false);
    if (res.success) {
      setSuccess(`Leave ${action === "approve" ? "approved" : "rejected"} successfully.`);
      api<LeaveDetail>(`/api/leaves/${id}`).then((r) => {
        if (r.success && r.data) setLeave(r.data);
      });
    } else {
      setError(res.message ?? "Action failed.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  if (!leave) {
    return (
      <div className="w-full space-y-4">
        <BackLink href="/leaves">Back to Leave Management</BackLink>
        <p className="text-slate-600">Leave request not found.</p>
      </div>
    );
  }

  const canReview = isAdmin && leave.status === "PENDING" &&
    (leave.requestedByRole !== "ADMIN" || isSuperAdmin);

  const canCancel = isSuperAdmin && leave.status === "APPROVED";

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value || "—"}</p>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <BackLink href="/leaves">Back to Leave Management</BackLink>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {leave.leaveType === "CUSTOM" ? (leave.customLeaveType ?? "Custom") : leave.leaveType} Leave
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {leave.requestedByName} (@{leave.requestedByUsername}) · {leave.requestedByRole.replace("_", " ")}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_COLORS[leave.status] ?? "bg-slate-100 text-slate-600"}`}>
            {leave.status.charAt(0) + leave.status.slice(1).toLowerCase()}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Start Date" value={leave.startDate.split("-").reverse().join("/")} />
          <Field label="End Date" value={leave.endDate.split("-").reverse().join("/")} />
          <Field label="Total Days" value={leave.isHalfDay ? "Half day" : `${leave.totalDays} day${leave.totalDays !== 1 ? "s" : ""}`} />
          <Field label="Reason" value={leave.reason} />
          <Field label="Applied On" value={new Date(leave.createdAt).toLocaleString()} />
          {leave.attachment && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attachment</p>
              <a href={leave.attachment} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-teal-600 hover:underline">
                View attachment
              </a>
            </div>
          )}
          {leave.reviewedAt && (
            <>
              <Field label="Reviewed At" value={new Date(leave.reviewedAt).toLocaleString()} />
              <Field label="Review Remarks" value={leave.reviewRemarks} />
            </>
          )}
          {leave.cancelledAt && (
            <Field label="Cancelled At" value={new Date(leave.cancelledAt).toLocaleString()} />
          )}
        </div>

        {/* Review actions */}
        {canReview && (
          <div className="border-t border-slate-200 px-6 py-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Review</h2>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Remarks <span className="text-slate-400">(required for rejection)</span>
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Add review remarks…"
              />
            </div>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => void doAction("approve")}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading ? "Processing…" : "Approve"}
              </button>
              <button
                onClick={() => void doAction("reject")}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                {actionLoading ? "Processing…" : "Reject"}
              </button>
            </div>
          </div>
        )}
        {!canReview && success && (
          <div className="border-t border-slate-200 px-6 py-4">
            <p className="text-sm font-medium text-emerald-700">{success}</p>
          </div>
        )}
        {canCancel && (
          <div className="border-t border-slate-200 px-6 py-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Cancel Approved Leave</h2>
            <p className="text-xs text-slate-500">Only super admins can cancel an already approved leave. This will revert the balance.</p>
            {error && !canReview && <p className="text-sm font-medium text-red-600">{error}</p>}
            {success && !canReview && <p className="text-sm font-medium text-emerald-700">{success}</p>}
            <button
              onClick={async () => {
                setError("");
                setActionLoading(true);
                const res = await api(`/api/leaves/${id}/cancel`, {
                  method: "PATCH",
                  body: JSON.stringify({}),
                });
                setActionLoading(false);
                if (res.success) {
                  setSuccess("Leave cancelled successfully.");
                  api<LeaveDetail>(`/api/leaves/${id}`).then((r) => {
                    if (r.success && r.data) setLeave(r.data);
                  });
                } else {
                  setError(res.message ?? "Failed to cancel leave.");
                }
              }}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {actionLoading ? "Processing…" : "Cancel This Leave"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
