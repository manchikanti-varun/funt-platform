"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";

const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-800",
  APPROVED:  "bg-emerald-100 text-emerald-800",
  REJECTED:  "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  SICK: "Sick", CASUAL: "Casual", PERSONAL: "Personal",
  EMERGENCY: "Emergency", WORK_FROM_HOME: "WFH",
  COMP_OFF: "Comp Off", UNPAID: "Unpaid", CUSTOM: "Custom",
};

interface LeaveRow {
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
  status: string;
  createdAt: string;
}

interface ListResult {
  leaves: LeaveRow[];
  total: number;
  page: number;
  limit: number;
}

export default function LeaveManagementPage() {
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);

  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (roleFilter) params.set("role", roleFilter);
    const r = await api<ListResult>(`/api/leaves?${params.toString()}`);
    if (r.success && r.data) setResult(r.data);
    setLoading(false);
  }, [page, statusFilter, roleFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = result ? Math.ceil(result.total / (result.limit || 20)) : 1;

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Leave Management"
          subtitle="Review and manage leave requests from trainers and admins."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/leaves/my"
            className="btn-secondary inline-flex items-center gap-2 text-sm"
          >
            My Leaves
          </Link>
          <Link
            href="/leaves/calendar"
            className="btn-secondary inline-flex items-center gap-2 text-sm"
          >
            Calendar
          </Link>
          <Link
            href="/leaves/analytics"
            className="btn-secondary inline-flex items-center gap-2 text-sm"
          >
            Analytics
          </Link>
          {isSuperAdmin && (
            <Link
              href="/leaves/policy"
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              Leave Policy
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input text-sm"
        >
          <option value="">All Statuses</option>
          {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="input text-sm"
        >
          <option value="">All Roles</option>
          <option value="TRAINER">Trainer</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <button
          onClick={() => { setStatusFilter(""); setRoleFilter(""); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="spinner spinner--inline" />
          </div>
        ) : !result?.leaves.length ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
            No leave requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Employee", "Role", "Type", "From", "To", "Days", "Status", "Applied"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{leave.requestedByName}</p>
                      <p className="text-xs text-slate-500">@{leave.requestedByUsername}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{leave.requestedByRole.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {leave.leaveType === "CUSTOM" ? (leave.customLeaveType ?? "Custom") : (LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{leave.startDate.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-3 text-slate-600">{leave.endDate.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {leave.isHalfDay ? "½" : leave.totalDays}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEAVE_STATUS_COLORS[leave.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {leave.status.charAt(0) + leave.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(leave.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/leaves/${leave.id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        View
                      </Link>
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
          <span>{result?.total ?? 0} total requests</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="px-2 py-1.5">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
