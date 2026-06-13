"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";
import { RequireRoles } from "@/components/auth/RequireRoles";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600", MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-800", URGENT: "bg-red-100 text-red-800",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-indigo-100 text-indigo-800", ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800", WAITING_FOR_STUDENT: "bg-amber-100 text-amber-800",
  WAITING_FOR_SUPPORT: "bg-orange-100 text-orange-800", RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-600", ESCALATED: "bg-red-100 text-red-800",
};

interface TicketMessage { id: string; senderId: string; senderRole: string; message: string; attachments: string[]; isInternalNote: boolean; createdAt: string }
interface TicketDetail {
  id: string; ticketNumber: string; createdByName: string; createdByUsername: string; createdByRole: string;
  category: string; customCategory?: string; priority: string; subject: string; description: string;
  status: string; assignedTo?: string; assignedToName?: string; resolvedBy?: string; resolution?: string;
  resolvedAt?: string; closedAt?: string; escalatedAt?: string; slaDueAt?: string; slaBreached?: boolean;
  attachments: string[]; tags: string[]; createdAt: string; messages: TicketMessage[];
}

const STATUSES = ["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_STUDENT","WAITING_FOR_SUPPORT","RESOLVED","CLOSED","ESCALATED"];
const PRIORITIES = ["LOW","MEDIUM","HIGH","URGENT"];

