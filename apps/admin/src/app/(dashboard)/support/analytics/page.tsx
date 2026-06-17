"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { AppPageShell } from "@/components/ui";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { BackLink } from "@/components/ui/BackLink";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["#0d9488","#7c3aed","#d97706","#dc2626","#059669","#6366f1","#f97316","#0ea5e9","#8b5cf6"];

interface Analytics {
  summary: { total: number; open: number; openToday: number; slaBreaches: number; avgResolutionHours: number };
  monthlyTrend: { month: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

export default function SupportAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Analytics>("/api/tickets/analytics").then((r) => {
      if (r.success && r.data) setData(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="spinner" />
    </div>
  );
  if (!data) return <p className="text-slate-600">Failed to load analytics.</p>;

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/support" />
      <BackLink href="/support">Back to Support Desk</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Year-to-date ticket data.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Tickets",   value: data.summary.total,           color: "border-l-teal-500 text-teal-700" },
          { label: "Open",            value: data.summary.open,            color: "border-l-indigo-500 text-indigo-700" },
          { label: "Opened Today",    value: data.summary.openToday,       color: "border-l-violet-500 text-violet-700" },
          { label: "SLA Breaches",    value: data.summary.slaBreaches,     color: "border-l-red-500 text-red-700" },
          { label: "Avg Resolution",  value: `${data.summary.avgResolutionHours}h`, color: "border-l-emerald-500 text-emerald-700" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${c.color.split(" ")[0]}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${c.color.split(" ")[1]}`}>{c.label}</p>
            <p className={`mt-1 text-2xl font-black tabular-nums ${c.color.split(" ")[1]}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly trend */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Monthly Ticket Trends</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} fill="url(#grad)" name="Tickets" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* By Status */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">By Status</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {data.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Tickets"]} />
                <Legend formatter={(v) => String(v).replace(/_/g, " ")} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* By Priority */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">By Priority</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byPriority} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="priority" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.byPriority.map((_, i) => <Cell key={i} fill={["#64748b","#3b82f6","#f59e0b","#ef4444"][i] ?? COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* By Category */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">By Category</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" allowDecimals={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 9 }} stroke="#64748b" width={76}
                  tickFormatter={(v: string) => v.replace(/_/g, " ").slice(0, 12)} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0" }}
                  formatter={(v: number) => [v, "Tickets"]} labelFormatter={(l: string) => l.replace(/_/g, " ")} />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AppPageShell>
  );
}
