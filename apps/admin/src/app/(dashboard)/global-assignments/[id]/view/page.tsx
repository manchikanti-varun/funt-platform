"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ASSIGNMENT_STATUS } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";

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
          <BackLink href="/global-assignments">Back to Assignments</BackLink>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">View only</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{assignment.title}</h1>
          <p className="mt-1 text-sm text-slate-500">View only. Use the actions below to edit, manage access, or review submissions.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
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
          </div>
        </div>
        <div className="p-6 sm:p-8 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/global-assignments/${id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit assignment
              </Link>
              {assignment.type === "general" && (
                <>
                  <Link
                    href={`/global-assignments/${id}/student-access`}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm transition hover:bg-amber-100"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Student access
                  </Link>
                  <Link
                    href={`/global-assignments/${id}/submissions`}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Moderators
              </Link>
            </div>
          </section>
          {assignment.instructions && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Instructions</h2>
              <div className="rounded-xl border border-slate-200 bg-white p-4 prose prose-sm max-w-none text-slate-700 [&_.ql-cursor]:hidden [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal" dangerouslySetInnerHTML={{ __html: assignment.instructions }} />
            </section>
          )}
          {assignment.skillTags && assignment.skillTags.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Skill tags</h2>
              <p className="text-sm text-slate-700">{(assignment.skillTags as string[]).join(", ")}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
