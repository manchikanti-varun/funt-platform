"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { MODULE_STATUS } from "@funt-platform/constants";

interface Module {
  id: string;
  title: string;
  description: string;
  content: string;
  youtubeUrl?: string;
  videoUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
  version: number;
  status: string;
}

import { BackLink } from "@/components/ui/BackLink";

export default function ViewGlobalModulePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [module, setModule] = useState<Module | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  async function handleDuplicate() {
    if (!id || duplicating) return;
    setDuplicating(true);
    const res = await api<{ id: string }>(`/api/global-modules/${id}/duplicate`, { method: "POST" });
    setDuplicating(false);
    if (res.success && res.data?.id) router.push(`/global-modules/${res.data.id}`);
  }

  useEffect(() => {
    if (!id) return;
    api<Module>(`/api/global-modules/${id}`).then((r) => {
      if (r.success && r.data) setModule(r.data);
    });
  }, [id]);

  if (!module) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href="/global-modules">Back to Modules</BackLink>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">View only</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{module.title}</h1>
          <p className="mt-1 text-sm text-slate-500">View only. Use the actions below to edit or duplicate.</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">v{module.version}</span>
            <span
              className={
                module.status === MODULE_STATUS.ARCHIVED
                  ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  : "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              }
            >
              {module.status === MODULE_STATUS.ARCHIVED ? "Archived" : "Active"}
            </span>
          </div>
        </div>
        <div className="p-6 sm:p-8 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/global-modules/${id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit module
              </Link>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                {duplicating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
                {duplicating ? "Duplicating…" : "Duplicate module"}
              </button>
            </div>
          </section>
          {module.description && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Description</h2>
              <div className="prose prose-sm max-w-none text-slate-700 [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_h1]:text-lg [&_h2]:text-base" dangerouslySetInnerHTML={{ __html: module.description }} />
            </section>
          )}
          {module.content && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Content</h2>
              <div className="rounded-xl border border-slate-200 bg-white p-4 prose prose-sm max-w-none text-slate-700 [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal" dangerouslySetInnerHTML={{ __html: module.content }} />
            </section>
          )}
          {(module.youtubeUrl || module.videoUrl || module.resourceLinkUrl) && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Links</h2>
              <ul className="space-y-2 text-sm">
                {module.youtubeUrl && (
                  <li>
                    <span className="text-slate-500">YouTube:</span>{" "}
                    <a href={module.youtubeUrl.startsWith("http") ? module.youtubeUrl : `https://${module.youtubeUrl}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{module.youtubeUrl}</a>
                  </li>
                )}
                {module.videoUrl && (
                  <li>
                    <span className="text-slate-500">Video URL:</span>{" "}
                    <a href={module.videoUrl.startsWith("http") ? module.videoUrl : `https://${module.videoUrl}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{module.videoUrl}</a>
                  </li>
                )}
                {module.resourceLinkUrl && (
                  <li>
                    <span className="text-slate-500">Resource link:</span>{" "}
                    <a href={module.resourceLinkUrl.startsWith("http") ? module.resourceLinkUrl : `https://${module.resourceLinkUrl}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{module.resourceLinkUrl}</a>
                  </li>
                )}
              </ul>
            </section>
          )}
          {module.linkedAssignmentId && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Linked assignment</h2>
              <Link
                href={`/global-assignments/${module.linkedAssignmentId}/view`}
                className="inline-block text-sm font-medium text-slate-700 transition hover:text-teal-600"
              >
                View assignment (ID: {module.linkedAssignmentId})
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
