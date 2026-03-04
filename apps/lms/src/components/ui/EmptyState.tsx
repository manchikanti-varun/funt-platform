"use client";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const DEFAULT_ICON = (
  <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V6a2 2 0 00-2-2h-2m-4 0H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2zm0-5.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v1.5" />
  </svg>
);

export function EmptyState({ icon = DEFAULT_ICON, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 py-16 text-center ${className}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon}</div>
      <p className="mt-4 text-base font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
