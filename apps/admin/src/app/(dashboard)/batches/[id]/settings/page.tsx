"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { BackLink } from "@/components/ui/BackLink";

const ACTION_CARD_CLASS =
  "block w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md";

interface BatchInfo {
  name: string;
  isGlobalOnlineBatch?: boolean;
  isNotEnrolledBatch?: boolean;
}

export default function BatchSettingsHubPage() {
  const params = useParams();
  const id = params.id as string;
  const { roles } = useAdminUser();
  const isSuperAdmin = roles?.includes(ROLE.SUPER_ADMIN) ?? false;
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [settingGlobal, setSettingGlobal] = useState(false);
  const [settingNotEnrolled, setSettingNotEnrolled] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    api<BatchInfo>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) setBatch(r.data);
    });
  }, [id]);

  async function handleSetGlobalOnline() {
    setMessage(null);
    setSettingGlobal(true);
    const res = await api(`/api/batches/${id}/set-global-online`, { method: "POST" });
    setSettingGlobal(false);
    if (res.success) {
      setBatch((prev) => prev ? { ...prev, isGlobalOnlineBatch: true, isNotEnrolledBatch: false } : prev);
      setMessage({ type: "success", text: "This batch is now marked as the Global Online Batch." });
    } else {
      setMessage({ type: "error", text: res.message ?? "Failed to set Global Online Batch." });
    }
  }

  async function handleSetNotEnrolled() {
    setMessage(null);
    setSettingNotEnrolled(true);
    const res = await api(`/api/batches/${id}/set-not-enrolled`, { method: "POST" });
    setSettingNotEnrolled(false);
    if (res.success) {
      setBatch((prev) => prev ? { ...prev, isNotEnrolledBatch: true, isGlobalOnlineBatch: false } : prev);
      setMessage({ type: "success", text: "This batch is now marked as the Not Enrolled Students batch." });
    } else {
      setMessage({ type: "error", text: res.message ?? "Failed to set Not Enrolled Students batch." });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4">
        <BackLink href={`/batches/${id}/view`}>Back to batch</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Batch settings</h1>
          <p className="mt-1 text-sm text-slate-600">{batch?.name ?? ""}</p>
          <p className="mt-2 text-sm text-slate-500">Choose an action below.</p>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href={`/batches/${id}/student-access`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Student access</h2>
              <p className="mt-1 text-sm text-slate-500">Add, remove, or transfer students in this batch.</p>
            </Link>
            <Link href={`/batches/${id}/enrollment-requests`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Enrollment requests</h2>
              <p className="mt-1 text-sm text-slate-500">Approve or reject pending enrollment requests.</p>
            </Link>
            <Link href={`/batches/${id}/moderators`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Moderators</h2>
              <p className="mt-1 text-sm text-slate-500">Manage admins or trainers who can edit this batch.</p>
            </Link>
            <Link href={`/batches/${id}/submissions`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Assignment submissions</h2>
              <p className="mt-1 text-sm text-slate-500">Review and approve module assignment submissions.</p>
            </Link>
          </div>

          {/* Super Admin only: Global Batch Designation */}
          {isSuperAdmin && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Super Admin — Batch Designation</h3>
              <p className="mt-1 text-xs text-slate-500">
                Only one batch at a time can hold each designation. Setting it here will remove it from any other batch.
              </p>

              {message && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${message.type === "success" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
                  {message.text}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSetGlobalOnline}
                  disabled={settingGlobal || batch?.isGlobalOnlineBatch}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${
                    batch?.isGlobalOnlineBatch
                      ? "border-teal-300 bg-teal-100 text-teal-900"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-teal-50 hover:border-teal-300"
                  }`}
                >
                  {batch?.isGlobalOnlineBatch ? "✓ Global Online Batch" : settingGlobal ? "Setting…" : "Mark as Global Online Batch"}
                </button>

                <button
                  type="button"
                  onClick={handleSetNotEnrolled}
                  disabled={settingNotEnrolled || batch?.isNotEnrolledBatch}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${
                    batch?.isNotEnrolledBatch
                      ? "border-amber-300 bg-amber-100 text-amber-900"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-amber-50 hover:border-amber-300"
                  }`}
                >
                  {batch?.isNotEnrolledBatch ? "✓ Not Enrolled Students Batch" : settingNotEnrolled ? "Setting…" : "Mark as Not Enrolled Students Batch"}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                <strong>Global Online Batch:</strong> Students who skip batch ID during first course enrollment are auto-assigned here.
                <br />
                <strong>Not Enrolled Students Batch:</strong> Students who create an account without a batch ID are placed here until their first enrollment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
