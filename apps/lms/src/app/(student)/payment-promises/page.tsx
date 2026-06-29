"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel } from "@/components/ui";

interface MyPromise {
  promiseId: string;
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
  requestedAt: string;
  approvedAt?: string;
  paidAt?: string;
  suspendedAt?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PROMISED: { label: "Pending Approval", color: "bg-blue-100 text-blue-800" },
  ACTIVE: { label: "Active — Payment Pending", color: "bg-emerald-100 text-emerald-800" },
  PAID: { label: "Paid", color: "bg-teal-100 text-teal-800" },
  OVERDUE: { label: "Overdue — Access Suspended", color: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-slate-600" },
  REJECTED: { label: "Rejected", color: "bg-rose-100 text-rose-700" },
  SUSPENDED: { label: "Suspended", color: "bg-amber-100 text-amber-800" },
};

export default function StudentPaymentPromisesPage() {
  const [promises, setPromises] = useState<MyPromise[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api<MyPromise[]>("/api/payment-promises/student")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setPromises(r.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const active = promises.filter((p) => ["ACTIVE", "OVERDUE", "PROMISED"].includes(p.status));
  const past = promises.filter((p) => ["PAID", "CANCELLED", "REJECTED", "SUSPENDED"].includes(p.status));

  return (
    <AppPageShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Promises</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your pay-later requests and their current status.
          </p>
        </div>

        {promises.length === 0 && (
          <FormPanel>
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">No payment promises yet.</p>
              <p className="mt-1 text-xs text-slate-400">
                You can request pay-later access from your course milestone page.
              </p>
            </div>
          </FormPanel>
        )}

        {/* Active / Pending Promises */}
        {active.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Active Promises</h2>
            {active.map((p) => (
              <PromiseCard key={p.promiseId} promise={p} />
            ))}
          </div>
        )}

        {/* Past Promises */}
        {past.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">History</h2>
            {past.map((p) => (
              <PromiseCard key={p.promiseId} promise={p} />
            ))}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}

function PromiseCard({ promise }: { promise: MyPromise }) {
  const statusInfo = STATUS_LABELS[promise.status] ?? { label: promise.status, color: "bg-slate-100 text-slate-700" };
  const isOverdue = promise.status === "OVERDUE" || promise.status === "SUSPENDED";
  const isActive = promise.status === "ACTIVE";
  const showPayButton = isActive || isOverdue;

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${isOverdue ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{promise.milestoneTitle}</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Amount: <span className="font-mono font-semibold text-slate-800">₹{promise.amountRupees}</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-medium text-slate-500">Due Date</p>
          <p className="font-semibold text-slate-800">{new Date(promise.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Days Remaining</p>
          <p className={`font-semibold ${promise.daysRemaining < 0 ? "text-red-600" : promise.daysRemaining <= 3 ? "text-amber-600" : "text-slate-800"}`}>
            {promise.daysRemaining < 0 ? `${Math.abs(promise.daysRemaining)} days overdue` : `${promise.daysRemaining} days`}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Requested</p>
          <p className="text-slate-700">{new Date(promise.requestedAt).toLocaleDateString("en-IN")}</p>
        </div>
        {promise.approvedAt && (
          <div>
            <p className="text-xs font-medium text-slate-500">Approved</p>
            <p className="text-slate-700">{new Date(promise.approvedAt).toLocaleDateString("en-IN")}</p>
          </div>
        )}
      </div>

      {isOverdue && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Payment Overdue</p>
          <p className="mt-0.5 text-xs">Your promised payment date has passed. Please complete payment to continue learning.</p>
        </div>
      )}

      {isActive && promise.daysRemaining <= 3 && promise.daysRemaining >= 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Payment Due Soon</p>
          <p className="mt-0.5 text-xs">
            {promise.daysRemaining === 0
              ? "Payment is due today. Access will be suspended if not paid."
              : `Payment is due in ${promise.daysRemaining} day${promise.daysRemaining > 1 ? "s" : ""}. Please pay to avoid suspension.`}
          </p>
        </div>
      )}

      {showPayButton && (
        <div className="mt-4">
          <Link
            href={`/payment?type=course&milestoneId=${promise.milestoneId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500"
          >
            Pay Now — ₹{promise.amountRupees}
          </Link>
        </div>
      )}

      {promise.status === "PROMISED" && (
        <p className="mt-3 text-xs text-slate-500 italic">Waiting for admin approval. You will be notified once approved.</p>
      )}
    </div>
  );
}
