"use client";

import type { ReactNode } from "react";
import Link from "next/link";

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
    <Link href={locked ? "#" : href} onClick={(e) => locked && e.preventDefault()} className="block h-full">
      <article
        className={`group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 cursor-pointer ${
          locked ? "opacity-80" : "hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
        }`}
      >
        {/* Image */}
        <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-indigo-100">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="line-clamp-2 text-base font-bold text-white drop-shadow-md">{title}</h3>
            {batchName && <p className="mt-0.5 line-clamp-1 text-xs text-white/80">{batchName}</p>}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {isDemo && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                Free demo
              </span>
            )}
            {statusLabel && (
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                {statusLabel}
              </span>
            )}
            {locked && <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700">Locked</span>}
          </div>
          {footerExtra}
          {actions && (
            <div className="mt-auto pt-2" onClick={(e) => e.preventDefault()}>
              {actions}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">{chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}</span>
            <span className="font-semibold text-slate-800">{locked ? "—" : `${pct}%`}</span>
          </div>
          {!locked && pct > 0 && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
