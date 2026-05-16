"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isTrainerOnly } from "@/lib/auth";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { MODULE_STATUS, ROLE } from "@funt-platform/constants";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import {
  EntityActionsPanel,
  EntityDetailLoadingScreen,
  EntityDetailSection,
  EntityDetailShell,
} from "@/components/ui";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { truncateRichTextHtml } from "@/lib/truncateRichTextHtml";

interface Chapter {
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

export default function ViewGlobalChapterPage() {
  const { roles } = useAdminUser();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [readOnly, setReadOnly] = useState(false);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setReadOnly(isTrainerOnly(roles));
  }, [roles]);

  async function handleDuplicate() {
    if (!id || duplicating) return;
    setDuplicating(true);
    const res = await api<{ id: string }>(`/api/global-chapters/${id}/duplicate`, { method: "POST" });
    setDuplicating(false);
    if (res.success && res.data?.id) router.push(`/global-modules/${res.data.id}`);
  }

  useEffect(() => {
    if (!id) return;
    api<Chapter>(`/api/global-chapters/${id}`).then((r) => {
      if (r.success && r.data) setChapter(r.data);
    });
  }, [id]);

  const normalizeHtmlText = (value: string | undefined) =>
    (value ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (!chapter) {
    return <EntityDetailLoadingScreen label="Loading chapter…" />;
  }

  const normalizedDescription = normalizeHtmlText(chapter.description);
  const normalizedAutoPreview = normalizeHtmlText(truncateRichTextHtml(chapter.content, 160));
  const shouldShowDescription = Boolean(
    normalizedDescription && normalizedDescription !== normalizedAutoPreview,
  );

  return (
    <>
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.TRAINER]} fallbackHref="/dashboard" />
      <EntityDetailShell
        backHref="/global-modules"
        backLabel="Back to Chapters"
        title={chapter.title}
        description={
          readOnly
            ? "View only access for trainers. Switch to Edit when you have permission to change content."
            : "View published content and links. Switch to Edit to make changes."
        }
        mode="view"
        viewHref={`/global-modules/${id}/view`}
        editHref={`/global-modules/${id}`}
        badges={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              v{chapter.version}
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              Global source
            </span>
            <span
              className={
                chapter.status === MODULE_STATUS.ARCHIVED
                  ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  : "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              }
            >
              {chapter.status === MODULE_STATUS.ARCHIVED ? "Archived" : "Active"}
            </span>
          </>
        }
      >
        {!readOnly && (
          <EntityActionsPanel>
            <button type="button" onClick={handleDuplicate} disabled={duplicating} className="btn-duplicate">
              {duplicating ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
              ) : (
                <DuplicateIcon />
              )}
              {duplicating ? "Duplicating…" : "Duplicate"}
            </button>
          </EntityActionsPanel>
        )}
        {shouldShowDescription && (
          <EntityDetailSection title="Description">
            <div
              className={`text-slate-700 ${RICH_TEXT_VIEW_CLASS}`}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(chapter.description) }}
            />
          </EntityDetailSection>
        )}
        {chapter.content && (
          <EntityDetailSection title="Content">
            <div
              className={`rounded-xl border border-slate-200 bg-white p-4 text-slate-700 ${RICH_TEXT_VIEW_CLASS}`}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(chapter.content) }}
            />
          </EntityDetailSection>
        )}
        {(chapter.youtubeUrl || chapter.videoUrl || chapter.resourceLinkUrl) && (
          <EntityDetailSection title="Links">
            <ul className="space-y-2 text-sm">
              {chapter.youtubeUrl && (
                <li>
                  <span className="text-slate-500">YouTube:</span>{" "}
                  <a
                    href={chapter.youtubeUrl.startsWith("http") ? chapter.youtubeUrl : `https://${chapter.youtubeUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    {chapter.youtubeUrl}
                  </a>
                </li>
              )}
              {chapter.videoUrl && (
                <li>
                  <span className="text-slate-500">Video URL:</span>{" "}
                  <a
                    href={chapter.videoUrl.startsWith("http") ? chapter.videoUrl : `https://${chapter.videoUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    {chapter.videoUrl}
                  </a>
                </li>
              )}
              {chapter.resourceLinkUrl && (
                <li>
                  <span className="text-slate-500">Resource link:</span>{" "}
                  <a
                    href={
                      chapter.resourceLinkUrl.startsWith("http")
                        ? chapter.resourceLinkUrl
                        : `https://${chapter.resourceLinkUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    {chapter.resourceLinkUrl}
                  </a>
                </li>
              )}
            </ul>
          </EntityDetailSection>
        )}
        {chapter.linkedAssignmentId && (
          <EntityDetailSection title="Linked assignment">
            <Link
              href={`/global-assignments/${chapter.linkedAssignmentId}/view`}
              className="inline-block text-sm font-medium text-slate-700 transition hover:text-teal-600"
            >
              View assignment (ID: {chapter.linkedAssignmentId})
            </Link>
          </EntityDetailSection>
        )}
      </EntityDetailShell>
    </>
  );
}
