"use client";

import { FileText, Clock, CheckCircle2, Send, Award } from "lucide-react";

interface LetterStats {
  total: number;
  draft: number;
  pendingApproval: number;
  pendingAcceptance: number;
  accepted: number;
  experience: number;
}

export function LetterStatsBar({ stats }: { stats: LetterStats }) {
  const metrics = [
    { label: "Total Letters", value: stats.total, icon: FileText, color: "border-l-indigo-500", iconCls: "text-indigo-600 bg-indigo-50" },
    { label: "Drafts", value: stats.draft, icon: Clock, color: "border-l-slate-400", iconCls: "text-slate-500 bg-slate-50" },
    { label: "Needs Approval", value: stats.pendingApproval, icon: Send, color: "border-l-blue-500", iconCls: "text-blue-600 bg-blue-50" },
    { label: "Awaiting Intern", value: stats.pendingAcceptance, icon: Clock, color: "border-l-amber-500", iconCls: "text-amber-600 bg-amber-50" },
    { label: "Active / Accepted", value: stats.accepted, icon: CheckCircle2, color: "border-l-emerald-500", iconCls: "text-emerald-600 bg-emerald-50" },
    { label: "Experience Issued", value: stats.experience, icon: Award, color: "border-l-purple-500", iconCls: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className={`card-metric ${m.color}`}>
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${m.iconCls}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="card-metric__label text-slate-500">{m.label}</span>
            </div>
            <p className="card-metric__value text-slate-900">{m.value}</p>
          </div>
        );
      })}
    </div>
  );
}
