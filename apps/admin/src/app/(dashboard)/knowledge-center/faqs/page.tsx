"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { AppPageShell, BackLink } from "@/components/ui";
import {
  HelpCircle,
  ChevronDown,
  Search,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Filter,
  X,
  Home,
  Lock,
  Package,
  GraduationCap,
  UserCheck,
  Users,
  CreditCard,
  KeyRound,
  Map,
  ClipboardList,
  CheckCircle,
  Award,
  ShoppingBag,
  Gamepad2,
  Ticket,
  CalendarDays,
  BarChart3,
  Upload,
  ShieldCheck,
  FileText,
} from "lucide-react";

interface FAQ {
  id: string;
  articleId: string;
  slug: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  summary?: string;
  tags?: string[];
  roles?: string[];
  updatedAt?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  "platform-overview": "Platform Overview",
  authentication: "Authentication",
  courses: "Courses",
  batches: "Batches",
  students: "Students",
  trainers: "Trainers",
  parents: "Parents",
  payments: "Payments",
  "license-keys": "License Keys",
  "learning-plans": "Learning Plans",
  assignments: "Assignments",
  attendance: "Attendance",
  certificates: "Certificates",
  shop: "Shop",
  gamification: "Gamification",
  tickets: "Tickets",
  "leave-management": "Leave Management",
  analytics: "Analytics",
  "import-export": "Import/Export",
  "content-protection": "Content Protection",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "platform-overview": <Home className="h-4 w-4" />,
  authentication: <Lock className="h-4 w-4" />,
  courses: <BookOpen className="h-4 w-4" />,
  batches: <Package className="h-4 w-4" />,
  students: <GraduationCap className="h-4 w-4" />,
  trainers: <UserCheck className="h-4 w-4" />,
  parents: <Users className="h-4 w-4" />,
  payments: <CreditCard className="h-4 w-4" />,
  "license-keys": <KeyRound className="h-4 w-4" />,
  "learning-plans": <Map className="h-4 w-4" />,
  assignments: <ClipboardList className="h-4 w-4" />,
  attendance: <CheckCircle className="h-4 w-4" />,
  certificates: <Award className="h-4 w-4" />,
  shop: <ShoppingBag className="h-4 w-4" />,
  gamification: <Gamepad2 className="h-4 w-4" />,
  tickets: <Ticket className="h-4 w-4" />,
  "leave-management": <CalendarDays className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  "import-export": <Upload className="h-4 w-4" />,
  "content-protection": <ShieldCheck className="h-4 w-4" />,
};

