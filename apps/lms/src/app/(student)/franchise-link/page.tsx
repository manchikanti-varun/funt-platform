"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";

interface FranchiseStatus {
  linked: boolean;
  franchiseCode?: string;
  centerName?: string;
  city?: string;
}

export default function FranchiseLinkPage() {
  const [status, setStatus] = useState<FranchiseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<FranchiseStatus>("/api/student/franchise/status")
      .then((r) => { if (r.success && r.data) setStatus(r.data); })
      .finally(() => setLoading(false));
  }, []);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!code.trim()) { setError("Enter a franchise code"); return; }
    setSubmitting(true);
    const res = await api<{ centerName: string; city: string }>("/api/student/franchise/link", {
      method: "POST", body: JSON.stringify({ franchiseCode: code.trim() }),
    });
    setSubmitting(false);
    if (res.success && res.data) {
      setSuccess(`Linked to ${res.data.centerName} (${res.data.city})!`);
      setStatus({ linked: true, franchiseCode: code.trim().toUpperCase(), centerName: res.data.centerName, city: res.data.city });
    } else {
      setError(res.message ?? "Failed to link");
    }
  }

  if (loading) return <AppPageShell><div className="flex justify-center py-20"><div className="spinner" /></div></AppPageShell>;

  return (
    <AppPageShell className="max-w-xl pb-8">
      <div className="page-hero">
        <p className="label-overline">Enrollment</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-black">Franchise Center</h1>
        <p className="mt-1 text-sm text-black/60">Link your account to a FUNT franchise center.</p>
      </div>

      {status?.linked ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-semibold text-emerald-800">✓ You are linked to a franchise center</p>
          <div className="mt-3 space-y-1">
            <p className="text-sm text-emerald-700"><span className="font-medium">Center:</span> {status.centerName}</p>
            <p className="text-sm text-emerald-700"><span className="font-medium">City:</span> {status.city}</p>
            <p className="text-sm text-emerald-700"><span className="font-medium">Code:</span> {status.franchiseCode}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-800">Enter your franchise code</p>
          <p className="mt-0.5 text-xs text-slate-500">If you enrolled through a FUNT franchise center, enter the code they gave you.</p>
          <form onSubmit={handleLink} className="mt-4 flex gap-2">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g., JAIPUR-01" className="input flex-1 font-mono uppercase" />
            <button type="submit" disabled={submitting}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              {submitting ? "..." : "Link"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-2 text-sm text-emerald-600 font-medium">{success}</p>}
        </div>
      )}
    </AppPageShell>
  );
}
