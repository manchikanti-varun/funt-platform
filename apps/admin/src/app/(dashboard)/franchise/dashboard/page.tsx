"use client";

import { useEffect, useState } from "react";
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

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function FranchiseDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DashboardData>("/api/franchise/dashboard")
      .then((r) => { if (r.success && r.data) setData(r.data); })
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
