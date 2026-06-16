"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { COURSE_STATUS } from "@funt-platform/constants";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { courseCardImagePreviewSrc } from "@/lib/courseCardImage";
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
  headerImageUrl?: string;
  deliveryMode?: string;
  learningPlan?: {
    enabled: boolean;
    autoLockPreviousMilestones: boolean;
    milestones: Array<{
      milestoneId: string;
      title: string;
      order: number;
      feeInPaise: number;
      unlockType: string;
      completionRule: string;
      chapterOrders: number[];
      certificateEligible: boolean;
      active: boolean;
    }>;
  };
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
  const cardImageSrc = courseCardImagePreviewSrc(course.headerImageUrl);

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
          {course.deliveryMode === "LEARNING_PLAN" && (
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              Learning Plan
            </span>
          )}
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

      {cardImageSrc ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <img src={cardImageSrc} alt={`${course.title} card`} className="h-40 w-full object-cover" />
        </div>
      ) : null}
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

      {/* Learning Plan milestones */}
      {course.deliveryMode === "LEARNING_PLAN" && course.learningPlan?.enabled && (
        <EntityDetailSection title={`Learning Plan — Milestones (${course.learningPlan.milestones.filter((m) => m.active).length})`}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal-800">
                Total: ₹{(course.learningPlan.milestones.filter((m) => m.active).reduce((s, m) => s + m.feeInPaise, 0) / 100).toLocaleString("en-IN")}
              </span>
              {course.learningPlan.autoLockPreviousMilestones && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Auto-lock previous</span>
              )}
            </div>
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
              {[...course.learningPlan.milestones].filter((m) => m.active).sort((a, b) => a.order - b.order).map((m, i) => (
                <li key={m.milestoneId} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {m.chapterOrders.length} chapter{m.chapterOrders.length !== 1 ? "s" : ""} · {m.unlockType.replace(/_/g, " ").toLowerCase()} · {m.completionRule.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {m.feeInPaise > 0 ? `₹${(m.feeInPaise / 100).toLocaleString("en-IN")}` : "Free"}
                    </span>
                    {m.certificateEligible && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Cert</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3">
            <Link
              href={`/courses/${id}/learning-plan`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition"
            >
              Edit Learning Plan
            </Link>
          </div>
        </EntityDetailSection>
      )}
    </EntityDetailShell>
  );
}
