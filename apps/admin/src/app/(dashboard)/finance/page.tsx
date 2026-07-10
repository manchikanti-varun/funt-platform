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
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [batchId, setBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filterMonth && filterYear) {
      // Month/year convenience filter overrides date range
      const m = parseInt(filterMonth, 10);
      const y = parseInt(filterYear, 10);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      p.set("fromDate", start);
      p.set("toDate", end);
    } else {
      if (fromDate) p.set("fromDate", fromDate);
      if (toDate) p.set("toDate", toDate);
    }
    if (batchId.trim()) p.set("batchId", batchId.trim());
    if (courseId.trim()) p.set("courseId", courseId.trim());
    if (couponCode.trim()) p.set("couponCode", couponCode.trim().toUpperCase());
    return p.toString();
  }, [fromDate, toDate, filterMonth, filterYear, batchId, courseId, couponCode]);

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
        <Link href="/payments" className="nav-pills">
          Payment approvals
        </Link>
        <Link href="/finance" className="nav-pills nav-pills--active">
          Finance dashboard
        </Link>
        <Link href="/payment-qr" className="nav-pills">
          UPI QR center
        </Link>
        <Link href="/coupons" className="nav-pills">
          Coupons
        </Link>
      </div>

      <PageSection>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="input text-sm">
            <option value="">Month</option>
            {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
              <option key={i + 1} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="input text-sm">
            <option value="">Year</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input text-sm" placeholder="Start date" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input text-sm" placeholder="End date" />
          <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Filter by batchId" className="input text-sm" />
          <input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="Filter by courseId" className="input text-sm" />
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Filter by coupon code" className="input text-sm" />
        </div>
        {filterMonth && filterYear && (
          <p className="mt-2 text-xs text-slate-500">
            Showing data for {["","January","February","March","April","May","June","July","August","September","October","November","December"][parseInt(filterMonth, 10)]} {filterYear}
          </p>
        )}
      </PageSection>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="spinner" />
        </div>
      ) : error ? (
        <p className="alert--error">{error}</p>
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
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Conversion</p><p className="text-xl font-bold text-indigo-700">{data.funnel.conversionRatePercent}%</p></div>
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
