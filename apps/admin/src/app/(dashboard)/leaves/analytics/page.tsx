"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { BackLink } from "@/components/ui/BackLink";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["#0d9488", "#7c3aed", "#d97706", "#dc2626", "#059669", "#6366f1", "#f97316"];

interface Analytics {
  summary: { total: number; approved: number; rejected: number; pending: number };
  monthlyTrend: { month: string; applied: number; approved: number; rejected: number }[];
  leaveTypeDistribution: { type: string; count: number }[];
  approvalRate: number;
  teamAvailability: {
    trainers: { total: number; onLeave: number; available: number };
    admins: { total: number; onLeave: number; available: number };
  };
}

export default function LeaveAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Analytics>("/api/leaves/analytics").then((r) => {
      if (r.success && r.data) setData(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  if (!data) return <p className="text-slate-600">Failed to load analytics.</p>;

  const statusPieData = [
    { name: "Approved", value: data.summary.approved, color: "#059669" },
    { name: "Pending",  value: data.summary.pending,  color: "#d97706" },
    { name: "Rejected", value: data.summary.rejected, color: "#dc2626" },
  ].filter((d) => d.value > 0);

  return (
    <div className="w-full space-y-8">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <BackLink href="/leaves">Back to Leave Management</BackLink>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leave Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Year-to-date leave data and team availability.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Requests", value: data.summary.total, color: "border-l-teal-500 text-teal-700" },
          { label: "Approved", value: data.summary.approved, color: "border-l-emerald-500 text-emerald-700" },
          { label: "Pending",  value: data.summary.pending,  color: "border-l-amber-500 text-amber-700" },
          { label: "Rejected", value: data.summary.rejected, color: "border-l-red-500 text-red-700" },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${card.color.split(" ")[0]}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${card.color.split(" ")[1]}`}>{card.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${card.color.split(" ")[1]}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Approval rate + Team availability */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Approval Rate</h2>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black text-teal-700">{data.approvalRate}%</span>
            <span className="mb-1 text-sm text-slate-500">approved</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${data.approvalRate}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Team Availability (Today)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Trainers", data: data.teamAvailability.trainers, color: "text-indigo-700 bg-indigo-50" },
              { label: "Admins",   data: data.teamAvailability.admins,   color: "text-teal-700 bg-teal-50" },
            ].map((team) => (
              <div key={team.label} className={`rounded-xl p-4 ${team.color.split(" ")[1]}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${team.color.split(" ")[0]}`}>{team.label}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-slate-700">Total: <strong>{team.data.total}</strong></p>
                  <p className="text-red-600">On Leave: <strong>{team.data.onLeave}</strong></p>
                  <p className="text-emerald-700">Available: <strong>{team.data.available}</strong></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Monthly Leave Trends</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="applied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="approved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
              <Legend />
              <Area type="monotone" dataKey="applied" stroke="#0d9488" strokeWidth={2} fill="url(#applied)" name="Applied" />
              <Area type="monotone" dataKey="approved" stroke="#059669" strokeWidth={2} fill="url(#approved)" name="Approved" />
              <Bar dataKey="rejected" fill="#dc2626" name="Rejected" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leave type distribution */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Leave Type Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.leaveTypeDistribution} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {data.leaveTypeDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Requests"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Status distribution */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Status Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusPieData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
