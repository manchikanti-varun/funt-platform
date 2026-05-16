"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { COURSE_STATUS } from "@funt-platform/constants";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import {
  EntityActionsPanel,
  EntityDetailLoadingScreen,
  EntityDetailSection,
  EntityDetailShell,
} from "@/components/ui";

interface CourseModule {
  title: string;
  order: number;
  originalGlobalModuleId?: string;
  xpReward?: number;
}

interface Course {
  id: string;
  courseId?: string;
  title: string;
  description: string;
  durationText?: string;
  modules: CourseModule[];
  version: number;
  status: string;
}

export default function ViewCoursePage() {
  const params = useParams();
  const id = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Course>(`/api/courses/${id}`).then((r) => {
      if (r.success && r.data) setCourse(r.data);
    });
  }, [id]);

  if (!course) {
    return <EntityDetailLoadingScreen label="Loading course…" />;
  }

  const sortedModules = [...(course.modules ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sanitizedDescription = sanitizeHtml(course.description ?? "");

  return (
    <EntityDetailShell
      backHref="/courses"
      backLabel="Back to Courses"
      title={course.title}
      description="View only. License keys and cohort access are managed from each batch."
      mode="view"
      viewHref={`/courses/${id}/view`}
      editHref={`/courses/${id}`}
      badges={
        <>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            v{course.version}
          </span>
          <span
            className={
              course.status === COURSE_STATUS.ARCHIVED
                ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
            }
          >
            {course.status === COURSE_STATUS.ARCHIVED ? "Archived" : "Active"}
          </span>
        </>
      }
    >
      <EntityActionsPanel>
        <Link href={`/courses/${id}/duplicate`} className="btn-duplicate">
          <DuplicateIcon />
          Duplicate
        </Link>
      </EntityActionsPanel>

      <EntityDetailSection title="Description">
        <div
          className={`text-slate-700 ${RICH_TEXT_VIEW_CLASS}`}
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      </EntityDetailSection>
      <EntityDetailSection title="Duration">
        <p className="text-sm font-medium text-slate-800">{(course.durationText ?? "").trim() || "Not set"}</p>
      </EntityDetailSection>
      <EntityDetailSection title={`Chapters (${sortedModules.length})`}>
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
          {sortedModules.map((m, i) => (
            <li key={i}>
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-800">
                <span className="w-6 font-medium text-slate-500">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  {Math.max(0, Math.floor(Number(m.xpReward ?? 40)))} XP
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  Snapshot
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          These are course snapshots. Switch to Edit to change chapter copies for this course, not Global Chapters.
        </p>
      </EntityDetailSection>
    </EntityDetailShell>
  );
}
