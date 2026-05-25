"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BATCH_STATUS } from "@funt-platform/constants";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { Check, Copy } from "lucide-react";
import {
  EntityActionsPanel,
  EntityDetailLoadingScreen,
  EntityDetailSection,
  EntityDetailShell,
} from "@/components/ui";

interface Batch {
  id: string;
  name: string;
  batchId?: string;
  trainerId: string;
  trainerName?: string;
  trainerUsername?: string;
  startDate: string;
  endDate?: string;
  zoomLink?: string;
  visibility?: "PUBLIC" | "PRIVATE";
  headerImageUrl?: string;
  status: string;
  courseSnapshot?: { title?: string; courseId?: string };
  courseSnapshots?: Array<{ title?: string; courseId?: string }>;
}

export default function ViewBatchPage() {
  const params = useParams();
  const id = params.id as string;
  const [batch, setBatch] = useState<Batch | null>(null);
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null);

  function buildStudentCourseLink(courseId: string): string {
    const path = `/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(id)}`;
    if (typeof window === "undefined") return path;
    const url = new URL(window.location.origin);
    if (url.hostname === "localhost" && url.port === "3000") {
      url.port = "3001";
    }
    return `${url.origin}${path}`;
  }

  async function copyCourseLink(courseId: string) {
    const link = buildStudentCourseLink(courseId);
    await navigator.clipboard.writeText(link);
    setCopiedCourseId(courseId);
    window.setTimeout(() => setCopiedCourseId((v) => (v === courseId ? null : v)), 1500);
  }

  useEffect(() => {
    if (!id) return;
    api<Batch>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) setBatch(r.data);
    });
  }, [id]);

  if (!batch) {
    return <EntityDetailLoadingScreen label="Loading batch…" />;
  }

  const courses =
    Array.isArray(batch.courseSnapshots) && batch.courseSnapshots.length > 0
      ? batch.courseSnapshots
      : batch.courseSnapshot
        ? [batch.courseSnapshot]
        : [];
  const startDateStr = typeof batch.startDate === "string" ? batch.startDate.slice(0, 10) : "";
  const endDateStr = batch.endDate && typeof batch.endDate === "string" ? batch.endDate.slice(0, 10) : "";

  return (
    <EntityDetailShell
      backHref="/batches"
      backLabel="Back to Batches"
      title={batch.name}
      description="View only. Batch access is managed here; course access is managed by payment/license per course."
      mode="view"
      viewHref={`/batches/${id}/view`}
      editHref={`/batches/${id}`}
      badges={
        <>
          {batch.batchId && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {batch.batchId}
            </span>
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
          <span
            className={
              batch.visibility === "PRIVATE"
                ? "rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800"
                : "rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800"
            }
          >
            {batch.visibility === "PRIVATE" ? "Private" : "Public"}
          </span>
        </>
      }
    >
      <EntityActionsPanel>
        <Link href={`/batches/${id}/duplicate`} className="btn-duplicate">
          <DuplicateIcon />
          Duplicate
        </Link>
        <Link
          href={`/batches/${id}/student-access`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Batch access
        </Link>
        <Link
          href={`/batches/${id}/moderators`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Moderators
        </Link>
        <Link
          href={`/batches/${id}/submissions`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Assignment submissions
        </Link>
        <Link
          href={`/batches/${id}/attendance`}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100"
        >
          Attendance
        </Link>
        <Link
          href={`/batches/${id}/certificates`}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 shadow-sm transition hover:bg-violet-100"
        >
          Certificates
        </Link>
      </EntityActionsPanel>

      <EntityDetailSection title="Basic info">
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-slate-500">Trainer</dt>
            <dd className="font-medium text-slate-800">
              {batch.trainerName ? (
                <>
                  {batch.trainerName}
                  {batch.trainerUsername ? (
                    <span className="font-normal text-slate-600"> · @{batch.trainerUsername}</span>
                  ) : null}
                </>
              ) : (
                <span className="break-all font-mono text-sm text-slate-700" title="User id">
                  {batch.trainerId}
                </span>
              )}
            </dd>
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
                <a
                  href={batch.zoomLink.startsWith("http") ? batch.zoomLink : `https://${batch.zoomLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:underline"
                >
                  {batch.zoomLink}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </EntityDetailSection>

      <EntityDetailSection title="Courses">
        <p className="mb-3 text-sm text-slate-600">
          <Link
            href={`/batches/${id}/student-access`}
            className="font-medium text-teal-700 underline decoration-teal-200 underline-offset-2 hover:text-teal-800"
          >
            Batch access
          </Link>
          <span className="text-slate-400"> · </span>
          <span className="text-slate-500">
            Batch access is a master switch. Individual course access is controlled by payment/license for each course
            in this batch.
          </span>
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Course rows below open the course context used by this batch (snapshot flow), not Global Modules.
        </p>
        {courses.length === 0 ? (
          <p className="text-sm text-slate-500">No courses in this batch.</p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
            {courses.map((c, i) => {
              const keyQs = new URLSearchParams({ batchId: id });
              if (c.courseId?.trim()) keyQs.set("courseId", c.courseId.trim());
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    {c.courseId ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/courses/${c.courseId}/view`}
                          className="text-sm font-medium text-slate-800 transition hover:text-teal-600"
                        >
                          {c.title ?? "Course"}
                        </Link>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          Snapshot
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{c.title ?? "Course"}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          Snapshot
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.courseId ? (
                      <button
                        type="button"
                        onClick={() => void copyCourseLink(c.courseId!)}
                        title={copiedCourseId === c.courseId ? "Copied" : "Copy course link"}
                        className={`inline-flex items-center justify-center rounded-lg border p-1.5 transition ${
                          copiedCourseId === c.courseId
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                        }`}
                      >
                        {copiedCourseId === c.courseId ? (
                          <Check className="h-4 w-4" aria-hidden />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    ) : null}
                    <Link
                      href={`/license-keys?${keyQs.toString()}`}
                      className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-900 transition hover:bg-violet-100"
                    >
                      License keys
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </EntityDetailSection>
    </EntityDetailShell>
  );
}
