"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isTrainerOnly } from "@/lib/auth";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { MODULE_STATUS, ROLE } from "@funt-platform/constants";

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
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { RequireRoles } from "@/components/auth/RequireRoles";

export default function ViewGlobalModulePage() {
  const { roles } = useAdminUser();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [readOnly, setReadOnly] = useState(false);
  const [module, setModule] = useState<Module | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setReadOnly(isTrainerOnly(roles));
  }, [roles]);

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
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.TRAINER]} fallbackHref="/dashboard" />
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href="/global-modules">Back to Modules</BackLink>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">View only</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{module.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {readOnly ? "View only access for trainers." : "View only. Use the actions below to edit or duplicate."}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">v{module.version}</span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              Global source
            </span>
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
          {!readOnly && (
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
                <button type="button" onClick={handleDuplicate} disabled={duplicating} className="btn-duplicate">
                  {duplicating ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
                  ) : (
                    <DuplicateIcon />
                  )}
                  {duplicating ? "Duplicating…" : "Duplicate"}
                </button>
              </div>
            </section>
          )}
          {module.description && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Description</h2>
              <div className={`text-slate-700 ${RICH_TEXT_VIEW_CLASS}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(module.description) }} />
            </section>
          )}
          {module.content && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Content</h2>
              <div className={`rounded-xl border border-slate-200 bg-white p-4 text-slate-700 ${RICH_TEXT_VIEW_CLASS}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(module.content) }} />
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
