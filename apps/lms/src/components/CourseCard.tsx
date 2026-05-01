"use client";

import Link from "next/link";
import { IconBook } from "@/components/icons/NavIcons";

interface CourseCardProps {
  href: string;
  title: string;
  batchName: string;
  chapterCount: number;
  progressPercent?: number;
  locked?: boolean;
}

function RingProgress({ percent }: { percent: number }) {
  const p = Math.min(100, Math.max(0, percent));
  const circumference = 2 * Math.PI * 22;
  const offset = circumference - (p / 100) * circumference;
  return (
    <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r="22"
          fill="none"
          stroke="#f5c400"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-black/[0.04] ring-1 ring-black/10">
        <IconBook className="h-5 w-5 text-funt-ink" />
      </div>
    </div>
  );
}

export function CourseCard({
  href,
  title,
  batchName,
  chapterCount,
  progressPercent = 0,
  locked = false,
}: CourseCardProps) {
  return (
    <Link
      href={locked ? "#" : href}
      onClick={(e) => locked && e.preventDefault()}
      className={`group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-md shadow-black/5 ring-1 ring-black/5 transition duration-200 ${
        locked ? "cursor-not-allowed opacity-70" : "hover:-translate-y-1 hover:border-funt-gold/40 hover:shadow-xl"
      }`}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-5">
        <RingProgress percent={locked ? 0 : progressPercent} />
        <div className="text-center">
          <h3 className="line-clamp-2 text-sm font-bold text-funt-ink">{title}</h3>
          {batchName && <p className="mt-1 line-clamp-1 text-xs text-black/50">{batchName}</p>}
          {locked && <p className="mt-2 text-xs font-semibold text-red-700">Access disabled</p>}
        </div>
      </div>
      <div className="flex w-full items-center justify-between border-t border-black/5 bg-gradient-to-r from-black/[0.02] via-funt-honey/20 to-black/[0.02] px-4 py-3">
        <span className="text-xs font-medium text-black/70">
          {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
        </span>
        <span className="text-xs font-semibold text-funt-ink">{locked ? "—" : `${progressPercent}% complete`}</span>
      </div>
    </Link>
  );
}
