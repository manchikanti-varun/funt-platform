"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { IconBook } from "@/components/icons/NavIcons";

// Inlined from @funt-platform/rich-text-editor to avoid pulling the full editor bundle
function resolveImageEmbedUrl(input: string, size: 220 | 400 | 800 = 800): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  try {
    const url = new URL(trimmed);
    const isDrive = url.hostname === "drive.google.com" || url.hostname === "docs.google.com";
    if (!isDrive) return trimmed;
    const byQuery = url.searchParams.get("id");
    let id = byQuery;
    if (!id) {
      const parts = url.pathname.split("/").filter(Boolean);
      const dIndex = parts.indexOf("d");
      id = dIndex >= 0 && parts[dIndex + 1] ? parts[dIndex + 1] : null;
    }
    if (!id) return trimmed;
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;
  } catch { return trimmed; }
}

interface CourseCardProps {
  href: string;
  title: string;
  batchName?: string;
  chapterCount: number;
  progressPercent?: number;
  locked?: boolean;
  imageUrl?: string;
  statusLabel?: string;
  isDemo?: boolean;
  footerExtra?: ReactNode;
  actions?: ReactNode;
}

function RingProgress({ percent }: { percent: number }) {
  const p = Math.min(100, Math.max(0, percent));
  const circumference = 2 * Math.PI * 22;
  const offset = circumference - (p / 100) * circumference;
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r="22"
          fill="none"
          stroke="#6366f1"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 ring-1 ring-white/25">
        <IconBook className="h-5 w-5 text-white" />
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
  imageUrl,
  statusLabel,
  isDemo = false,
  footerExtra,
  actions,
}: CourseCardProps) {
  const raw = imageUrl?.trim() ?? "";
  const imgSrc = raw
    ? raw.startsWith("data:image/")
      ? raw
      : resolveImageEmbedUrl(raw, 800)
    : "";
  const pct = locked ? 0 : progressPercent;

  return (
    <article
      className={`group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 ${
        locked ? "opacity-80" : "hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
      }`}
    >
      <div className="relative h-32 w-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-indigo-100">
        {imgSrc ? (
          <img src={imgSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <IconBook className="h-12 w-12 text-slate-400/80" aria-hidden />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-bold text-white drop-shadow-sm">{title}</h3>
            {batchName ? <p className="mt-0.5 line-clamp-1 text-xs text-white/85">{batchName}</p> : null}
          </div>
          <RingProgress percent={pct} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        {isDemo ? (
          <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            Free demo
          </span>
        ) : null}
        {statusLabel ? (
          <span className="w-fit rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
            {statusLabel}
          </span>
        ) : null}
        {locked ? <p className="text-xs font-semibold text-red-700">Access disabled</p> : null}
        {footerExtra}
        {actions ?? (
          <Link
            href={locked ? "#" : href}
            onClick={(e) => locked && e.preventDefault()}
            className={
              locked
                ? "inline-flex w-fit rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900"
                : "inline-flex w-fit rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500"
            }
          >
            {locked ? "View status" : "Open"}
          </Link>
        )}
      </div>

      <div className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50 px-3.5 py-2.5">
        <span className="text-xs font-medium text-slate-600">
          {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
        </span>
        <span className="text-xs font-semibold text-slate-800">{locked ? "—" : `${pct}% complete`}</span>
      </div>
    </article>
  );
}