export default function TicketDetailPage() {
  const { roles } = useAdminUser();
  const params = useParams();
  const id = params.id as string;
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);
  const isAdmin = roles.includes(ROLE.ADMIN) || isSuperAdmin;
  const isTrainer = roles.includes(ROLE.TRAINER);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reply form
  const [replyMsg, setReplyMsg] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Admin action forms
  const [assignTo, setAssignTo] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [resolution, setResolution] = useState("");

  const load = async () => {
    setLoading(true);
    const r = await api<TicketDetail>(`/api/tickets/${id}`);
    if (r.success && r.data) setTicket(r.data);
    setLoading(false);
  };

  useEffect(() => { if (id) void load(); }, [id]);

  async function doAction(endpoint: string, body: Record<string, unknown>, msg: string) {
    setError(""); setSuccess(""); setActionLoading(true);
    const res = await api(`/api/tickets/${id}/${endpoint}`, { method: "PATCH", body: JSON.stringify(body) });
    setActionLoading(false);
    if (res.success) { setSuccess(msg); void load(); }
    else setError(res.message ?? "Action failed.");
  }

  async function sendReply() {
    if (!replyMsg.trim()) return;
    setSendingReply(true); setError("");
    const res = await api(`/api/tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: replyMsg, isInternalNote }),
    });
    setSendingReply(false);
    if (res.success) { setReplyMsg(""); void load(); }
    else setError(res.message ?? "Failed to send reply.");
  }

  if (loading) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
    </div>
  );
  if (!ticket) return <div className="space-y-4 w-full"><BackLink href="/support">Back</BackLink><p className="text-slate-600">Ticket not found.</p></div>;

  const canAssign = isAdmin;
  const canChangeStatus = isAdmin || isTrainer;
  const canChangePriority = isAdmin;
  const canResolve = isAdmin || isTrainer;
  const canReopen = isAdmin;
  const isClosed = ticket.status === "CLOSED";
  const isResolved = ticket.status === "RESOLVED";

  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.TRAINER]} fallbackHref="/dashboard" />
      <BackLink href="/support">Back to Support Desk</BackLink>

      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-5">
          <div>
            <p className="font-mono text-xs font-semibold text-slate-500">{ticket.ticketNumber}</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{ticket.subject}</h1>
            <p className="mt-1 text-sm text-slate-500">{ticket.createdByName} (@{ticket.createdByUsername}) · {ticket.createdByRole.replace("_"," ")}</p>
            <p className="mt-0.5 text-xs text-slate-400">{ticket.category.replace(/_/g," ")} · Created {new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? "bg-slate-100 text-slate-600"}`}>{ticket.status.replace(/_/g," ")}</span>
            {ticket.slaBreached && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">⚠ SLA Breached</span>}
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Description</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{ticket.description}</p>
          {ticket.attachments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ticket.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline">Attachment {i+1}</a>
              ))}
            </div>
          )}
        </div>

        {/* Resolution if resolved */}
        {ticket.resolution && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">Resolution</p>
            <p className="text-sm text-emerald-900">{ticket.resolution}</p>
            {ticket.resolvedAt && <p className="mt-1 text-xs text-emerald-600">Resolved {new Date(ticket.resolvedAt).toLocaleString()}</p>}
          </div>
        )}

        {/* Admin Actions */}
        {(canAssign || canChangeStatus || canChangePriority || canResolve) && !isClosed && (
          <div className="border-t border-slate-200 px-6 py-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Actions</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {canAssign && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Assign To (User ID)</label>
                  <div className="flex gap-2">
                    <input value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="input flex-1 text-xs" placeholder="userId" />
                    <button onClick={() => void doAction("assign", { assignedTo: assignTo }, "Assigned.")} disabled={!assignTo.trim() || actionLoading}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">Assign</button>
                  </div>
                </div>
              )}
              {canChangeStatus && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Change Status</label>
                  <div className="flex gap-2">
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input flex-1 text-xs">
                      <option value="">Select…</option>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                    </select>
                    <button onClick={() => void doAction("status", { status: newStatus }, "Status updated.")} disabled={!newStatus || actionLoading}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">Set</button>
                  </div>
                </div>
              )}
              {canChangePriority && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Change Priority</label>
                  <div className="flex gap-2">
                    <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="input flex-1 text-xs">
                      <option value="">Select…</option>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={() => void doAction("priority", { priority: newPriority }, "Priority updated.")} disabled={!newPriority || actionLoading}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">Set</button>
                  </div>
                </div>
              )}
              {canResolve && !isResolved && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Resolution Note</label>
                  <div className="flex gap-2">
                    <input value={resolution} onChange={(e) => setResolution(e.target.value)} className="input flex-1 text-xs" placeholder="Describe resolution…" />
                    <button onClick={() => void doAction("resolve", { resolution }, "Resolved.")} disabled={!resolution.trim() || actionLoading}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Resolve</button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {canAssign && !isResolved && (
                <button onClick={() => void doAction("status", { status: "ESCALATED" }, "Escalated.")} disabled={actionLoading}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40">Escalate</button>
              )}
              {canReopen && (isResolved || isClosed) && (
                <button onClick={() => void doAction("reopen", {}, "Reopened.")} disabled={actionLoading}
                  className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40">Reopen</button>
              )}
              {isResolved && (
                <button onClick={() => void doAction("close", {}, "Closed.")} disabled={actionLoading}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Close Ticket</button>
              )}
            </div>
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            {success && <p className="text-sm text-emerald-700 font-medium">{success}</p>}
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Conversation ({ticket.messages.length})</h2>
        </div>
        {ticket.messages.length === 0 ? (
          <div className="flex min-h-[80px] items-center justify-center text-sm text-slate-400">No messages yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 px-6 py-2">
            {ticket.messages.map((m) => (
              <div key={m.id} className={`py-4 ${m.isInternalNote ? "bg-amber-50/40 -mx-6 px-6" : ""}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">{m.senderRole.replace("_"," ")}</span>
                  {m.isInternalNote && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Internal Note</span>}
                  <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{m.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reply box */}
        {!isClosed && (
          <div className="border-t border-slate-200 px-6 py-5 space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Add Reply</h3>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                Internal note (staff only)
              </label>
            </div>
            <textarea value={replyMsg} onChange={(e) => setReplyMsg(e.target.value)} rows={4}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${isInternalNote ? "border-amber-200 bg-amber-50/40 focus:border-amber-400 focus:ring-amber-100" : "border-slate-300 bg-white focus:border-teal-500 focus:ring-teal-100"}`}
              placeholder={isInternalNote ? "Internal note — only visible to staff…" : "Write a reply…"} />
            <button onClick={() => void sendReply()} disabled={!replyMsg.trim() || sendingReply}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50">
              {sendingReply ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>Sending…</> : "Send Reply"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
