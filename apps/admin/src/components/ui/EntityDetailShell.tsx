"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "./BackLink";
import { SquarePen, Eye } from "lucide-react";

export const ENTITY_DETAIL_CARD =
  "min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100";

export const ENTITY_DETAIL_HEADER =
  "border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6";

export const ENTITY_DETAIL_BODY = "p-6 sm:p-8 space-y-6";

export const ENTITY_SECTION_TITLE =
  "text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2";

export function EntityDetailLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <>
      <div className="spinner" />
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </>
  );
}

export function EntityDetailLoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center">
      <EntityDetailLoading label={label} />
    </div>
  );
}

type EntityDetailMode = "view" | "edit";

export function EntityModeToggle({
  mode,
  viewHref,
  editHref,
}: {
  mode: EntityDetailMode;
  viewHref: string;
  editHref: string;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 shadow-sm"
      role="tablist"
      aria-label="View or edit"
    >
      <Link
        href={viewHref}
        role="tab"
        aria-selected={mode === "view"}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
          mode === "view"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        View
      </Link>
      <Link
        href={editHref}
        role="tab"
        aria-selected={mode === "edit"}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
          mode === "edit"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <SquarePen className="h-4 w-4 shrink-0" aria-hidden />
        Edit
      </Link>
    </div>
  );
}

export function EntityActionsPanel({ title = "Actions", children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h2 className={`${ENTITY_SECTION_TITLE} mb-3`}>{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export function EntityDetailSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className={ENTITY_SECTION_TITLE}>{title}</h2>
      {children}
    </section>
  );
}

export function EntityDetailShell({
  backHref,
  backLabel,
  title,
  description,
  mode,
  viewHref,
  editHref,
  badges,
  topBar,
  headerAside,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  mode: EntityDetailMode;
  viewHref: string;
  editHref: string;
  badges?: ReactNode;
  topBar?: ReactNode;
  headerAside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <BackLink href={backHref}>{backLabel}</BackLink>
            <span
              className={
                mode === "view"
                  ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                  : "rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-teal-200/80"
              }
            >
              {mode === "view" ? "View only" : "Editing"}
            </span>
          </div>
          {topBar ? <div className="flex flex-wrap items-center gap-2">{topBar}</div> : null}
        </div>
      </div>

      <div className={ENTITY_DETAIL_CARD}>
        <header className={ENTITY_DETAIL_HEADER}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
              {badges ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <EntityModeToggle mode={mode} viewHref={viewHref} editHref={editHref} />
              {headerAside}
            </div>
          </div>
        </header>
        <div className={ENTITY_DETAIL_BODY}>{children}</div>
      </div>
    </div>
  );
}
