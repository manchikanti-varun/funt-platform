"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { AppPageShell } from "@/components/ui";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { BackLink } from "@/components/ui/BackLink";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600", MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-800", URGENT: "bg-red-100 text-red-800",
};

interface SlaDashboard {
  openTotal: number; openToday: number; slaBreachCount: number;
  dueSoonCount: number; avgFirstResponseHours: number;
  breachedTickets: { ticketNumber: string; subject: string; priority: string; status: string; createdAt: string; slaDueAt: string; _id: string }[];
  dueSoonTickets:  { ticketNumber: string; subject: string; priority: string; status: string; createdAt: string; slaDueAt: string; _id: string }[];
}

export default function SlaPage() {
  const [data, setData] = useState<SlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<SlaDashboard>("/api/tickets/sla").then((r) => {
      if (r.success && r.data) setData(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="spinner" />
    </div>
  );
  if (!data) return <p className="text-slate-600">Failed to load SLA data.</p>;

  const TicketTable = ({ tickets, emptyMsg }: { tickets: SlaDashboard["breachedTickets"]; emptyMsg: string }) => (
    tickets.length === 0 ? (
      <div className="flex min-h-[80px] items-center justify-center text-sm text-slate-400">{emptyMsg}</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {["Ticket #","Subject","Priority","Status","Created","SLA Due"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr key={t._id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{t.ticketNumber}</td>
                <td className="px-4 py-3 max-w-[200px]"><p className="truncate text-slate-800">{t.subject}</p></td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{t.status.replace(/_/g," ")}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs font-semibold text-red-600">{new Date(t.slaDueAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Link href={`/support/${t._id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/support" />
      <BackLink href="/support">Back to Support Desk</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SLA Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor response time compliance and breaches.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Open Tickets",   value: data.openTotal,              color: "border-l-indigo-500 text-indigo-700" },
          { label: "Opened Today",   value: data.openToday,              color: "border-l-violet-500 text-violet-700" },
          { label: "SLA Breached",   value: data.slaBreachCount,         color: "border-l-red-500 text-red-700" },
          { label: "Due in 3h",      value: data.dueSoonCount,           color: "border-l-amber-500 text-amber-700" },
          { label: "Avg First Resp", value: `${data.avgFirstResponseHours}h`, color: "border-l-indigo-500 text-indigo-700" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${c.color.split(" ")[0]}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${c.color.split(" ")[1]}`}>{c.label}</p>
            <p className={`mt-1 text-2xl font-black tabular-nums ${c.color.split(" ")[1]}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Breached */}
      <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-100 bg-red-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-red-800">⚠ SLA Breached ({data.slaBreachCount})</h2>
        </div>
        <TicketTable tickets={data.breachedTickets} emptyMsg="No SLA breaches — great!" />
      </div>

      {/* Due soon */}
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-amber-800">⏳ Due in Next 3 Hours ({data.dueSoonCount})</h2>
        </div>
        <TicketTable tickets={data.dueSoonTickets} emptyMsg="No tickets due soon." />
      </div>
    </AppPageShell>
  );
}
