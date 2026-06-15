"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: string }> = {
  OPEN:                 { label: "Open",               color: "bg-indigo-100 text-indigo-700",  dot: "bg-indigo-500",  icon: "🔵" },
  ASSIGNED:             { label: "Assigned",            color: "bg-blue-100 text-blue-700",     dot: "bg-blue-500",    icon: "👤" },
  IN_PROGRESS:          { label: "In Progress",         color: "bg-cyan-100 text-cyan-700",     dot: "bg-cyan-500",    icon: "⚙️" },
  WAITING_FOR_STUDENT:  { label: "Awaiting Your Reply", color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500",   icon: "⏳" },
  WAITING_FOR_SUPPORT:  { label: "Awaiting Support",    color: "bg-orange-100 text-orange-700", dot: "bg-orange-500",  icon: "💬" },
  RESOLVED:             { label: "Resolved",            color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: "✅" },
  CLOSED:               { label: "Closed",              color: "bg-slate-100 text-slate-500",   dot: "bg-slate-400",   icon: "🔒" },
  ESCALATED:            { label: "Escalated",           color: "bg-red-100 text-red-700",       dot: "bg-red-500",     icon: "🚨" },
};

const PRIORITY_CONFIG: Record<string, { color: string; dot: string }> = {
  LOW:    { color: "text-slate-500",  dot: "bg-slate-400" },
  MEDIUM: { color: "text-blue-600",   dot: "bg-blue-500" },
  HIGH:   { color: "text-amber-600",  dot: "bg-amber-500" },
  URGENT: { color: "text-red-600",    dot: "bg-red-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL_QUERY: "General Query", COURSE_ACCESS: "Course Access",
  ASSIGNMENT: "Assignment", ATTENDANCE: "Attendance",
  CERTIFICATE: "Certificate", PAYMENT: "Payment",
  ENROLLMENT: "Enrollment", SHOP_ORDER: "Shop Order",
  TECHNICAL_ISSUE: "Technical Issue", BUG_REPORT: "Bug Report",
  FEATURE_REQUEST: "Feature Request",
};

interface TicketMessage {
  id: string; senderRole: string; senderName?: string; senderUsername?: string;
  message: string; isInternalNote: boolean; createdAt: string;
}
interface TicketDetail {
  id: string; ticketNumber: string; category: string; subject: string; description: string;
  priority: string; status: string; resolution?: string; resolvedAt?: string; closedAt?: string;
  attachments: string[]; createdAt: string; messages: TicketMessage[];
}

function CopyButton({ text, label = "Copy ID" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 active:scale-95"
    >
      {copied ? (
        <><svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Copied!</>
      ) : (
        <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>{label}</>
      )}
    </button>
  );
}

export default function StudentTicketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyMsg, setReplyMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const r = await api<TicketDetail>(`/api/tickets/${id}`);
    if (r.success && r.data) setTicket(r.data);
    setLoading(false);
  };

  useEffect(() => { if (id) void load(); }, [id]);

  async function sendReply() {
    if (!replyMsg.trim()) return;
    setSending(true); setError("");
    const res = await api(`/api/tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: replyMsg, isInternalNote: false }),
    });
    setSending(false);
    if (res.success) { setReplyMsg(""); void load(); }
    else setError(res.message ?? "Failed to send reply.");
  }

  async function closeTicket() {
    setClosing(true); setError("");
    const res = await api(`/api/tickets/${id}/close`, { method: "PATCH", body: JSON.stringify({}) });
    setClosing(false);
    if (res.success) void load();
    else setError(res.message ?? "Failed to close ticket.");
  }

  if (loading) return (
    <AppPageShell className="max-w-2xl pb-8">
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    </AppPageShell>
  );

  if (!ticket) return (
    <AppPageShell className="max-w-2xl pb-8">
      <Link href="/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        Back to Support
      </Link>
      <p className="mt-6 text-slate-500">Ticket not found.</p>
    </AppPageShell>
  );

  const statusCfg = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, color: "bg-slate-100 text-slate-500", dot: "bg-slate-400", icon: "•" };
  const priorityCfg = PRIORITY_CONFIG[ticket.priority] ?? { color: "text-slate-500", dot: "bg-slate-400" };
  const isClosed = ticket.status === "CLOSED";
  const isResolved = ticket.status === "RESOLVED";
  const isWaitingForStudent = ticket.status === "WAITING_FOR_STUDENT";

  return (
    <AppPageShell className="max-w-2xl pb-10">
      {/* Back link */}
      <Link href="/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        Back to Support
      </Link>

      {/* ── Ticket ID + status bar ─────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="label-overline text-indigo-500">Your Ticket Number</p>
            <p className="mt-0.5 font-mono text-2xl font-black tracking-tight text-indigo-700">{ticket.ticketNumber}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={ticket.ticketNumber} />
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusCfg.color}`}>
              <span>{statusCfg.icon}</span>
              {statusCfg.label}
            </span>
          </div>
        </div>
        {isWaitingForStudent && (
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-2.5">
            <p className="text-xs font-semibold text-amber-700">
              ⏳ The support team is waiting for your reply. Please respond below.
            </p>
          </div>
        )}
      </div>

      {/* ── Ticket details card ────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <h1 className="text-xl font-black tracking-tight text-slate-900">{ticket.subject}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium">
              {CATEGORY_LABELS[ticket.category] ?? ticket.category.replace(/_/g," ")}
            </span>
            <span className={`inline-flex items-center gap-1 font-semibold ${priorityCfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${priorityCfg.dot}`} />
              {ticket.priority}
            </span>
            <span>·</span>
            <span>{new Date(ticket.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-5">
          <p className="label-overline mb-2">Your Issue</p>
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
          {ticket.attachments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ticket.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  📎 Attachment {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Resolution */}
        {ticket.resolution && (
          <div className="border-t border-emerald-100 bg-emerald-50/70 px-6 py-4">
            <p className="label-overline mb-1 text-emerald-700">Resolution</p>
            <p className="text-sm leading-relaxed text-emerald-900">{ticket.resolution}</p>
            {ticket.resolvedAt && (
              <p className="mt-1.5 text-xs text-emerald-600">
                ✅ Resolved on {new Date(ticket.resolvedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Conversation */}
        {ticket.messages.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <p className="label-overline">Conversation</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{ticket.messages.length}</span>
            </div>
            <div className="space-y-4">
              {ticket.messages.map((m) => {
                const isStaff = !["STUDENT","PARENT"].includes(m.senderRole);
                const displayName = isStaff
                  ? (m.senderName || m.senderRole.replace(/_/g," "))
                  : "You";
                const initials = displayName.charAt(0).toUpperCase();
                return (
                  <div key={m.id} className={`flex gap-3 ${isStaff ? "" : "flex-row-reverse"}`}>
                    {/* Avatar */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isStaff ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {initials}
                    </div>
                    {/* Bubble */}
                    <div className={`max-w-[80%] space-y-1 ${isStaff ? "" : "items-end"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-semibold ${isStaff ? "text-indigo-700" : "text-slate-600"}`}>
                          {displayName}
                        </span>
                        {isStaff && m.senderUsername && (
                          <span className="text-[11px] text-slate-400">@{m.senderUsername}</span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {new Date(m.createdAt).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isStaff
                          ? "rounded-tl-sm bg-indigo-50 text-slate-800 border border-indigo-100"
                          : "rounded-tr-sm bg-slate-100 text-slate-800"
                      }`}>
                        <p className="whitespace-pre-wrap">{m.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reply box */}
        {!isClosed ? (
          <div className="border-t border-slate-100 bg-slate-50/40 px-6 py-5 space-y-3">
            <p className="label-overline">Send a Reply</p>
            <textarea
              value={replyMsg}
              onChange={(e) => setReplyMsg(e.target.value)}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && replyMsg.trim()) {
                  void sendReply();
                }
              }}
              className="input resize-none"
              placeholder="Write your message… (Ctrl+Enter to send)"
            />
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void sendReply()}
                disabled={!replyMsg.trim() || sending}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {sending ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Sending…</>
                ) : (
                  <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>Send Reply</>
                )}
              </button>
              {isResolved && (
                <button
                  onClick={() => void closeTicket()}
                  disabled={closing}
                  className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
                >
                  {closing ? "Closing…" : "✓ Mark as Closed"}
                </button>
              )}
              <span className="text-xs text-slate-400">Ctrl+Enter to send</span>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-100 bg-slate-50/40 px-6 py-4">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <span className="text-base">🔒</span>
              This ticket is closed. <Link href="/support" className="font-semibold text-indigo-600 hover:underline">Open a new ticket</Link> if you need further help.
            </p>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
