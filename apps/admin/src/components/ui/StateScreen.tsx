"use client";

import Link from "next/link";

type StateTone = "loading" | "error";

interface StateScreenProps {
  tone: StateTone;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function StateScreen({
  tone,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: StateScreenProps) {
  const isLoading = tone === "loading";

  return (
    <div className="state-screen-wrap">
      <div className={`state-screen-card ${isLoading ? "state-screen-card--loading" : "state-screen-card--error"}`}>
        <div className="state-screen-orb state-screen-orb--one" />
        <div className="state-screen-orb state-screen-orb--two" />
        <div className={`state-screen-icon ${isLoading ? "state-screen-icon--loading" : "state-screen-icon--error"}`}>
          {isLoading ? (
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-200 border-t-indigo-600" />
          ) : (
            <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.1 14.04A1 1 0 003.05 20h17.9a1 1 0 00.86-1.5l-8.1-14.04a1 1 0 00-1.72 0z" />
            </svg>
          )}
        </div>
        <h2 className="mt-5 text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="mt-6 btn-primary">
            {actionLabel}
          </button>
        )}
        {actionLabel && actionHref && !onAction && (
          <Link href={actionHref} className="mt-6 btn-primary">
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
