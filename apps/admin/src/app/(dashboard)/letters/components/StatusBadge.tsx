"use client";

import {
  CheckCircle2, XCircle, Clock, Send, FileText, Ban, UserX, ShieldCheck,
} from "lucide-react";

const STATUS_MAP: Record<string, { icon: typeof Clock; label: string; cls: string }> = {
  ACCEPTED: { icon: CheckCircle2, label: "Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ACTIVE: { icon: ShieldCheck, label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING_ACCEPTANCE: { icon: Clock, label: "Awaiting Intern", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_APPROVAL: { icon: Send, label: "Needs Approval", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  DRAFT: { icon: FileText, label: "Draft", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  REJECTED_BY_INTERN: { icon: UserX, label: "Declined", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  EXPIRED: { icon: Clock, label: "Expired", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  WITHDRAWN: { icon: Ban, label: "Withdrawn", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  REVOKED: { icon: XCircle, label: "Revoked", cls: "bg-red-50 text-red-700 border-red-200" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { icon: FileText, label: status, cls: "bg-slate-50 text-slate-600 border-slate-200" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
