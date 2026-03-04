"use client";

import Link from "next/link";
import { IconBook } from "@/components/icons/NavIcons";

const COURSE_CARD_BORDERS = {
  violet: "border border-violet-200 ring-1 ring-violet-100",
  teal: "border border-teal-200 ring-1 ring-teal-100",
  amber: "border border-amber-200 ring-1 ring-amber-100",
  sky: "border border-sky-200 ring-1 ring-sky-100",
};

interface CourseCardProps {
  href: string;
  title: string;
  batchName: string;
  moduleCount: number;
  status: string;
  variant?: keyof typeof COURSE_CARD_BORDERS;
}

export function CourseCard({
  href,
  title,
  batchName,
  moduleCount,
  status,
  variant = "violet",
}: CourseCardProps) {
  const borderClass = COURSE_CARD_BORDERS[variant];
  return (
    <Link
      href={href}
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl ${borderClass} bg-white shadow-lg shadow-slate-200/25 ring-1 ring-slate-100/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/30 hover:ring-slate-200/80`}
    >
      {}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 shadow-inner ring-1 ring-slate-200/60">
          <IconBook className="h-5 w-5 text-slate-600" />
        </div>
        <h3 className="mt-3 line-clamp-2 text-center text-sm font-bold text-slate-900">
          {title}
        </h3>
        {batchName && (
          <p className="mt-1 line-clamp-1 text-center text-xs text-slate-500">
            {batchName}
          </p>
        )}
      </div>

      {}
      <div className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 ring-1 ring-slate-100/80 ring-inset">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {moduleCount} modules
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {status}
        </span>
      </div>
    </Link>
  );
}
