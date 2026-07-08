"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, PageHeader } from "@/components/ui";

interface DashboardData {
  franchiseCode: string;
  centerName: string;
  city: string;
  status: string;
  totalStudents: number;
  totalBatches: number;
  thisMonth: {
    newEnrollments: number;
    revenuePaise: number;
    commissionPaise: number;
  };
  commissionModel: string;
  commissionPercent: number;
  pendingPayoutPaise: number;
}

interface KeyPool {
  courseId: string;
  courseTitle: string;
  totalAllocated: number;
  totalUsed: number;
  available: number;
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function FranchiseDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [pools, setPools] = useState<KeyPool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<DashboardData>("/api/franchise/dashboard"),
      api<{ pools: KeyPool[] }>("/api/franchise/key-pool"),
    ])
      .then(([dashRes, poolRes]) => {
        if (dashRes.success && dashRes.data) setData(dashRes.data);
        if (poolRes.success && poolRes.data?.pools) setPools(poolRes.data.pools);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppPageShell>
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      </AppPageShell>
    );
  }

  if (!data) {
    return (
      <AppPageShell>
        <div className="text-center py-20 text-slate-500">Unable to load dashboard.</div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <PageHeader
        title={`${data.centerName}`}
        subtitle={`${data.city} · Code: ${data.franchiseCode} · Commission: ${data.commissionPercent}%`}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={String(data.totalStudents)} />
        <StatCard label="Total Batches" value={String(data.totalBatches)} />
        <StatCard label="This Month Enrollments" value={String(data.thisMonth.newEnrollments)} />
        <StatCard label="This Month Revenue" value={formatINR(data.thisMonth.revenuePaise)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-medium text-emerald-700">This Month Commission</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{formatINR(data.thisMonth.commissionPaise)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-700">Pending Payout</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{formatINR(data.pendingPayoutPaise)}</p>
        </div>
      </div>

      {/* License Key Availability */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">License Keys Available</h2>
          <Link
            href="/franchise/license-keys"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
          >
            Manage Keys →
          </Link>
        </div>
        {pools.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">No keys allocated yet.</p>
            <Link
              href="/franchise/license-keys"
              className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Request License Keys
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pools.map((p) => (
              <div key={p.courseId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-800 truncate">{p.courseTitle}</p>
                <div className="mt-3 flex items-baseline gap-4">
                  <div>
                    <p className={`text-2xl font-bold ${p.available > 0 ? "text-indigo-700" : "text-red-600"}`}>
                      {p.available}
                    </p>
                    <p className="text-xs text-slate-500">Available</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-600">{p.totalUsed}</p>
                    <p className="text-xs text-slate-500">Used</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-400">{p.totalAllocated}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                </div>
                {p.available === 0 && (
                  <p className="mt-2 text-xs text-red-500 font-medium">⚠ No keys remaining</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
