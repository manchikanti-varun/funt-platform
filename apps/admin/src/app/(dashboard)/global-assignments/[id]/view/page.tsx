"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { ASSIGNMENT_STATUS } from "@funt-platform/constants";
import {
  EntityActionsPanel,
  EntityDetailLoadingScreen,
  EntityDetailSection,
  EntityDetailShell,
} from "@/components/ui";

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  submissionType: string;
  skillTags: string[];
  status: string;
  type?: string;
  moderatorIds?: string[];
}

export default function ViewGlobalAssignmentPage() {
  const params = useParams();
  const id = params.id as string;
  const [assignment, setAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Assignment>(`/api/global-assignments/${id}`).then((r) => {
      if (r.success && r.data) setAssignment(r.data);
    });
  }, [id]);

  if (!assignment) {
    return <EntityDetailLoadingScreen label="Loading assignment…" />;
  }

  return (
    <EntityDetailShell
      backHref="/global-assignments"
      backLabel="Back to Assignments"
      title={assignment.title}
      description="View only. Use the actions below to manage access or review submissions."
      mode="view"
      viewHref={`/global-assignments/${id}/view`}
      editHref={`/global-assignments/${id}`}
      badges={
        <>
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
            Global source
          </span>
          <span
            className={
              assignment.status === ASSIGNMENT_STATUS.ARCHIVED
                ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
            }
          >
            {assignment.status === ASSIGNMENT_STATUS.ARCHIVED ? "Archived" : "Active"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {assignment.type === "general" ? "General" : "Module"}
          </span>
          <span className="text-sm text-slate-600">Submission: {assignment.submissionType}</span>
        </>
      }
    >
      <EntityActionsPanel>
        {assignment.type === "general" && (
          <>
            <Link
              href={`/global-assignments/${id}/student-access`}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Student access
            </Link>
            <Link
              href={`/global-assignments/${id}/submissions`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Submissions
            </Link>
          </>
        )}
        <Link
          href={`/global-assignments/${id}/moderators`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Moderators
        </Link>
      </EntityActionsPanel>
      {assignment.instructions && (
        <EntityDetailSection title="Instructions">
          <div
            className={`rounded-xl border border-slate-200 bg-white p-4 text-slate-700 [&_.ql-cursor]:hidden ${RICH_TEXT_VIEW_CLASS}`}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.instructions) }}
          ></div>
        </EntityDetailSection>
      )}
      {assignment.skillTags && assignment.skillTags.length > 0 && (
        <EntityDetailSection title="Skill tags">
          <p className="text-sm text-slate-700">{(assignment.skillTags as string[]).join(", ")}</p>
        </EntityDetailSection>
      )}
    </EntityDetailShell>
  );
}
