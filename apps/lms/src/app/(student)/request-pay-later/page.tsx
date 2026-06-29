"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel } from "@/components/ui";
import { PAYMENT_PROMISE_DEFAULTS } from "@funt-platform/constants";

function RequestPayLaterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchId = searchParams.get("batchId") ?? "";
  const courseId = searchParams.get("courseId") ?? "";
  const milestoneId = searchParams.get("milestoneId") ?? "";
  const milestoneTitle = searchParams.get("title") ?? "Milestone";
  const amount = searchParams.get("amount") ?? "0";

  const [promiseDate, setPromiseDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate max allowed date
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + PAYMENT_PROMISE_DEFAULTS.MAX_PROMISE_DAYS);
  const maxDateStr = maxDate.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!promiseDate) { setError("Please select a payment date"); return; }
    if (!batchId || !courseId || !milestoneId) { setError("Missing course/batch info"); return; }

    setLoading(true);
    setError(null);
    const res = await api("/api/payment-promises/request", {
      method: "POST",
      body: JSON.stringify({ batchId, courseId, milestoneId, promiseDate, reason: reason.trim() || undefined }),
    });
    setLoading(false);

    if (res.success) {
      setSuccess(true);
    } else {
      setError(res.message ?? "Failed to submit request");
    }
  }

  if (success) {
    return (
      <AppPageShell>
        <div className="mx-auto max-w-md">
          <FormPanel>
            <div className="py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">Request Submitted</h2>
              <p className="mt-2 text-sm text-slate-600">
                Your pay-later request for <span className="font-semibold">{milestoneTitle}</span> has been submitted.
                You will be notified once the admin reviews it.
              </p>
              <button
                type="button"
                onClick={() => router.push("/payment-promises")}
                className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                View My Promises
              </button>
            </div>
          </FormPanel>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="mx-auto max-w-md">
        <FormPanel>
          <div className="p-6">
            <h1 className="text-xl font-bold text-slate-900">Request Pay Later</h1>
            <p className="mt-1 text-sm text-slate-600">
              Request temporary access to <span className="font-semibold">{milestoneTitle}</span> with a promise to pay later.
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Amount Due</span>
                <span className="text-lg font-bold text-slate-900">₹{Number(amount) / 100}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  When will you pay? <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  min={today}
                  max={maxDateStr}
                  required
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Maximum {PAYMENT_PROMISE_DEFAULTS.MAX_PROMISE_DAYS} days from today.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g., Salary will be credited on this date"
                  className="input w-full resize-none"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !promiseDate}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? "Submitting…" : "Submit Pay Later Request"}
              </button>

              <p className="text-center text-xs text-slate-500">
                Your request will be reviewed by an admin. Access will be granted temporarily once approved.
                If payment is not received by the due date, access will be automatically suspended.
              </p>
            </form>
          </div>
        </FormPanel>
      </div>
    </AppPageShell>
  );
}

export default function RequestPayLaterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center"><div className="spinner" /></div>}>
      <RequestPayLaterForm />
    </Suspense>
  );
}
