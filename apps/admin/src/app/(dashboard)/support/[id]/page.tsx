"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";
import { RequireRoles } from "@/components/auth/RequireRoles";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600 ring-slate-200",
  MEDIUM: "bg-blue-50 text-blue-700 ring-blue-200",
  HIGH: "bg-amber-50 text-amber-800 ring-amber-200",
  URGENT: "bg-red-50 text-red-700 ring-red-200",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  ASSIGNED: "bg-blue-50 text-blue-700 ring-blue-200",
  IN_PROGRESS: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  WAITING_FOR_STUDENT: "bg-amber-50 text-amber-700 ring-amber-200",
  WAITING_FOR_SUPPORT: "bg-orange-50 text-orange-700 ring-orange-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CLOSED: "bg-slate-100 text-slate-500 ring-slate-200",
  ESCALATED: "bg-red-50 text-red-700 ring-red-200",
};
const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-700",
  ADMIN: "bg-teal-100 text-teal-700",
  TRAINER: "bg-indigo-100 text-indigo-700",
};

interface StaffUser { id: string; username: string; name: string; roles: string[] }
interface TicketMessage { id: string; senderId: string; senderName?: string; senderUsername?: string; senderRole: string; message: string; attachments: string[]; isInternalNote: boolean; createdAt: string }
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
  const adminUser = useAdminUser();
  const { roles } = adminUser;
  const currentUserId = adminUser.id ?? "";
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
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

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

  // Load staff list for assign dropdown
  useEffect(() => {
    if (!isAdmin) return;
    api<StaffUser[]>("/api/admin/staff-picker?variant=trainer").then((r) => {
      if (r.success && Array.isArray(r.data)) setStaffList(r.data);
    });
  }, [isAdmin]);

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
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
    </div>
  );
  if (!ticket) return <div className="space-y-4 w-full"><BackLink href="/support">Back</BackLink><p className="text-slate-600">Ticket not found.</p></div>;

  const canAssign = isAdmin;
  const canChangeStatus = isAdmin || isTrainer;
  const canChangePriority = isAdmin;
  const canResolve = isAdmin || isTrainer;
  const canEscalate = isAdmin || isTrainer;  // trainers can escalate to admin/SA
  const canReopen = isAdmin;
  const isClosed = ticket.status === "CLOSED";
  const isResolved = ticket.status === "RESOLVED";

  // Build staff options: self first, then others
  const selfEntry = staffList.find((s) => s.id === currentUserId);
  const othersEntries = staffList.filter((s) => s.id !== currentUserId);
  const orderedStaff = selfEntry ? [selfEntry, ...othersEntries] : othersEntries;

  return (
    <div className="w-full space-y-5">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.TRAINER]} fallbackHref="/dashboard" />
      <BackLink href="/support">Back to Support Desk</BackLink>

      {/* ── Ticket header card ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-white px-6 py-5">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold tracking-wider text-indigo-600">{ticket.ticketNumber}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{ticket.subject}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{ticket.createdByName}</span>
              <span>@{ticket.createdByUsername}</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>{ticket.createdByRole.replace(/_/g," ")}</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>{ticket.category.replace(/_/g," ")}</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
              {ticket.assignedToName && (
                <><span className="h-3 w-px bg-slate-200" /><span className="font-medium text-teal-700">→ {ticket.assignedToName}</span></>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${PRIORITY_COLORS[ticket.priority] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
              {ticket.priority}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_COLORS[ticket.status] ?? "bg-slate-100 text-slate-500 ring-slate-200"}`}>
              {ticket.status.replace(/_/g," ")}
            </span>
            {ticket.slaBreached && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                ⚠ SLA Breached
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-5">
          <p className="label-overline mb-2">Description</p>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          {ticket.attachments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ticket.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                  📎 Attachment {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Resolution */}
        {ticket.resolution && (
          <div className="border-t border-emerald-100 bg-emerald-50/60 px-6 py-4">
            <p className="label-overline mb-1 text-emerald-700">Resolution</p>
            <p className="text-sm text-emerald-900">{ticket.resolution}</p>
            {ticket.resolvedAt && <p className="mt-1 text-xs text-emerald-600">Resolved {new Date(ticket.resolvedAt).toLocaleString()}</p>}
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        {(canAssign || canChangeStatus || canChangePriority || canResolve || canEscalate) && !isClosed && (
          <div className="border-t border-slate-100 px-6 py-5 space-y-5">
            <p className="label-overline">Actions</p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Assign — dropdown of staff */}
              {canAssign && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Assign To</label>
                  <div className="flex gap-2">
                    <select
                      value={assignTo}
                      onChange={(e) => setAssignTo(e.target.value)}
                      className="input flex-1 text-sm"
                    >
                      <option value="">Select staff…</option>
                      {orderedStaff.map((s) => {
                        const isSelf = s.id === currentUserId;
                        const primaryRole = s.roles.includes(ROLE.SUPER_ADMIN) ? "SA"
                          : s.roles.includes(ROLE.ADMIN) ? "Admin"
                          : "Trainer";
                        return (
                          <option key={s.id} value={s.id}>
                            {isSelf ? "👤 " : ""}{s.name || s.username} ({primaryRole}){isSelf ? " — Self" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      onClick={() => void doAction("assign", { assignedTo: assignTo }, "Ticket assigned.")}
                      disabled={!assignTo || actionLoading}
                      className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      Assign
                    </button>
                  </div>
                  {/* Staff preview card when selected */}
                  {assignTo && (() => {
                    const s = orderedStaff.find((x) => x.id === assignTo);
                    if (!s) return null;
                    const role = s.roles.includes(ROLE.SUPER_ADMIN) ? "SUPER_ADMIN" : s.roles.includes(ROLE.ADMIN) ? "ADMIN" : "TRAINER";
                    return (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {(s.name || s.username).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">{s.name || s.username}</p>
                          <p className="text-[10px] text-slate-500">@{s.username}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE[role] ?? "bg-slate-100 text-slate-600"}`}>
                          {role === "SUPER_ADMIN" ? "SA" : role === "ADMIN" ? "Admin" : "Trainer"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Change Status */}
              {canChangeStatus && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Change Status</label>
                  <div className="flex gap-2">
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input flex-1 text-sm">
                      <option value="">Select…</option>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                    </select>
                    <button onClick={() => void doAction("status", { status: newStatus }, "Status updated.")} disabled={!newStatus || actionLoading}
                      className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Set</button>
                  </div>
                </div>
              )}

              {/* Change Priority */}
              {canChangePriority && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Change Priority</label>
                  <div className="flex gap-2">
                    <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="input flex-1 text-sm">
                      <option value="">Select…</option>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={() => void doAction("priority", { priority: newPriority }, "Priority updated.")} disabled={!newPriority || actionLoading}
                      className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Set</button>
                  </div>
                </div>
              )}

              {/* Resolve */}
              {canResolve && !isResolved && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Resolution Note</label>
                  <div className="flex gap-2">
                    <input value={resolution} onChange={(e) => setResolution(e.target.value)} className="input flex-1 text-sm" placeholder="Describe resolution…" />
                    <button onClick={() => void doAction("resolve", { resolution }, "Ticket resolved.")} disabled={!resolution.trim() || actionLoading}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Resolve</button>
                  </div>
                </div>
              )}
            </div>

            {/* Secondary actions */}
            <div className="flex flex-wrap gap-2">
              {canEscalate && !isResolved && ticket.status !== "ESCALATED" && (
                <button
                  onClick={() => void doAction("status", { status: "ESCALATED" }, "Ticket escalated to Admin/Super Admin.")}
                  disabled={actionLoading}
                  className="btn-danger text-xs px-3 py-1.5"
                  title="Flag this ticket as urgent — moves it to Admin/Super Admin attention"
                >
                  🚨 Escalate to Admin
                </button>
              )}
              {canReopen && (isResolved || isClosed) && (
                <button onClick={() => void doAction("reopen", {}, "Ticket reopened.")} disabled={actionLoading}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40">
                  ↺ Reopen
                </button>
              )}
              {isResolved && (
                <button onClick={() => void doAction("close", {}, "Ticket closed.")} disabled={actionLoading}
                  className="btn-secondary text-xs px-3 py-1.5">
                  ✓ Close Ticket
                </button>
              )}
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
            )}
            {success && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                {success}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Conversation ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Conversation
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{ticket.messages.length}</span>
          </h2>
        </div>

        {ticket.messages.length === 0 ? (
          <div className="flex min-h-[100px] items-center justify-center text-sm text-slate-400">
            No messages yet — be the first to reply.
          </div>
        ) : (
          <div className="divide-y divide-slate-50 px-6 py-2">
            {ticket.messages.map((m) => {
              const isStaff = !["STUDENT","PARENT"].includes(m.senderRole);
              return (
                <div key={m.id} className="py-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isStaff ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                      {isStaff ? m.senderRole.charAt(0) : "S"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-800">
                          {m.senderName || m.senderRole.replace(/_/g," ")}
                        </span>
                        {m.senderUsername && (
                          <span className="text-[11px] text-slate-400">@{m.senderUsername}</span>
                        )}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          m.senderRole === "SUPER_ADMIN" ? "bg-violet-100 text-violet-700"
                          : m.senderRole === "ADMIN" ? "bg-teal-100 text-teal-700"
                          : m.senderRole === "TRAINER" ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-500"
                        }`}>
                          {m.senderRole === "SUPER_ADMIN" ? "SA"
                            : m.senderRole === "ADMIN" ? "Admin"
                            : m.senderRole === "TRAINER" ? "Trainer"
                            : m.senderRole === "PARENT" ? "Parent"
                            : "Student"}
                        </span>
                        {m.isInternalNote && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">🔒 Internal Note</span>
                        )}
                        <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${m.isInternalNote ? "text-amber-900" : "text-slate-800"}`}>
                        {m.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply box */}
        {!isClosed && (
          <div className="border-t border-slate-100 px-6 py-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Add Reply</h3>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 transition hover:bg-amber-100">
                <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-amber-300 text-amber-500 focus:ring-amber-400" />
                🔒 Internal note (staff only)
              </label>
            </div>
            <textarea
              value={replyMsg}
              onChange={(e) => setReplyMsg(e.target.value)}
              rows={4}
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 transition ${
                isInternalNote
                  ? "border-amber-200 bg-amber-50/40 focus:border-amber-400 focus:ring-amber-100 placeholder:text-amber-400"
                  : "border-slate-200 bg-white focus:border-indigo-500 focus:ring-indigo-100 placeholder:text-slate-400"
              }`}
              placeholder={isInternalNote ? "Internal note — only visible to staff…" : "Write a reply to the student…"}
            />
            <button
              onClick={() => void sendReply()}
              disabled={!replyMsg.trim() || sendingReply}
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {sendingReply ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>Sending…</>
              ) : (
                <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>Send Reply</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
