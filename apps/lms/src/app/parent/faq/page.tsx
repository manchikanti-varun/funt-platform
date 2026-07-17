"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportWhatsAppHref } from "@/lib/support";

interface DynamicFaq {
  id: string;
  articleId: string;
  slug: string;
  title: string;
  content: string;
  category: string;
  summary?: string;
  tags?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  "platform-overview": "Platform Overview",
  courses: "Courses",
  students: "Students",
  parents: "Parents",
  payments: "Payments",
  attendance: "Attendance",
  certificates: "Certificates",
  "learning-plans": "Learning Plans",
};

// Static parent-specific FAQs
const STATIC_FAQS = [
  {
    id: "p-link",
    question: "How do I link my child's student account?",
    answer: "After logging in as a parent, you will see a Profiles page. Your child's account is linked by their centre — if it does not appear, contact support with your name and your child's FUNT username.",
  },
  {
    id: "p-progress",
    question: "How do I view my child's progress?",
    answer: "Once you select a student profile, the Parent Dashboard shows course completion, attendance percentage, and chapter-level progress. Tap any course for details.",
  },
  {
    id: "p-attendance",
    question: "How do I check my child's attendance?",
    answer: "The Parent Dashboard shows overall attendance percentage. For session-by-session details, check the attendance summary section. If something looks incorrect, contact the batch trainer or coordinator.",
  },
  {
    id: "p-payment",
    question: "How do I know if my child's fees are paid?",
    answer: "Your child can check Payment in their student account. If a course shows locked, the fee may be pending verification. Keep payment receipts (UTR, screenshot) and contact support if access is delayed.",
  },
  {
    id: "p-certificate",
    question: "When will my child get a certificate?",
    answer: "Certificates are issued when your child meets all completion requirements (chapters, assignments, fees). The Parent Dashboard shows certificate status for each course.",
  },
  {
    id: "p-multiple",
    question: "Can I monitor multiple children?",
    answer: "Yes. If your centre has linked multiple student accounts to your parent login, all will appear on the Profiles page. Select any child to view their individual dashboard.",
  },
  {
    id: "p-learning-plan",
    question: "What is a Learning Plan and how does it affect my child?",
    answer: "Some courses use Learning Plans with milestones. Each milestone unlocks progressively and may require payment. Check the Parent Dashboard for milestone status, unlocking progress, and next steps.",
  },
  {
    id: "p-support",
    question: "How do I get help as a parent?",
    answer: "Use the Support page in this portal, or contact us directly via WhatsApp or email. Always include your child's FUNT username and course name for faster resolution.",
  },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function ParentFaqPage() {
  const [dynamicFaqs, setDynamicFaqs] = useState<DynamicFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    api<DynamicFaq[]>("/api/knowledge/faqs")
      .then((res) => {
        if (res.success && res.data) setDynamicFaqs(Array.isArray(res.data) ? res.data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter static FAQs
  const filteredStatic = useMemo(() => {
    if (!debouncedSearch.trim()) return STATIC_FAQS;
    const q = debouncedSearch.toLowerCase();
    return STATIC_FAQS.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [debouncedSearch]);

  // Filter dynamic FAQs
  const filteredDynamic = useMemo(() => {
    if (!debouncedSearch.trim()) return dynamicFaqs;
    const q = debouncedSearch.toLowerCase();
    return dynamicFaqs.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        stripHtml(f.content).toLowerCase().includes(q) ||
        (f.summary ?? "").toLowerCase().includes(q)
    );
  }, [dynamicFaqs, debouncedSearch]);

  // Group dynamic by category
  const groupedDynamic = useMemo(() => {
    return filteredDynamic.reduce<Record<string, DynamicFaq[]>>((acc, faq) => {
      if (!acc[faq.category]) acc[faq.category] = [];
      acc[faq.category].push(faq);
      return acc;
    }, {});
  }, [filteredDynamic]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalResults = filteredStatic.length + filteredDynamic.length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Parent Help Centre</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Frequently Asked Questions
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Quick answers about monitoring your child&apos;s progress, payments, and certificates on FUNT Learn.
            </p>
          </div>
          <Link
            href="/parent/dashboard"
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </div>

        {/* Search */}
        <div className="relative mt-4 max-w-md">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {debouncedSearch.trim() && (
          <p className="mt-2 text-xs text-slate-500">
            {totalResults === 0 ? "No results found" : `${totalResults} result${totalResults !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {/* Static Parent FAQs */}
      {filteredStatic.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Parent Guide</h2>
          <p className="mt-1 text-xs text-slate-500">Common questions about using the parent portal.</p>
          <div className="mt-4 space-y-2">
            {filteredStatic.map((faq) => {
              const isOpen = expandedIds.has(faq.id);
              return (
                <div
                  key={faq.id}
                  className={`rounded-xl border transition-all ${
                    isOpen ? "border-indigo-200 bg-indigo-50/30 shadow-sm" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(faq.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className={`text-sm font-semibold ${isOpen ? "text-indigo-700" : "text-slate-800"}`}>
                      {faq.question}
                    </span>
                    <svg
                      className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                      <p className="text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dynamic FAQs from Knowledge Center */}
      {!loading && filteredDynamic.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">More from Knowledge Center</h2>
          <p className="mt-1 text-xs text-slate-500">Updated FAQs relevant to parents.</p>
          {Object.entries(groupedDynamic).map(([cat, catFaqs]) => (
            <div key={cat} className="mt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                {CATEGORY_LABELS[cat] ?? cat}
              </h3>
              <div className="space-y-2">
                {catFaqs.map((faq) => {
                  const isOpen = expandedIds.has(`dyn-${faq.id}`);
                  return (
                    <div
                      key={faq.id}
                      className={`rounded-xl border transition-all ${
                        isOpen ? "border-indigo-200 bg-indigo-50/30 shadow-sm" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <button
                        onClick={() => toggleExpand(`dyn-${faq.id}`)}
                        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`text-sm font-semibold ${isOpen ? "text-indigo-700" : "text-slate-800"}`}>
                            {faq.title}
                          </span>
                          {!isOpen && faq.summary && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{faq.summary}</p>
                          )}
                        </div>
                        <svg
                          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                          <div
                            className="prose prose-sm max-w-none text-slate-600 prose-headings:text-sm prose-headings:font-bold"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(faq.content) }}
                          />
                          {faq.tags && faq.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {faq.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Empty state */}
      {debouncedSearch.trim() && totalResults === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-3 text-sm font-semibold text-slate-700">No matching FAQs</p>
          <p className="mt-1 text-xs text-slate-500">Try different keywords or contact support.</p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Support Footer */}
      <section className="rounded-2xl border border-indigo-200/50 bg-gradient-to-r from-indigo-50/50 to-slate-50 p-5">
        <p className="text-sm font-bold text-slate-700">Still need help?</p>
        <p className="mt-1 text-xs text-slate-500">
          Include your child&apos;s FUNT username and course name for faster resolution.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={supportWhatsAppHref("Hi, I'm a FUNT parent and need help.\nChild's username:\nIssue:")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
          >
            WhatsApp {SUPPORT_WHATSAPP_DISPLAY}
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=FUNT%20Parent%20Help`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Email {SUPPORT_EMAIL}
          </a>
          <Link
            href="/parent/support"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Support Desk
          </Link>
        </div>
      </section>
    </div>
  );
}
