"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageHeader } from "@/components/ui";

interface FranchiseCenter {
  id: string;
  franchiseCode: string;
  centerName: string;
  city: string;
  commissionPercent: number;
  pendingPayoutPaise: number;
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function FranchisePayoutsPage() {
  const [centers, setCenters] = useState<FranchiseCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    api<{ centers: FranchiseCenter[] }>("/api/franchise/admin/centers")
      .then((r) => { if (r.success && r.data?.centers) setCenters(r.data.centers); })
      .finally(() => setLoading(false));
  }, []);

  async function markPaid(centerId: string) {
    const center = centers.find((c) => c.id === centerId);
    if (!center || center.pendingPayoutPaise <= 0) return;

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    setPaying(centerId);
    const res = await api(`/api/franchise/admin/centers/${centerId}/payouts`, {
      method: "POST",
      body: JSON.stringify({
        month,
        amountPaise: center.pendingPayoutPaise,
        paymentReference: `Manual payout ${month}`,
      }),
    });
    setPaying(null);

    if (res.success) {
      setCenters((prev) => prev.map((c) => c.id === centerId ? { ...c, pendingPayoutPaise: 0 } : c));
    }
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Franchise Payouts"
        subtitle="Track and process payouts to franchise centers."
      />

      <DataPanel className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : centers.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No franchise centers.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Center</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">City</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Commission</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Pending Payout</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {centers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">
                      {c.centerName}
                      <span className="ml-2 font-mono text-xs text-slate-400">{c.franchiseCode}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{c.city}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{c.commissionPercent}%</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-amber-700">
                      {c.pendingPayoutPaise > 0 ? formatINR(c.pendingPayoutPaise) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {c.pendingPayoutPaise > 0 ? (
                        <button
                          onClick={() => markPaid(c.id)}
                          disabled={paying === c.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {paying === c.id ? "Processing…" : "Mark Paid"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
