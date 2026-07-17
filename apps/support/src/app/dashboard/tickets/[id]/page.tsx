"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ArrowLeft, Send, Clock, CheckCircle2, AlertTriangle,
  MessageCircle, Lock, User,
} from "lucide-react";

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600", MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-800", URGENT: "bg-red-50 text-red-700",
};
const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-indigo-50 text-indigo-700", ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-cyan-50 text-cyan-700", WAITING_FOR_STUDENT: "bg-amber-50 text-amber-700",
  WAITING_FOR_SUPPORT: "bg-orange-50 text-orange-700", RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500", ESCALATED: "bg-red-50 text-red-700",
};

interface TicketMessage {
  id: string; senderId: string; senderName?: string; senderUsername?: string;
  senderRole: string; message: string; isInternalNote: boolean; createdAt: string;
}
interface TicketDetail {
  id: string; ticketNumber: string; createdByName: string; createdByUsername: string;
  createdByRole: string; category: string; priority: string; subject: string;
  description: string; status: string; assignedToName?: string; resolution?: string;
  resolvedAt?: string; slaBreached?: boolean; createdAt: string; messages: TicketMessage[];
}

const STATUSES = ["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_STUDENT","WAITING_FOR_SUPPORT","RESOLVED","CLOSED","ESCALATED"];

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyMsg, setReplyMsg] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    const r = await api<TicketDetail>(`/api/tickets/${id}`);
    if (r.success && r.data) setTicket(r.data);
    setLoading(false);
  }

  useEffect(() => { if (id) load(); }, [id]);

  async function sendReply() {
    if (!replyMsg.trim()) return;
    setSending(true); setError("");
    const r = await api(`/api/tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: replyMsg, isInternalNote: isInternal }),
    });
    setSending(false);
    if (r.success) { setReplyMsg(""); load(); }
    else setError(r.message ?? "Failed to send.");
  }

  async function changeStatus() {
    if (!newStatus) return;
    setActionBusy(true); setError(""); setSuccess("");
    const r = await api(`/api/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    setActionBusy(false);
    if (r.success) { setSuccess("Status updated."); setNewStatus(""); load(); }
    else setError(r.message ?? "Failed.");
  }

  async function resolveTicket() {
    if (!resolution.trim()) return;
    setActionBusy(true); setError(""); setSuccess("");
    const r = await api(`/api/tickets/${id}/resolve`, { method: "PATCH", body: JSON.stringify({ resolution }) });
    setActionBusy(false);
    if (r.success) { setSuccess("Ticket resolved!"); setResolution(""); load(); }
    else setError(r.message ?? "Failed.");
  }

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="spinner" /></div>;
  if (!ticket) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="text-sm text-slate-600">Ticket not found.</p>
      <button onClick={() => router.push("/dashboard/tickets")} className="btn-secondary text-xs">Go back</button>
    </div>
  );

  const isClosed = ticket.status === "CLOSED";
  const isResolved = ticket.status === "RESOLVED";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <button onClick={() => router.push("/dashboard/tickets")} className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to tickets
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold text-indigo-600">{ticket.ticketNumber}</p>
            <h1 className="mt-0.5 text-lg font-bold text-slate-900">{ticket.subject}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">{ticket.createdByName}</span>
              <span>@{ticket.createdByUsername}</span>
              <span>·</span>
              <span>{ticket.category.replace(/_/g, " ")}</span>
              <span>·</span>
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${PRIORITY_BADGE[ticket.priority]}`}>{ticket.priority}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_BADGE[ticket.status]}`}>{ticket.status.replace(/_/g, " ")}</span>
            {ticket.slaBreached && <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"><AlertTriangle className="h-3 w-3" />SLA Breached</span>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Description */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Resolution */}
        {ticket.resolution && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Resolution
            </p>
            <p className="text-sm text-emerald-900">{ticket.resolution}</p>
            {ticket.resolvedAt && <p className="mt-1 text-[10px] text-emerald-600">{new Date(ticket.resolvedAt).toLocaleString()}</p>}
          </div>
        )}

        {/* Actions */}
        {!isClosed && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs">
                  <option value="">Change Status...</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
                <button onClick={changeStatus} disabled={!newStatus || actionBusy} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40">Set</button>
              </div>
              {!isResolved && (
                <div className="flex items-center gap-2">
                  <input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution note..." className="h-8 w-48 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs placeholder-slate-400 focus:border-emerald-300 focus:outline-none" />
                  <button onClick={resolveTicket} disabled={!resolution.trim() || actionBusy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Resolve</button>
                </div>
              )}
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3 w-3" />{success}</p>}
          </div>
        )}

        {/* Conversation */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Conversation ({ticket.messages.length})</span>
          </div>
          {ticket.messages.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">No messages yet.</div>
          ) : (
            <div className="divide-y divide-slate-50 px-4">
              {ticket.messages.map((m) => {
                const isStaff = !["STUDENT", "PARENT"].includes(m.senderRole);
                return (
                  <div key={m.id} className="py-4 flex gap-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isStaff ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                      {isStaff ? <User className="h-3.5 w-3.5" /> : m.senderName?.charAt(0) ?? "S"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-semibold text-slate-800">{m.senderName ?? m.senderRole}</span>
                        {m.isInternalNote && <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800"><Lock className="h-2.5 w-2.5" />Internal</span>}
                        <span className="text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className={`mt-1 text-sm whitespace-pre-wrap ${m.isInternalNote ? "text-amber-900" : "text-slate-700"}`}>{m.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reply input */}
      {!isClosed && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Reply</span>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="h-3 w-3 rounded border-amber-300 text-amber-500" />
              <Lock className="h-3 w-3" /> Internal note
            </label>
          </div>
          <div className="flex gap-2">
            <textarea
              value={replyMsg}
              onChange={(e) => setReplyMsg(e.target.value)}
              rows={3}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                isInternal
                  ? "border-amber-200 bg-amber-50/40 focus:ring-amber-100 placeholder:text-amber-400"
                  : "border-slate-200 bg-white focus:ring-indigo-100 placeholder:text-slate-400"
              }`}
              placeholder={isInternal ? "Internal note (staff only)..." : "Write a reply..."}
              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) sendReply(); }}
            />
          </div>
          <button onClick={sendReply} disabled={!replyMsg.trim() || sending} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
            {sending ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </div>
      )}
    </div>
  );
}
