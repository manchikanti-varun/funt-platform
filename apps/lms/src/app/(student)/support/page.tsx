"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-indigo-100 text-indigo-800", ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800", WAITING_FOR_STUDENT: "bg-amber-100 text-amber-800",
  WAITING_FOR_SUPPORT: "bg-orange-100 text-orange-800", RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-600", ESCALATED: "bg-red-100 text-red-800",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-500", MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-800", URGENT: "bg-red-100 text-red-800",
};

const CATEGORIES = [
  "COURSE_ACCESS","ASSIGNMENT","ATTENDANCE","CERTIFICATE","PAYMENT",
  "ENROLLMENT","SHOP_ORDER","TECHNICAL_ISSUE","BUG_REPORT","FEATURE_REQUEST","GENERAL_QUERY",
];

interface TicketRow {
  id: string; ticketNumber: string; category: string; subject: string;
  priority: string; status: string; createdAt: string;
}
interface ListResult { tickets: TicketRow[]; total: number }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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
      className="ml-1.5 inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black/50 transition hover:border-indigo-300 hover:text-indigo-700"
    >
      {copied ? (
        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Copied</>
      ) : (
        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
      )}
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

  // Form state
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
    if (!subject.trim() || !description.trim()) {
      setFormError("Subject and description are required."); return;
    }
    setSubmitting(true);
    const res = await api<{ ticketNumber?: string }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify({ category, subject, description, priority: priority || undefined }),
    });
    setSubmitting(false);
    if (res.success) {
      const tktNum = (res.data as { ticketNumber?: string } | undefined)?.ticketNumber ?? "";
      setNewTicketNumber(tktNum);
      setFormSuccess(tktNum
        ? `Ticket submitted! Your ticket number is ${tktNum} — save this to check your status or reference it with management.`
        : "Your support ticket has been submitted. We'll respond soon."
      );
      setShowForm(false);
      setSubject(""); setDescription(""); setCategory("GENERAL_QUERY"); setPriority("");
      void load();
    } else {
      setFormError(res.message ?? "Failed to submit ticket.");
    }
  }

  return (
    <AppPageShell className="max-w-4xl pb-8">
      <div className="page-hero shrink-0 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-black">Support</h1>
            <p className="mt-1 text-sm text-black/60">Raise and track your support tickets.</p>
          </div>
          <button onClick={() => { setShowForm((s) => !s); setFormError(""); setFormSuccess(""); setNewTicketNumber(""); }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500">
            {showForm ? "Cancel" : "+ New Ticket"}
          </button>
        </div>
      </div>

      {/* Success banner with prominent ticket number */}
      {formSuccess && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-5 py-4 space-y-2">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <p className="text-sm font-semibold text-indigo-900">{formSuccess}</p>
          </div>
          {newTicketNumber && (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-2.5">
              <span className="text-xs font-semibold text-black/50 uppercase tracking-wider">Your Ticket ID</span>
              <span className="font-mono text-lg font-black text-indigo-700">{newTicketNumber}</span>
              <CopyButton text={newTicketNumber} />
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <DataPanel className="border-2 border-black/10 shadow-sm">
          <form onSubmit={(e) => void submitTicket(e)} className="space-y-4">
            <h2 className="text-base font-bold text-black">New Support Ticket</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-black">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-black">Priority <span className="font-normal text-black/50">(optional)</span></label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Auto</option>
                  {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-black">Subject <span className="text-red-500">*</span></label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} required
                className="w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Briefly describe your issue…" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-black">Description <span className="text-red-500">*</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5}
                className="w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-y"
                placeholder="Provide detailed information about your issue…" />
            </div>
            {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50">
                {submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>Submitting…</> : "Submit Ticket"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-xl border-2 border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black/70 hover:bg-slate-50">Cancel</button>
            </div>
          </form>
        </DataPanel>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); }}
          className="rounded-xl border-2 border-black/10 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
          <option value="">All Statuses</option>
          {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_STUDENT","RESOLVED","CLOSED","ESCALATED"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>
          ))}
        </select>
        <span className="text-sm text-black/50">{result?.total ?? 0} tickets</span>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-indigo-600" />
        </div>
      ) : !result?.tickets.length ? (
        <DataPanel className="border-2 border-black/10">
          <div className="flex min-h-[100px] items-center justify-center text-sm text-black/50">
            No tickets yet. Create one above if you need help.
          </div>
        </DataPanel>
      ) : (
        <div className="space-y-3">
          {result.tickets.map((t) => (
            <Link key={t.id} href={`/support/${t.id}`}
              className="block rounded-2xl border-2 border-black/10 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* Prominent ticket number with copy */}
                  <div className="flex items-center gap-0.5">
                    <span className="font-mono text-sm font-bold text-indigo-700">{t.ticketNumber}</span>
                    <CopyButton text={t.ticketNumber} />
                  </div>
                  <p className="mt-0.5 font-bold text-black truncate">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-black/50">{t.category.replace(/_/g," ")} · {new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[t.priority] ?? "bg-slate-100 text-slate-500"}`}>{t.priority}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[t.status] ?? "bg-slate-100 text-slate-500"}`}>{t.status.replace(/_/g," ")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* How to reference tip */}
      {(result?.tickets.length ?? 0) > 0 && (
        <div className="rounded-xl border border-black/10 bg-slate-50/60 px-4 py-3 text-xs text-black/50">
          💡 <strong className="text-black/70">Tip:</strong> When contacting management about a ticket, share your ticket number (e.g. <span className="font-mono font-semibold">TKT-2026-000001</span>). They can find it instantly.
        </div>
      )}
    </AppPageShell>
  );
}
