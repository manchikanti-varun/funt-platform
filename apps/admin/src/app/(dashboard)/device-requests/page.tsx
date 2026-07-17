"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { useAppDialog } from "@/components/ui";
import { ROLE } from "@funt-platform/constants";
import { Monitor, Smartphone, CheckCircle2, XCircle, Clock, Shield } from "lucide-react";

interface DeviceChangeRequest {
  _id: string;
  userId: string;
  username?: string;
  studentName?: string;
  deviceType: string;
  currentDeviceName?: string;
  newDeviceName?: string;
  newOs?: string;
  newBrowser?: string;
  reason?: string;
  status: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export default function DeviceRequestsPage() {
  const dialog = useAppDialog();
  const [requests, setRequests] = useState<DeviceChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("PENDING");
  const [actionId, setActionId] = useState("");

  async function load() {
    setLoading(true);
    const qs = filter ? `?status=${filter}` : "";
    const r = await api<DeviceChangeRequest[]>(`/api/admin/device-requests${qs}`);
    if (r.success && Array.isArray(r.data)) setRequests(r.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleApprove(id: string) {
    const confirmed = await dialog.confirm({
      title: "Approve Device Change",
      message: "The student's old device will be revoked and the new device will become trusted. Continue?",
      confirmLabel: "Approve",
    });
    if (!confirmed) return;
    setActionId(id);
    const r = await api(`/api/admin/device-requests/${id}/approve`, { method: "POST" });
    setActionId("");
    if (r.success) load();
  }

  async function handleReject(id: string) {
    const note = await dialog.prompt({
      title: "Reject Device Change",
      label: "Reason (optional)",
      optional: true,
      confirmLabel: "Reject",
    });
    if (note === null) return;
    setActionId(id);
    const r = await api(`/api/admin/device-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) });
    setActionId("");
    if (r.success) load();
  }

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.SUPER_ADMIN, ROLE.ADMIN]} fallbackHref="/dashboard" />
      <PageHeader
        title="Device Change Requests"
        subtitle="Review student requests to change their trusted devices."
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(["PENDING", "APPROVED", "REJECTED", ""] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === s ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {s || "All"}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-8 w-8" />}
          title="No requests"
          description={filter === "PENDING" ? "No pending device change requests." : "No requests match this filter."}
        />
      ) : (
        <DataPanel className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="th-compact">Student</th>
                <th className="th-compact">Device Type</th>
                <th className="th-compact">Current Device</th>
                <th className="th-compact">New Device</th>
                <th className="th-compact">Requested</th>
                <th className="th-compact">Status</th>
                <th className="th-compact text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((req) => (
                <tr key={req._id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{req.studentName ?? "—"}</p>
                    <p className="text-xs text-slate-400">@{req.username ?? req.userId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      {req.deviceType === "MOBILE" ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                      {req.deviceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{req.currentDeviceName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-800">{req.newDeviceName ?? "—"}</p>
                    <p className="text-[10px] text-slate-400">{req.newOs} · {req.newBrowser}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      req.status === "PENDING" ? "bg-amber-50 text-amber-700" : req.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}>
                      {req.status === "PENDING" ? <Clock className="h-3 w-3" /> : req.status === "APPROVED" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.status === "PENDING" && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleApprove(req._id)} disabled={actionId === req._id} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Approve</button>
                        <button onClick={() => handleReject(req._id)} disabled={actionId === req._id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Reject</button>
                      </div>
                    )}
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
