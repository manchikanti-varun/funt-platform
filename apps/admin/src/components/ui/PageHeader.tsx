"use client";

import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, backHref, backLabel, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel ?? "Back"}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
