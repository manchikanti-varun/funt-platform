"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import {
  Circle,
  UserCheck,
  Cog,
  Hourglass,
  MessageCircle,
  CheckCircle,
  Lock,
  AlertTriangle,
  Ticket,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN:                 "bg-indigo-100 text-indigo-700",
  ASSIGNED:             "bg-blue-100 text-blue-700",
  IN_PROGRESS:          "bg-cyan-100 text-cyan-700",
  WAITING_FOR_STUDENT:  "bg-amber-100 text-amber-700",
  WAITING_FOR_SUPPORT:  "bg-orange-100 text-orange-700",
  RESOLVED:             "bg-emerald-100 text-emerald-700",
  CLOSED:               "bg-slate-100 text-slate-500",
  ESCALATED:            "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  OPEN: <Circle className="h-3.5 w-3.5" />,
  ASSIGNED: <UserCheck className="h-3.5 w-3.5" />,
  IN_PROGRESS: <Cog className="h-3.5 w-3.5" />,
  WAITING_FOR_STUDENT: <Hourglass className="h-3.5 w-3.5" />,
  WAITING_FOR_SUPPORT: <MessageCircle className="h-3.5 w-3.5" />,
  RESOLVED: <CheckCircle className="h-3.5 w-3.5" />,
  CLOSED: <Lock className="h-3.5 w-3.5" />,
  ESCALATED: <AlertTriangle className="h-3.5 w-3.5" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-slate-500", MEDIUM: "text-blue-600",
  HIGH: "text-amber-600", URGENT: "text-red-600",
};

const PRIORITY_DOTS: Record<string, string> = {
  LOW: "bg-slate-300", MEDIUM: "bg-blue-500",
  HIGH: "bg-amber-500", URGENT: "bg-red-500",
};

const CATEGORIES = [
  { value: "GENERAL_QUERY",    label: "General Query" },
  { value: "COURSE_ACCESS",    label: "Course Access" },
  { value: "ASSIGNMENT",       label: "Assignment" },
  { value: "ATTENDANCE",       label: "Attendance" },
  { value: "CERTIFICATE",      label: "Certificate" },
  { value: "PAYMENT",          label: "Payment" },
  { value: "ENROLLMENT",       label: "Enrollment" },
  { value: "SHOP_ORDER",       label: "Shop Order" },
  { value: "TECHNICAL_ISSUE",  label: "Technical Issue" },
  { value: "BUG_REPORT",       label: "Bug Report" },
  { value: "FEATURE_REQUEST",  label: "Feature Request" },
];

interface TicketRow {
  id: string; ticketNumber: string; category: string; subject: string;
  priority: string; status: string; createdAt: string;
}
interface ListResult { tickets: TicketRow[]; total: number }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={copy} title="Copy"
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600">
      {copied
        ? <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Copied</>
        : <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
      }
    </button>
  );
}

export default function StudentSupportPage() {
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [newTicketNumber, setNewTicketNumber] = useState("");

  const [category, setCategory] = useState("GENERAL_QUERY");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    const r = await api<ListResult>(`/api/tickets/my?${params.toString()}`);
    if (r.success && r.data) setResult(r.data);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!subject.trim() || !description.trim()) { setFormError("Subject and description are required."); return; }
    setSubmitting(true);
    const res = await api<{ ticketNumber?: string }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify({ category, subject, description, priority: priority || undefined }),
    });
    setSubmitting(false);
    if (res.success) {
      const tktNum = (res.data as { ticketNumber?: string } | undefined)?.ticketNumber ?? "";
      setNewTicketNumber(tktNum);
      setFormSuccess(tktNum ? `Ticket ${tktNum} submitted successfully.` : "Ticket submitted successfully.");
      setShowForm(false);
      setSubject(""); setDescription(""); setCategory("GENERAL_QUERY"); setPriority("");
      void load();
    } else {
      setFormError(res.message ?? "Failed to submit ticket.");
    }
  }

  const ticketCount = result?.total ?? 0;

  return (
    <AppPageShell className="max-w-3xl pb-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="page-hero shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-overline">Help Center</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-black">Support</h1>
            <p className="mt-1 text-sm text-black/60">Raise and track your support tickets.</p>
          </div>
          <button
            onClick={() => { setShowForm((s) => !s); setFormError(""); setFormSuccess(""); setNewTicketNumber(""); }}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition ${
              showForm
                ? "border-2 border-black/10 bg-white text-black/70 hover:bg-slate-50"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {showForm ? (
              <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Cancel</>
            ) : (
              <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>New Ticket</>
            )}
          </button>
        </div>
      </div>

      {/* ── Success banner ──────────────────────────────────────────── */}
      {formSuccess && (
        <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50">
          <div className="flex items-start gap-3 px-5 py-4">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            <p className="text-sm font-semibold text-indigo-900">{formSuccess}</p>
          </div>
          {newTicketNumber && (
            <div className="border-t border-indigo-200 bg-white px-5 py-3 flex items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Ticket ID</p>
              <span className="font-mono text-lg font-black text-indigo-700">{newTicketNumber}</span>
              <CopyButton text={newTicketNumber} />
            </div>
          )}
        </div>
      )}

      {/* ── New ticket form ─────────────────────────────────────────── */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
            <p className="label-overline">New Support Ticket</p>
            <p className="mt-0.5 text-xs text-slate-500">Our team will get back to you as soon as possible.</p>
          </div>
          <form onSubmit={(e) => void submitTicket(e)} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Priority <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
                  <option value="">Auto-detect</option>
                  {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="input"
                placeholder="Briefly describe your issue"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={5}
                className="input resize-y"
                placeholder="Provide as much detail as possible — what happened, what you expected, any error messages…"
              />
            </div>
            {formError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50">
                {submitting
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>Submitting…</>
                  : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>Submit Ticket</>
                }
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-5 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter + count ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto text-sm py-2"
          >
            <option value="">All Statuses</option>
            {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_STUDENT","RESOLVED","CLOSED","ESCALATED"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g," ")}</option>
            ))}
          </select>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {ticketCount} ticket{ticketCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Ticket list ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <div className="spinner spinner--inline" />
        </div>
      ) : !result?.tickets.length ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white/80 text-center shadow-sm ring-1 ring-slate-100/80">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
            <Ticket className="h-7 w-7 text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No support tickets yet</p>
          <p className="mt-1 text-xs text-slate-500">Need help? Create a new ticket and we&apos;ll assist you.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500"
          >
            + New Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {result.tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="group block rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm ring-1 ring-slate-100/50 transition hover:border-indigo-300 hover:shadow-md hover:ring-indigo-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Ticket number + copy */}
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600">{t.ticketNumber}</span>
                    <CopyButton text={t.ticketNumber} />
                  </div>
                  {/* Subject */}
                  <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition">
                    {t.subject}
                  </p>
                  {/* Meta */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category.replace(/_/g," ")}</span>
                    <span className="h-3 w-px bg-slate-200" />
                    <span>{new Date(t.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                </div>

                {/* Priority + Status */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[t.status] ?? "bg-slate-100 text-slate-500"}`}>
                    <span className="inline-flex">{STATUS_ICONS[t.status] ?? "•"}</span>
                    {t.status.replace(/_/g," ")}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${PRIORITY_COLORS[t.priority] ?? "text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOTS[t.priority] ?? "bg-slate-300"}`} />
                    {t.priority}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppPageShell>
  );
}
