"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getParentSelectedStudentSession } from "@/lib/parentSelection";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-indigo-100 text-indigo-800", ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800", RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-600", ESCALATED: "bg-red-100 text-red-800",
};
const CATEGORIES = [
  "COURSE_ACCESS","ASSIGNMENT","ATTENDANCE","CERTIFICATE","PAYMENT",
  "ENROLLMENT","SHOP_ORDER","TECHNICAL_ISSUE","GENERAL_QUERY",
];

interface TicketRow { id: string; ticketNumber: string; category: string; subject: string; priority: string; status: string; createdAt: string }

export default function ParentSupportPage() {
  const router = useRouter();
  const studentUsername = getParentSelectedStudentSession();
  const [result, setResult] = useState<{ tickets: TicketRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("GENERAL_QUERY");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ tickets: TicketRow[]; total: number }>("/api/tickets/my?limit=50");
    if (r.success && r.data) setResult(r.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!studentUsername) { router.replace("/parent/profiles"); return; }
    void load();
  }, [studentUsername, load, router]);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!subject.trim() || !description.trim()) { setFormError("Subject and description are required."); return; }
    setSubmitting(true);
    const res = await api("/api/tickets", {
      method: "POST",
      body: JSON.stringify({ category, subject, description }),
    });
    setSubmitting(false);
    if (res.success) {
      setFormSuccess("Ticket submitted. We'll respond soon.");
      setShowForm(false); setSubject(""); setDescription(""); setCategory("GENERAL_QUERY");
      void load();
    } else {
      setFormError(res.message ?? "Failed to submit.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-black">Student Support</h1>
          <p className="mt-0.5 text-sm text-black/60">Raise and track support tickets for your child.</p>
        </div>
        <button onClick={() => { setShowForm((s) => !s); setFormError(""); setFormSuccess(""); }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">
          {showForm ? "Cancel" : "+ New Ticket"}
        </button>
      </div>

      {formSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{formSuccess}</div>
      )}

      {showForm && (
        <form onSubmit={(e) => void submitTicket(e)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-black">New Support Ticket</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-black">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-black">Subject <span className="text-red-500">*</span></label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Briefly describe the issue…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-black">Description <span className="text-red-500">*</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-y"
              placeholder="Provide more details…" />
          </div>
          {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      ) : !result?.tickets.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-slate-500">No support tickets yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {result.tickets.map((t) => (
            <Link key={t.id} href={`/parent/support/${t.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-400">{t.ticketNumber}</p>
                  <p className="mt-0.5 font-bold text-slate-900 truncate">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t.category.replace(/_/g," ")} · {new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[t.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {t.status.replace(/_/g," ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
