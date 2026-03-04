"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { COURSE_STATUS } from "@funt-platform/constants";

interface CourseModule {
  title: string;
  order: number;
  originalGlobalModuleId?: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  modules: CourseModule[];
  version: number;
  status: string;
}

import { BackLink } from "@/components/ui/BackLink";

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
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const sortedModules = [...(course.modules ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href="/courses">Back to Courses</BackLink>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">View only</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{course.title}</h1>
          <p className="mt-1 text-sm text-slate-500">View only. Use the actions below to edit or duplicate.</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">v{course.version}</span>
            <span
              className={
                course.status === COURSE_STATUS.ARCHIVED
                  ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
              }
            >
              {course.status === COURSE_STATUS.ARCHIVED ? "Archived" : "Active"}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/courses/${id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit course
              </Link>
              <Link
                href={`/courses/${id}/duplicate`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicate course
              </Link>
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Description</h2>
            <div className="prose prose-sm max-w-none text-slate-700 [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_h1]:text-lg [&_h2]:text-base" dangerouslySetInnerHTML={{ __html: course.description ?? "" }} />
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Modules ({sortedModules.length})</h2>
            <ul className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-200">
              {sortedModules.map((m, i) => (
                <li key={i}>
                  {m.originalGlobalModuleId ? (
                    <Link
                      href={`/global-modules/${m.originalGlobalModuleId}/view`}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100 hover:text-teal-600"
                    >
                      <span className="font-medium text-slate-500 w-6">{i + 1}.</span>
                      {m.title}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-800">
                      <span className="font-medium text-slate-500 w-6">{i + 1}.</span>
                      {m.title}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
