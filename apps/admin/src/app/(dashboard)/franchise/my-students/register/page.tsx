"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel, PageHeader, Button } from "@/components/ui";

interface BatchOption {
  id: string;
  name: string;
}

export default function FranchiseRegisterStudentPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [studentName, setStudentName] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const [studentMobile, setStudentMobile] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentAge, setStudentAge] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [batchId, setBatchId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "FREE">("FREE");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    api<{ batches: BatchOption[] }>("/api/franchise/batches")
      .then((r) => {
        if (r.success && r.data?.batches) {
          setBatches(r.data.batches);
          if (r.data.batches.length === 1) setBatchId(r.data.batches[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!studentName.trim() || !studentUsername.trim() || !studentMobile.trim() || !batchId) {
      setError("Fill all required fields");
      return;
    }

    setSubmitting(true);
    const res = await api<{ studentUsername: string }>("/api/franchise/students/register-enroll", {
      method: "POST",
      body: JSON.stringify({
        studentName: studentName.trim(),
        studentUsername: studentUsername.trim(),
        studentMobile: studentMobile.trim(),
        studentEmail: studentEmail.trim() || undefined,
        studentAge: Number(studentAge) || 10,
        studentPassword: studentPassword.trim() || undefined,
        batchId,
        paymentMode,
        amountPaise: paymentMode === "CASH" ? Math.round(Number(amount) * 100) : undefined,
        consumeLicenseKey: true,
      }),
    });
    setSubmitting(false);

    if (res.success) {
      setSuccess(`Student "${studentName}" registered and enrolled successfully! A license key has been assigned.`);
      setStudentName("");
      setStudentUsername("");
      setStudentMobile("");
      setStudentEmail("");
      setStudentAge("");
      setStudentPassword("");
      setAmount("");
    } else {
      setError(res.message ?? "Registration failed");
    }
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Register New Student"
        subtitle="Create a student account and enroll them into a batch."
        backHref="/franchise/my-students"
        backLabel="Back to Students"
      />

      <FormPanel className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Student Name *</label>
              <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="input mt-1 w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Username *</label>
              <input type="text" value={studentUsername} onChange={(e) => setStudentUsername(e.target.value)} className="input mt-1 w-full" required placeholder="e.g., amit.kumar" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Mobile *</label>
              <input type="tel" value={studentMobile} onChange={(e) => setStudentMobile(e.target.value)} className="input mt-1 w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className="input mt-1 w-full" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Age *</label>
              <input type="number" value={studentAge} onChange={(e) => setStudentAge(e.target.value)} className="input mt-1 w-full" min={7} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password (optional)</label>
              <input type="password" value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} className="input mt-1 w-full" placeholder="Leave blank for passwordless" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Enroll in Batch *</label>
            {loading ? (
              <div className="mt-2"><div className="spinner" /></div>
            ) : (
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input mt-1 w-full" required>
                <option value="">Select a batch...</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "CASH" | "FREE")} className="input mt-1 w-full">
                <option value="FREE">Free / No payment</option>
                <option value="CASH">Cash Collected</option>
              </select>
            </div>
            {paymentMode === "CASH" && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Amount (₹)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input mt-1 w-full" min={0} step="0.01" placeholder="e.g., 5000" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Registering…" : "Register & Enroll"}
            </Button>
            <Button variant="secondary" onClick={() => router.push("/franchise/my-students")}>
              Cancel
            </Button>
          </div>
        </form>
      </FormPanel>
    </AppPageShell>
  );
}
