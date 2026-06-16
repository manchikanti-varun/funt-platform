"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { HelpCircle, X, FileText, ChevronRight } from "lucide-react";

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  type: string;
}

interface ContextHelpButtonProps {
  /** Category to filter articles for this context */
  category: string;
  /** Optional label displayed on hover */
  label?: string;
}

/**
 * Context-aware help button that shows relevant articles for the current page.
 * Place this on any page and pass the relevant category to display
 * contextual documentation without leaving the page.
 */
export function ContextHelpButton({ category, label = "Help" }: ContextHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api<{ articles: HelpArticle[] }>(`/api/knowledge/articles?category=${category}&limit=8`)
      .then((res) => {
        if (res.success && res.data) {
          const data = res.data;
          setArticles(Array.isArray(data) ? data : data.articles ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [open, category]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        title={label}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Related Help</h3>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
              </div>
            ) : articles.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">No help articles available for this section.</p>
            ) : (
              <div className="space-y-1">
                {articles.map((a) => (
                  <Link
                    key={a.id}
                    href={`/knowledge-center/articles/${a.slug}`}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition hover:bg-indigo-50"
                    onClick={() => setOpen(false)}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700 group-hover:text-indigo-700">{a.title}</p>
                      {a.summary && <p className="mt-0.5 truncate text-[10px] text-slate-400">{a.summary}</p>}
                    </div>
                    <ChevronRight className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-indigo-500" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-2.5">
            <Link
              href={`/knowledge-center/search?category=${category}`}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              onClick={() => setOpen(false)}
            >
              Browse all {label} articles →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
