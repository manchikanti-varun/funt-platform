"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, apiUrl } from "@/lib/api";
import { AppPageShell, DataPanel, PageSection } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

interface FinanceSummary {
  rangeDays: number;
  filters?: { fromDate?: string; toDate?: string; batchId?: string; courseId?: string; couponCode?: string };
  revenue: {
    verifiedRevenuePaise: number;
    verifiedRevenueRupees: number;
    verifiedCount: number;
  };
  funnel: {
    totalAttempts: number;
    pendingCount: number;
    rejectedCount: number;
    verifiedCount: number;
    conversionRatePercent: number;
  };
  failedReasons: Array<{ reason: string; count: number }>;
  topCoupons: Array<{ couponCode: string; redemptions: number }>;
  topBatches: Array<{ _id: string; name: string; count: number; revenuePaise: number }>;
  topCourses: Array<{ _id: string; name: string; count: number; revenuePaise: number }>;
}

export default function FinanceDashboardPage() {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [batchId, setBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("fromDate", fromDate);
    if (toDate) p.set("toDate", toDate);
    if (batchId.trim()) p.set("batchId", batchId.trim());
    if (courseId.trim()) p.set("courseId", courseId.trim());
    if (couponCode.trim()) p.set("couponCode", couponCode.trim().toUpperCase());
    return p.toString();
  }, [fromDate, toDate, batchId, courseId, couponCode]);

  useEffect(() => {
    setLoading(true);
    setError("");
    api<FinanceSummary>(`/api/admin/payments/finance${qs ? `?${qs}` : ""}`)
      .then((r) => {
        if (r.success && r.data) setData(r.data);
        else setError(r.message ?? "Failed to load finance dashboard");
      })
      .catch(() => setError("Failed to load finance dashboard"))
      .finally(() => setLoading(false));
  }, [qs]);

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <PageHeader
        title="Finance dashboard"
        subtitle="Revenue visibility by batch/course/coupon, conversion funnel, failed reasons, and CSV export."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/payments" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          Payment approvals
        </Link>
        <Link href="/finance" className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">
          Finance dashboard
        </Link>
        <Link href="/payment-qr" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          UPI QR center
        </Link>
        <Link href="/coupons" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          Coupons
        </Link>
      </div>

      <PageSection>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Filter by batchId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="Filter by courseId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Filter by coupon code" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </PageSection>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
      ) : data ? (
        <>
          <div className="flex justify-end">
            <a
              href={apiUrl(`/api/admin/payments/finance?format=csv${qs ? `&${qs}` : ""}`)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Revenue</p><p className="text-xl font-bold text-slate-900">Rs {data.revenue.verifiedRevenueRupees.toFixed(2)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Attempts</p><p className="text-xl font-bold text-slate-900">{data.funnel.totalAttempts}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Verified</p><p className="text-xl font-bold text-emerald-700">{data.funnel.verifiedCount}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Rejected</p><p className="text-xl font-bold text-rose-700">{data.funnel.rejectedCount}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Conversion</p><p className="text-xl font-bold text-teal-700">{data.funnel.conversionRatePercent}%</p></div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DataPanel className="p-4">
              <p className="text-sm font-semibold text-slate-900">Failed payment reasons</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {data.failedReasons.length ? data.failedReasons.map((r) => <li key={r.reason}>- {r.reason} ({r.count})</li>) : <li className="text-slate-500">No rejected reasons in range.</li>}
              </ul>
            </DataPanel>
            <DataPanel className="p-4">
              <p className="text-sm font-semibold text-slate-900">Top coupons</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {data.topCoupons.length ? data.topCoupons.map((c) => <li key={c.couponCode}>- {c.couponCode}: {c.redemptions} redemptions</li>) : <li className="text-slate-500">No coupon redemptions in range.</li>}
              </ul>
            </DataPanel>
            <DataPanel className="p-4">
              <p className="text-sm font-semibold text-slate-900">Top batches (by revenue)</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {data.topBatches.length ? data.topBatches.map((b) => <li key={b._id}>- {b.name}: Rs {(b.revenuePaise / 100).toFixed(2)} ({b.count} payments)</li>) : <li className="text-slate-500">No batch revenue data.</li>}
              </ul>
            </DataPanel>
            <DataPanel className="p-4">
              <p className="text-sm font-semibold text-slate-900">Top courses (by revenue)</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {data.topCourses.length ? data.topCourses.map((c) => <li key={c._id}>- {c.name}: Rs {(c.revenuePaise / 100).toFixed(2)} ({c.count} payments)</li>) : <li className="text-slate-500">No course revenue data.</li>}
              </ul>
            </DataPanel>
          </div>
        </>
      ) : null}
    </AppPageShell>
  );
}
