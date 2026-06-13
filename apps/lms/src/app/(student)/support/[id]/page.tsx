"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-indigo-100 text-indigo-800", ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800", WAITING_FOR_STUDENT: "bg-amber-100 text-amber-800",
  WAITING_FOR_SUPPORT: "bg-orange-100 text-orange-800", RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-600", ESCALATED: "bg-red-100 text-red-800",
};

interface TicketMessage { id: string; senderRole: string; message: string; isInternalNote: boolean; createdAt: string }
interface TicketDetail {
  id: string; ticketNumber: string; category: string; subject: string; description: string;
  priority: string; status: string; resolution?: string; resolvedAt?: string; closedAt?: string;
  attachments: string[]; createdAt: string; messages: TicketMessage[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy ticket number"
      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
    >
      {copied ? (
        <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Copied!</>
      ) : (
        <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy ID</>
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
    <AppPageShell className="max-w-3xl pb-8">
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-indigo-600" />
      </div>
    </AppPageShell>
  );

  if (!ticket) return (
    <AppPageShell className="max-w-3xl pb-8">
      <Link href="/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/60 hover:text-black">← Back to Support</Link>
      <p className="mt-4 text-black/60">Ticket not found.</p>
    </AppPageShell>
  );

  const isClosed = ticket.status === "CLOSED";
  const isResolved = ticket.status === "RESOLVED";

  return (
    <AppPageShell className="max-w-3xl pb-8">
      <Link href="/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/60 hover:text-black">← Back to Support</Link>

      {/* ── Prominent ticket number banner ─────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-5 py-3.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500">Your Ticket Number</p>
          <p className="mt-0.5 font-mono text-2xl font-black text-indigo-700">{ticket.ticketNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={ticket.ticketNumber} />
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? "bg-slate-100 text-slate-500"}`}>
            {ticket.status.replace(/_/g," ")}
          </span>
        </div>
      </div>
      <p className="mt-1.5 px-1 text-xs text-black/40">
        Share this number with management or trainers when asking about your ticket status.
      </p>

      <DataPanel className="border-2 border-black/10 shadow-sm mt-3">
        {/* Header */}
        <div className="border-b border-black/10 pb-4 mb-4">
          <h1 className="text-xl font-black text-black">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-black/50">{ticket.category.replace(/_/g," ")} · {ticket.priority} · {new Date(ticket.createdAt).toLocaleString()}</p>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-1.5">Your Issue</p>
          <p className="text-sm text-black/80 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Resolution */}
        {ticket.resolution && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">Resolution</p>
            <p className="text-sm text-emerald-900">{ticket.resolution}</p>
            {ticket.resolvedAt && <p className="mt-1 text-xs text-emerald-600">Resolved {new Date(ticket.resolvedAt).toLocaleString()}</p>}
          </div>
        )}

        {/* Messages */}
        {ticket.messages.length > 0 && (
          <div className="mb-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-black/40">Conversation</p>
            {ticket.messages.map((m) => {
              const isStaff = !["STUDENT","PARENT"].includes(m.senderRole);
              return (
                <div key={m.id} className={`rounded-xl px-4 py-3 text-sm ${isStaff ? "bg-indigo-50 border border-indigo-100 ml-4" : "bg-slate-50 border border-black/10 mr-4"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold ${isStaff ? "text-indigo-700" : "text-black/60"}`}>
                      {isStaff ? "Support Team" : "You"}
                    </span>
                    <span className="text-xs text-black/40">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-black/80 whitespace-pre-wrap">{m.message}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply */}
        {!isClosed && (
          <div className="border-t border-black/10 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-black/40">Reply</p>
            <textarea value={replyMsg} onChange={(e) => setReplyMsg(e.target.value)} rows={4}
              className="w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2.5 text-sm placeholder-black/30 focus:border-indigo-500 focus:outline-none resize-y"
              placeholder="Write your reply…" />
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void sendReply()} disabled={!replyMsg.trim() || sending}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50">
                {sending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>Sending…</> : "Send Reply"}
              </button>
              {isResolved && (
                <button onClick={() => void closeTicket()} disabled={closing}
                  className="rounded-xl border-2 border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black/70 hover:bg-slate-50 disabled:opacity-50">
                  {closing ? "Closing…" : "Close Ticket"}
                </button>
              )}
            </div>
          </div>
        )}
        {isClosed && (
          <p className="border-t border-black/10 pt-4 text-sm text-black/50">This ticket is closed.</p>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
