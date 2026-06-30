"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel, PageHeader, Button, useAppDialog } from "@/components/ui";

interface BatchOption { id: string; name: string }

export default function FranchisePaymentsPage() {
  const dialog = useAppDialog();
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    api<{ batches: BatchOption[] }>("/api/franchise/batches")
      .then((r) => { if (r.success && r.data?.batches) setBatches(r.data.batches); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!batchId) { setError("Select a batch"); return; }
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount"); return; }

    setSubmitting(true);
    const res = await api("/api/franchise/payments/offline", {
      method: "POST",
      body: JSON.stringify({
        batchId,
        studentId: studentId.trim() || undefined,
        amountPaise: Math.round(Number(amount) * 100),
        note: note.trim() || "Offline payment collected",
      }),
    });
    setSubmitting(false);

    if (res.success) {
      await dialog.alert({ title: "Payment Recorded", message: "Offline payment has been recorded successfully." });
      setStudentId("");
      setAmount("");
      setNote("");
    } else {
      setError(res.message ?? "Failed to record payment");
    }
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Record Offline Payment"
        subtitle="Record cash payments collected from students."
      />

      <FormPanel className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Batch *</label>
              {loading ? (
                <div className="mt-2"><div className="spinner" /></div>
              ) : (
                <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input mt-1 w-full" required>
                  <option value="">Select batch...</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Student ID / Username (optional)</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="input mt-1 w-full"
                placeholder="Student Mongo ID or username"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Amount (₹) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input mt-1 w-full"
                min={1}
                step="0.01"
                placeholder="e.g., 5000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input mt-1 w-full"
                placeholder="e.g., Cash collected from Amit"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Recording…" : "Record Payment"}
          </Button>
        </form>
      </FormPanel>
    </AppPageShell>
  );
}