/** Strips HTML tags for plain-text search matching */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function FAQsPage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "";
  const { roles } = useAdminUser();

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, "yes" | "no">>({});

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch FAQs on category change
  useEffect(() => {
    const url = selectedCategory
      ? `/api/knowledge/faqs?category=${selectedCategory}`
      : "/api/knowledge/faqs";
    setLoading(true);
    api<FAQ[]>(url)
      .then((res) => {
        if (res.success && res.data) setFaqs(Array.isArray(res.data) ? res.data : []);
      })
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  // Filter FAQs by search locally (content already fetched)
  const filteredFaqs = useMemo(() => {
    if (!debouncedSearch.trim()) return faqs;
    const query = debouncedSearch.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.title.toLowerCase().includes(query) ||
        stripHtml(faq.content).toLowerCase().includes(query) ||
        (faq.tags ?? []).some((tag) => tag.toLowerCase().includes(query)) ||
        (faq.summary ?? "").toLowerCase().includes(query)
    );
  }, [faqs, debouncedSearch]);

  // Group filtered FAQs by category
  const grouped = useMemo(() => {
    return filteredFaqs.reduce<Record<string, FAQ[]>>((acc, faq) => {
      const cat = faq.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(faq);
      return acc;
    }, {});
  }, [filteredFaqs]);

  // Categories that have FAQs (for the chip filters)
  const availableCategories = useMemo(() => {
    const cats = new Set(faqs.map((f) => f.category));
    return Array.from(cats).sort();
  }, [faqs]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(filteredFaqs.map((f) => f.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function handleHelpful(faqId: string, vote: "yes" | "no") {
    setHelpfulVotes((prev) => ({ ...prev, [faqId]: vote }));
    // Could POST to an analytics endpoint here in the future
  }

  // Determine the role context label for the header
  const roleLabel = roles?.includes(ROLE.SUPER_ADMIN)
    ? "Super Admin"
    : roles?.includes(ROLE.ADMIN)
    ? "Admin"
    : roles?.includes(ROLE.TRAINER)
    ? "Trainer"
    : "User";

  return (
    <AppPageShell>
      <BackLink href="/knowledge-center">Back to Knowledge Center</BackLink>

      <div className="mt-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                  <HelpCircle className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Frequently Asked Questions
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Showing FAQs relevant to your role ({roleLabel})
                  </p>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-sm text-slate-600">
                Find quick answers to common questions about using FUNT. Can&apos;t find what you need?{" "}
                <Link href="/knowledge-center/search" className="font-medium text-indigo-600 hover:text-indigo-700">
                  Search the full Knowledge Base
                </Link>{" "}
                or{" "}
                <Link href="/support" className="font-medium text-indigo-600 hover:text-indigo-700">
                  raise a support ticket
                </Link>.
              </p>
            </div>
            <div className="hidden shrink-0 sm:block">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                <BookOpen className="h-3 w-3" />
                {faqs.length} FAQ{faqs.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-5 max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs by keyword, topic, or tag…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Chips & Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <button
              onClick={() => setSelectedCategory("")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                !selectedCategory
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              All
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                <span className="mr-1 inline-flex">{CATEGORY_ICONS[cat] ?? <FileText className="h-4 w-4" />}</span>
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>

          {/* Expand/Collapse All */}
          {filteredFaqs.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {/* Search Result Count */}
        {debouncedSearch.trim() && !loading && (
          <div className="mt-3">
            <p className="text-sm text-slate-500">
              {filteredFaqs.length === 0 ? (
                <>No FAQs match &quot;{debouncedSearch}&quot;</>
              ) : (
                <>
                  {filteredFaqs.length} result{filteredFaqs.length !== 1 ? "s" : ""} for &quot;{debouncedSearch}&quot;
                </>
              )}
            </p>
          </div>
        )}

        {/* FAQ Content */}
        {loading ? (
          <div className="mt-8 flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
            <p className="mt-4 text-sm text-slate-500">Loading FAQs…</p>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <HelpCircle className="h-7 w-7 text-slate-400" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">
              {debouncedSearch.trim() ? "No matching FAQs" : "No FAQs available"}
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              {debouncedSearch.trim()
                ? "Try different keywords or clear the search to see all FAQs."
                : "FAQ articles have not been published for this category yet. Check back soon."}
            </p>
            {debouncedSearch.trim() && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {Object.entries(grouped).map(([cat, catFaqs]) => (
              <section key={cat}>
                {/* Category Header */}
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="text-lg inline-flex items-center">{CATEGORY_ICONS[cat] ?? <FileText className="h-5 w-5" />}</span>
                  <h2 className="text-base font-bold text-slate-800">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {catFaqs.length}
                  </span>
                </div>

                {/* FAQ Items */}
                <div className="space-y-2.5">
                  {catFaqs.map((faq) => {
                    const isExpanded = expandedIds.has(faq.id);
                    const vote = helpfulVotes[faq.id];

                    return (
                      <div
                        key={faq.id}
                        className={`rounded-xl border bg-white shadow-sm transition-all ${
                          isExpanded
                            ? "border-indigo-200 shadow-md ring-1 ring-indigo-100"
                            : "border-slate-200 hover:border-slate-300 hover:shadow"
                        }`}
                      >
                        {/* Question (always visible) */}
                        <button
                          onClick={() => toggleExpand(faq.id)}
                          className="flex w-full items-start gap-3 px-5 py-4 text-left"
                          aria-expanded={isExpanded}
                        >
                          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition ${
                            isExpanded ? "bg-indigo-100" : "bg-slate-100"
                          }`}>
                            <HelpCircle className={`h-3.5 w-3.5 ${isExpanded ? "text-indigo-600" : "text-slate-500"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`text-sm font-semibold leading-snug ${
                              isExpanded ? "text-indigo-700" : "text-slate-800"
                            }`}>
                              {faq.title}
                            </span>
                            {/* Answer preview when collapsed */}
                            {!isExpanded && faq.summary && (
                              <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                                {faq.summary}
                              </p>
                            )}
                          </div>
                          <div className={`mt-0.5 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                            <ChevronDown className={`h-4 w-4 ${isExpanded ? "text-indigo-500" : "text-slate-400"}`} />
                          </div>
                        </button>

                        {/* Answer (expanded) */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                            {/* Content */}
                            <div
                              className="prose prose-sm prose-slate max-w-none leading-relaxed prose-headings:text-sm prose-headings:font-bold prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-700 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:text-indigo-700"
                              dangerouslySetInnerHTML={{ __html: faq.content }}
                            />

                            {/* Tags */}
                            {faq.tags && faq.tags.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-1.5">
                                {faq.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Footer: Helpful + Link */}
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                              {/* Helpful voting */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Was this helpful?</span>
                                <button
                                  onClick={() => handleHelpful(faq.id, "yes")}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                                    vote === "yes"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "border border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                  }`}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  Yes
                                </button>
                                <button
                                  onClick={() => handleHelpful(faq.id, "no")}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                                    vote === "no"
                                      ? "bg-red-100 text-red-700"
                                      : "border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                  }`}
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                  No
                                </button>
                                {vote && (
                                  <span className="text-[10px] text-slate-400">
                                    {vote === "yes" ? "Thanks for the feedback!" : "We'll work on improving this."}
                                  </span>
                                )}
                              </div>

                              {/* Read full article link */}
                              <Link
                                href={`/knowledge-center/articles/${faq.slug}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition hover:text-indigo-700"
                              >
                                Read full article
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Bottom Help Link */}
        {!loading && filteredFaqs.length > 0 && (
          <div className="mt-10 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/30 p-5 text-center">
            <p className="text-sm font-medium text-slate-700">
              Still have questions?
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Browse the complete Knowledge Base or contact support for personalized help.
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <Link
                href="/knowledge-center/search"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Search className="h-3.5 w-3.5" />
                Search Knowledge Base
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Contact Support
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
