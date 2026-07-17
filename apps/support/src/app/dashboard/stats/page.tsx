"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  MessageCircle, CheckCircle2, Clock, Star, TrendingUp, Users,
} from "lucide-react";

interface ChatAnalytics {
  period: string;
  totalChats: number;
  resolvedChats: number;
  resolutionRate: number;
  avgRating: number;
  ratedCount: number;
  avgResponseSeconds: number;
  avgResolutionMinutes: number;
  chatsPerAgent: { agentId: string; agentName: string; count: number }[];
  peakHours: { hour: number; count: number }[];
}

export default function StatsPage() {
  const [data, setData] = useState<ChatAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");

  useEffect(() => {
    setLoading(true);
    api<ChatAnalytics>(`/api/tickets/chat-analytics?period=${period}`)
      .then((r) => { if (r.success && r.data) setData(r.data); })
      .finally(() => setLoading(false));
  }, [period]);

  function fmtTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">My Stats</h1>
          <p className="text-xs text-slate-500">Live chat performance metrics.</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["today", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${period === p ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {p === "today" ? "Today" : p === "week" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : !data ? (
        <div className="text-center py-20 text-sm text-slate-500">Unable to load stats. You may not have permission.</div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard icon={MessageCircle} label="Total Chats" value={String(data.totalChats)} color="indigo" />
            <MetricCard icon={CheckCircle2} label="Resolved" value={String(data.resolvedChats)} color="emerald" />
            <MetricCard icon={TrendingUp} label="Resolution" value={`${data.resolutionRate}%`} color="teal" />
            <MetricCard icon={Star} label="Avg Rating" value={data.ratedCount > 0 ? `${data.avgRating}/5` : "—"} color="amber" />
            <MetricCard icon={Clock} label="Avg Response" value={fmtTime(data.avgResponseSeconds)} color="blue" />
            <MetricCard icon={Clock} label="Avg Resolution" value={`${data.avgResolutionMinutes}m`} color="purple" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Agent Leaderboard */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <Users className="h-3.5 w-3.5" /> Chats Per Agent
                </p>
              </div>
              {data.chatsPerAgent.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No data for this period</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.chatsPerAgent.map((a, i) => (
                    <div key={a.agentId} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">{i + 1}</span>
                        <span className="text-sm font-medium text-slate-800">{a.agentName}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-700">{a.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Peak Hours */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <Clock className="h-3.5 w-3.5" /> Peak Hours
                </p>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-[2px] h-32">
                  {data.peakHours.map((h) => {
                    const max = Math.max(...data.peakHours.map((x) => x.count), 1);
                    const pct = (h.count / max) * 100;
                    return (
                      <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-indigo-400 transition-all hover:bg-indigo-500"
                          style={{ height: `${Math.max(pct, 3)}%` }}
                          title={`${h.hour}:00 — ${h.count} chats`}
                        />
                        {h.hour % 6 === 0 && <span className="text-[9px] text-slate-400">{h.hour}</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-400">Hour of day (0-23)</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-${color}-50 text-${color}-600`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-800">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
