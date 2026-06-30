"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageHeader } from "@/components/ui";

interface Transaction {
  _id: string;
  type: string;
  amountPaise: number;
  direction: string;
  note: string;
  month: string;
  createdAt: string;
}

interface EarningsData {
  totalCollectedPaise: number;
  totalCommissionPaise: number;
  totalPayoutsPaise: number;
  pendingPayoutPaise: number;
  transactions: Transaction[];
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function FranchiseEarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  useEffect(() => {
    setLoading(true);
    const url = month ? `/api/franchise/earnings?month=${month}` : "/api/franchise/earnings";
    api<EarningsData>(url)
      .then((r) => { if (r.success && r.data) setData(r.data); })
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <AppPageShell>
      <PageHeader
        title="Earnings"
        subtitle="Track your collections, commission, and payouts."
      />

      <div className="mt-6 flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Filter by month:</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input"
        />
        {month && (
          <button onClick={() => setMonth("")} className="text-sm text-indigo-600 hover:underline">
            Show all
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : !data ? (
        <div className="mt-6 text-center text-slate-500">Unable to load earnings.</div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Collected</p>
              <p className="mt-2 text-xl font-bold text-slate-800">{formatINR(data.totalCollectedPaise)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Commission Earned</p>
              <p className="mt-2 text-xl font-bold text-emerald-800">{formatINR(data.totalCommissionPaise)}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Paid Out</p>
              <p className="mt-2 text-xl font-bold text-blue-800">{formatINR(data.totalPayoutsPaise)}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Pending Payout</p>
              <p className="mt-2 text-xl font-bold text-amber-800">{formatINR(data.pendingPayoutPaise)}</p>
            </div>
          </div>

          <DataPanel className="mt-6">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm font-semibold text-slate-700">Transactions</p>
            </div>
            {data.transactions.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">No transactions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Note</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.transactions.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {t.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{t.note || "—"}</td>
                        <td className={`px-5 py-3 text-right text-sm font-medium ${t.direction === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>
                          {t.direction === "CREDIT" ? "+" : "-"}{formatINR(t.amountPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>
        </>
      )}
    </AppPageShell>
  );
}
