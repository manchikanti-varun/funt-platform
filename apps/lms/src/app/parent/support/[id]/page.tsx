"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-indigo-100 text-indigo-800",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800",
  WAITING_FOR_STUDENT: "bg-amber-100 text-amber-800",
  WAITING_FOR_SUPPORT: "bg-orange-100 text-orange-700",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-600",
  ESCALATED: "bg-red-100 text-red-800",
};

interface TicketMessage { id: string; senderRole: string; message: string; isInternalNote: boolean; createdAt: string }
interface TicketDetail {
  id: string; ticketNumber: string; category: string; subject: string; description: string;
  priority: string; status: string; resolution?: string; resolvedAt?: string; createdAt: string;
  messages: TicketMessage[];
}

export default function ParentTicketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyMsg, setReplyMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const r = await api<TicketDetail>(`/api/tickets/${id}`);
    if (r.success && r.data) setTicket(r.data);
    setLoading(false);
  };
  useEffect(() => { if (id) void load(); }, [id]);

  async function sendReply() {
    if (!replyMsg.trim()) return;
    setSending(true); setError("");
    const res = await api(`/api/tickets/${id}/reply`, {
      method: "POST", body: JSON.stringify({ message: replyMsg, isInternalNote: false }),
    });
    setSending(false);
    if (res.success) { setReplyMsg(""); void load(); }
    else setError(res.message ?? "Failed to send.");
  }

  if (loading) return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
    </div>
  );
  if (!ticket) return (
    <div className="p-6"><Link href="/parent/support" className="text-sm text-indigo-600 hover:underline">← Back</Link><p className="mt-4 text-slate-600">Ticket not found.</p></div>
  );

  const isClosed = ticket.status === "CLOSED";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <Link href="/parent/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to Support
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <p className="font-mono text-xs text-slate-400">{ticket.ticketNumber}</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? "bg-slate-100 text-slate-500"}`}>
              {ticket.status.replace(/_/g," ")}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{ticket.category.replace(/_/g," ")} · {new Date(ticket.createdAt).toLocaleString()}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Description</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{ticket.description}</p>
          </div>
          {ticket.resolution && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Resolution</p>
              <p className="text-sm text-emerald-900">{ticket.resolution}</p>
            </div>
          )}
          {ticket.messages.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversation</p>
              {ticket.messages.map((m) => {
                const isStaff = !["STUDENT","PARENT"].includes(m.senderRole);
                return (
                  <div key={m.id} className={`rounded-xl px-4 py-3 text-sm ${isStaff ? "bg-indigo-50 border border-indigo-100 ml-4" : "bg-slate-50 border border-slate-200 mr-4"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isStaff ? "text-indigo-700" : "text-slate-600"}`}>{isStaff ? "Support Team" : "You"}</span>
                      <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-wrap">{m.message}</p>
                  </div>
                );
              })}
            </div>
          )}
          {!isClosed && (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <textarea value={replyMsg} onChange={(e) => setReplyMsg(e.target.value)} rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-y"
                placeholder="Write a reply…" />
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              <button onClick={() => void sendReply()} disabled={!replyMsg.trim() || sending}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
