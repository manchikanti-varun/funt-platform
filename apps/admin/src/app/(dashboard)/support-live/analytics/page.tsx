"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, PageHeader } from "@/components/ui";

interface AgentStat { agentId: string; agentName: string; count: number; }
interface HourStat { hour: number; count: number; }

interface AnalyticsData {
  period: string;
  totalChats: number;
  resolvedChats: number;
  resolutionRate: number;
  avgRating: number;
  ratedCount: number;
  avgResponseSeconds: number;
  avgResolutionMinutes: number;
  chatsPerAgent: AgentStat[];
  peakHours: HourStat[];
}

export default function ChatAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");

  useEffect(() => {
    setLoading(true);
    api<AnalyticsData>(`/api/tickets/chat-analytics?period=${period}`)
      .then((r) => { if (r.success && r.data) setData(r.data); })
      .finally(() => setLoading(false));
  }, [period]);

  function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  }

  return (
    <AppPageShell>
      <div className="flex items-center justify-between">
        <PageHeader title="Chat Analytics" subtitle="Live support performance metrics" />
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(["today", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                period === p ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}>
              {p === "today" ? "Today" : p === "week" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-500">Unable to load analytics</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total Chats" value={String(data.totalChats)} />
            <StatCard label="Resolved" value={String(data.resolvedChats)} />
            <StatCard label="Resolution Rate" value={`${data.resolutionRate}%`} />
            <StatCard label="Avg Rating" value={data.ratedCount > 0 ? `${data.avgRating}/5` : "—"} />
            <StatCard label="Avg Response" value={formatTime(data.avgResponseSeconds)} />
            <StatCard label="Avg Resolution" value={`${data.avgResolutionMinutes}m`} />
          </div>

          {/* Agent Leaderboard */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Chats Per Agent</p>
              </div>
              {data.chatsPerAgent.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-400">No data</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.chatsPerAgent.map((a, i) => (
                    <div key={a.agentId} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{a.agentName}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{a.count} chats</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Peak Hours */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Peak Hours</p>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-1 h-32">
                  {data.peakHours.map((h) => {
                    const max = Math.max(...data.peakHours.map((x) => x.count), 1);
                    const pct = (h.count / max) * 100;
                    return (
                      <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-indigo-400 transition-all"
                          style={{ height: `${Math.max(pct, 2)}%` }}
                          title={`${h.hour}:00 — ${h.count} chats`} />
                        {h.hour % 4 === 0 && (
                          <span className="text-[9px] text-slate-400">{h.hour}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-slate-400 text-center">Hour of day (0-23)</p>
              </div>
            </div>
          </div>
        </>
      )}
    </AppPageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
