"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAdminUser } from "@/contexts/AdminUserContext";

const DEFAULT_LEAVE_TYPES = ["SICK", "CASUAL", "PERSONAL", "EMERGENCY", "WORK_FROM_HOME", "COMP_OFF", "UNPAID"];

interface Policy {
  year: number;
  annualLeaveLimit: number;
  leaveTypes: string[];
  allowHalfDay: boolean;
  maxConsecutiveLeaves: number;
  customLeaveTypes: string[];
}

export default function LeavePolicyPage() {
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);

  const [policy, setPolicy] = useState<Policy>({
    year: 0,
    annualLeaveLimit: 12,
    leaveTypes: [...DEFAULT_LEAVE_TYPES],
    allowHalfDay: true,
    maxConsecutiveLeaves: 7,
    customLeaveTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [newCustomType, setNewCustomType] = useState("");

  useEffect(() => {
    api<Policy>("/api/leaves/policy?year=0").then((r) => {
      if (r.success && r.data) setPolicy(r.data);
      setLoading(false);
    });
  }, []);

  async function save() {
    setError("");
    setSuccess(false);
    setSaving(true);
    const res = await api("/api/leaves/policy", {
      method: "PUT",
      body: JSON.stringify({
        year: policy.year,
        annualLeaveLimit: policy.annualLeaveLimit,
        leaveTypes: policy.leaveTypes,
        allowHalfDay: policy.allowHalfDay,
        maxConsecutiveLeaves: policy.maxConsecutiveLeaves,
        customLeaveTypes: policy.customLeaveTypes,
      }),
    });
    setSaving(false);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(res.message ?? "Failed to save policy.");
    }
  }

  function toggleLeaveType(type: string) {
    setPolicy((p) => ({
      ...p,
      leaveTypes: p.leaveTypes.includes(type)
        ? p.leaveTypes.filter((t) => t !== type)
        : [...p.leaveTypes, type],
    }));
  }

  function addCustomType() {
    const t = newCustomType.trim().toUpperCase();
    if (!t || policy.customLeaveTypes.includes(t)) return;
    setPolicy((p) => ({ ...p, customLeaveTypes: [...p.customLeaveTypes, t] }));
    setNewCustomType("");
  }

  function removeCustomType(t: string) {
    setPolicy((p) => ({ ...p, customLeaveTypes: p.customLeaveTypes.filter((x) => x !== t) }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[ROLE.SUPER_ADMIN]} fallbackHref="/leaves" />
      <BackLink href="/leaves">Back to Leave Management</BackLink>
      <PageHeader
        title="Leave Policy"
        subtitle="Configure global leave rules applied to all staff."
      />

      {!isSuperAdmin && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Read-only — only Super Admins can edit the leave policy.
        </p>
      )}

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Annual limit */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Annual Leave Limit (days)
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={policy.annualLeaveLimit}
              onChange={(e) => setPolicy((p) => ({ ...p, annualLeaveLimit: Number(e.target.value) }))}
              disabled={!isSuperAdmin || saving}
              className="input w-full max-w-xs"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Max Consecutive Leaves (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={policy.maxConsecutiveLeaves}
              onChange={(e) => setPolicy((p) => ({ ...p, maxConsecutiveLeaves: Number(e.target.value) }))}
              disabled={!isSuperAdmin || saving}
              className="input w-full max-w-xs"
            />
          </div>
        </div>

        {/* Half day toggle */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
          <input
            type="checkbox"
            checked={policy.allowHalfDay}
            onChange={(e) => setPolicy((p) => ({ ...p, allowHalfDay: e.target.checked }))}
            disabled={!isSuperAdmin || saving}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">Allow Half-Day Leaves</span>
            <span className="block text-xs text-slate-500">Permits staff to apply for 0.5 day leaves.</span>
          </span>
        </label>

        {/* Enabled leave types */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Enabled Leave Types</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_LEAVE_TYPES.map((type) => {
              const active = policy.leaveTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => isSuperAdmin && toggleLeaveType(type)}
                  disabled={!isSuperAdmin || saving}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  } disabled:cursor-not-allowed`}
                >
                  {type.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom leave types */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Custom Leave Types</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {policy.customLeaveTypes.length === 0 && (
              <p className="text-xs text-slate-400">No custom types yet.</p>
            )}
            {policy.customLeaveTypes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                {t}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => removeCustomType(t)}
                    className="ml-0.5 text-violet-500 hover:text-violet-900"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {isSuperAdmin && (
            <div className="flex gap-2">
              <input
                value={newCustomType}
                onChange={(e) => setNewCustomType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomType()}
                placeholder="e.g. STUDY_LEAVE"
                className="input max-w-xs"
              />
              <button
                type="button"
                onClick={addCustomType}
                disabled={!newCustomType.trim()}
                className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {isSuperAdmin && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : "Save Policy"}
          </button>
          {success && <span className="text-sm font-medium text-emerald-700">Policy saved.</span>}
        </div>
      )}
    </div>
  );
}
