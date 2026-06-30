"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel, PageHeader, Button } from "@/components/ui";

export default function OnboardFranchisePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ franchiseCode: string; ownerUsername: string } | null>(null);

  const [franchiseCode, setFranchiseCode] = useState("");
  const [centerName, setCenterName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("30");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!franchiseCode.trim() || !centerName.trim() || !city.trim() || !ownerName.trim() || !ownerMobile.trim() || !ownerPassword.trim()) {
      setError("Fill all required fields");
      return;
    }

    setSubmitting(true);
    const res = await api<{ franchiseCode: string; ownerUsername: string }>("/api/franchise/admin/centers", {
      method: "POST",
      body: JSON.stringify({
        franchiseCode: franchiseCode.trim().toUpperCase(),
        centerName: centerName.trim(),
        city: city.trim(),
        address: address.trim() || undefined,
        ownerName: ownerName.trim(),
        ownerMobile: ownerMobile.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        ownerPassword: ownerPassword.trim(),
        commissionPercent: Number(commissionPercent),
      }),
    });
    setSubmitting(false);

    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setError(res.message ?? "Failed to create franchise center");
    }
  }

  if (result) {
    return (
      <AppPageShell>
        <PageHeader title="Franchise Onboarded!" backHref="/franchise/centers" backLabel="Back" />
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-lg font-semibold text-emerald-800">✓ Franchise center created successfully</p>
          <div className="mt-4 space-y-2 text-sm text-emerald-700">
            <p><strong>Franchise Code:</strong> {result.franchiseCode}</p>
            <p><strong>Login Username:</strong> {result.ownerUsername}</p>
            <p><strong>Password:</strong> (the one you set)</p>
          </div>
          <p className="mt-4 text-xs text-emerald-600">Share these credentials with the franchise owner so they can log in.</p>
          <Button className="mt-4" variant="primary" onClick={() => router.push("/franchise/centers")}>
            Back to Franchise Centers
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Onboard New Franchise"
        subtitle="Create a new franchise center and its admin account."
        backHref="/franchise/centers"
        backLabel="Back"
      />

      <FormPanel className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Center Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Franchise Code *</label>
              <input type="text" value={franchiseCode} onChange={(e) => setFranchiseCode(e.target.value)} className="input mt-1 w-full" placeholder="e.g., JAIPUR-01" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Center Name *</label>
              <input type="text" value={centerName} onChange={(e) => setCenterName(e.target.value)} className="input mt-1 w-full" placeholder="e.g., Funt Jaipur" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">City *</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input mt-1 w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input mt-1 w-full" />
            </div>
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 pt-4">Owner Account</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Owner Name *</label>
              <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="input mt-1 w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Owner Mobile *</label>
              <input type="tel" value={ownerMobile} onChange={(e) => setOwnerMobile(e.target.value)} className="input mt-1 w-full" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Owner Email</label>
              <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="input mt-1 w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Login Password *</label>
              <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} className="input mt-1 w-full" required minLength={8} />
            </div>
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 pt-4">Commission</h3>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700">Commission Percentage</label>
            <input type="number" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} className="input mt-1 w-full" min={0} max={100} />
            <p className="mt-1 text-xs text-slate-500">Percentage of revenue the franchise keeps.</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Onboard Franchise"}
            </Button>
            <Button variant="secondary" onClick={() => router.push("/franchise/centers")}>
              Cancel
            </Button>
          </div>
        </form>
      </FormPanel>
    </AppPageShell>
  );
}
