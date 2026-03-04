"use client";

import Link from "next/link";

const BACK_LINK_CLASS =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800";

const BackIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

interface BackLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function BackLink({ href, children, className = "", onClick }: BackLinkProps) {
  return (
    <Link href={href} className={`${BACK_LINK_CLASS} ${className}`} onClick={onClick}>
      <BackIcon />
      {children}
    </Link>
  );
}

export { BACK_LINK_CLASS };
