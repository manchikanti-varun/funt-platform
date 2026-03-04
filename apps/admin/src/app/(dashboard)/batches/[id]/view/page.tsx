"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BATCH_STATUS } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";

interface Batch {
  id: string;
  name: string;
  batchId?: string;
  trainerId: string;
  startDate: string;
  endDate?: string;
  zoomLink?: string;
  status: string;
  courseSnapshot?: { title?: string; courseId?: string };
  courseSnapshots?: Array<{ title?: string; courseId?: string }>;
}

export default function ViewBatchPage() {
  const params = useParams();
  const id = params.id as string;
  const [batch, setBatch] = useState<Batch | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Batch>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) setBatch(r.data);
    });
  }, [id]);

  if (!batch) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const courses = Array.isArray(batch.courseSnapshots) && batch.courseSnapshots.length > 0
    ? batch.courseSnapshots
    : batch.courseSnapshot
      ? [batch.courseSnapshot]
      : [];
  const startDateStr = typeof batch.startDate === "string" ? batch.startDate.slice(0, 10) : "";
  const endDateStr = batch.endDate && typeof batch.endDate === "string" ? batch.endDate.slice(0, 10) : "";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href="/batches">Back to Batches</BackLink>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">View only</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{batch.name}</h1>
          <p className="mt-1 text-sm text-slate-500">View only. Use the actions below to edit, manage access, or review submissions.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {batch.batchId && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{batch.batchId}</span>
            )}
            <span
              className={
                batch.status === BATCH_STATUS.ARCHIVED
                  ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
              }
            >
              {batch.status === BATCH_STATUS.ARCHIVED ? "Archived" : "Active"}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/batches/${id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit batch
              </Link>
              <Link
                href={`/batches/${id}/duplicate`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicate batch
              </Link>
              <Link
                href={`/batches/${id}/student-access`}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm transition hover:bg-amber-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Student access
              </Link>
              <Link
                href={`/batches/${id}/enrollment-requests`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Enrollment requests
              </Link>
              <Link
                href={`/batches/${id}/moderators`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Moderators
              </Link>
              <Link
                href={`/batches/${id}/submissions`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Assignment submissions
              </Link>
              <Link
                href={`/batches/${id}/attendance`}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Attendance
              </Link>
              <Link
                href={`/batches/${id}/certificates`}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 shadow-sm transition hover:bg-violet-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Certificates
              </Link>
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Basic info</h2>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-slate-500">Trainer ID</dt>
                <dd className="font-medium text-slate-800">{batch.trainerId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Start date</dt>
                <dd className="font-medium text-slate-800">{startDateStr || "—"}</dd>
              </div>
              {endDateStr && (
                <div>
                  <dt className="text-slate-500">End date</dt>
                  <dd className="font-medium text-slate-800">{endDateStr}</dd>
                </div>
              )}
              {batch.zoomLink && (
                <div>
                  <dt className="text-slate-500">Zoom / meeting link</dt>
                  <dd>
                    <a href={batch.zoomLink.startsWith("http") ? batch.zoomLink : `https://${batch.zoomLink}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{batch.zoomLink}</a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Courses</h2>
            {courses.length === 0 ? (
              <p className="text-sm text-slate-500">No courses in this batch.</p>
            ) : (
              <ul className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-200">
                {courses.map((c, i) => (
                  <li key={i}>
                    {c.courseId ? (
                      <Link
                        href={`/courses/${c.courseId}/view`}
                        className="block px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100 hover:text-teal-600"
                      >
                        {c.title ?? "Course"}
                      </Link>
                    ) : (
                      <span className="block px-4 py-3 text-sm font-medium text-slate-800">{c.title ?? "Course"}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
