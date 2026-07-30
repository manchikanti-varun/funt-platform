"use client";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  className?: string;
}

/**
 * Consistent page header used across admin and LMS.
 * White card with subtle indigo gradient, title + optional subtitle/badge/actions.
 */
export function PageHeader({ title, subtitle, badge, actions, className = "" }: PageHeaderProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-indigo-50/40 to-slate-50/80 px-6 py-6 shadow-sm ring-1 ring-slate-100/90 sm:px-8 sm:py-7 ${className}`.trim()}>
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-200/20 blur-3xl" aria-hidden />
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
