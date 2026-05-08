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
    <div className="lms-state-wrap">
      <div className={`lms-state-card ${isLoading ? "lms-state-card--loading" : "lms-state-card--error"}`}>
        <span className="lms-state-glow lms-state-glow--one" />
        <span className="lms-state-glow lms-state-glow--two" />
        <span className="lms-state-shimmer" />

        <div className={`lms-state-icon ${isLoading ? "lms-state-icon--loading" : "lms-state-icon--error"}`}>
          {isLoading ? (
            <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#d6be74] border-t-[#9f7a12]" />
          ) : (
            <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.1 14.04A1 1 0 003.05 20h17.9a1 1 0 00.86-1.5l-8.1-14.04a1 1 0 00-1.72 0z" />
            </svg>
          )}
        </div>

        <h2 className="mt-5 text-xl font-extrabold tracking-tight text-black">{title}</h2>
        <p className="mt-1.5 max-w-md text-sm text-black/70">{description}</p>

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
