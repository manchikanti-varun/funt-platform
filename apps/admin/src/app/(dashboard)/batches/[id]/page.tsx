"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/api";
import { parseJwtPayload, isTrainerOnly } from "@/lib/auth";
import { BATCH_STATUS } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";

interface Batch {
  id: string;
  name: string;
  trainerId: string;
  startDate: string;
  endDate?: string;
  zoomLink?: string;
  status: string;
  courseSnapshot?: { title?: string; courseId?: string };
  courseSnapshots?: Array<{ title?: string; courseId?: string }>;
}

interface CourseOption {
  id: string;
  title: string;
  status: string;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

export default function EditBatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [batch, setBatch] = useState<Batch | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [name, setName] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trainerOnly, setTrainerOnly] = useState(false);
  useEffect(() => {
    setTrainerOnly(isTrainerOnly(parseJwtPayload(getToken() ?? "")?.roles));
  }, []);

  useEffect(() => {
    if (!id) return;
    api<Batch>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) {
        setBatch(r.data);
        setName(r.data.name);
        const ids = Array.isArray(r.data.courseSnapshots) && r.data.courseSnapshots.length > 0
          ? r.data.courseSnapshots.map((s) => s.courseId ?? "").filter(Boolean)
          : (r.data.courseSnapshot?.courseId ? [r.data.courseSnapshot.courseId] : []);
        setSelectedCourseIds(ids);
        setTrainerId(r.data.trainerId);
        setStartDate(r.data.startDate ? r.data.startDate.slice(0, 10) : "");
        setEndDate(r.data.endDate ? r.data.endDate.slice(0, 10) : "");
        setZoomLink(r.data.zoomLink ?? "");
      }
    });
  }, [id]);

  useEffect(() => {
    api<CourseOption[]>("/api/courses").then((r) => {
      if (r.success && Array.isArray(r.data)) setCourses(r.data.filter((c) => c.status !== "ARCHIVED"));
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await api(`/api/batches/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        courseIds: selectedCourseIds.length > 0 ? selectedCourseIds : undefined,
        trainerId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        zoomLink: zoomLink || undefined,
      }),
    });
    setLoading(false);
    if (res.success) router.push("/batches");
    else setError(res.message ?? "Failed to update.");
  }

  async function archive() {
    if (!confirm("Archive this batch? Students will no longer see it in Explore.")) return;
    const res = await api(`/api/batches/${id}/archive`, { method: "PATCH" });
    if (res.success) router.push("/batches");
    else setError(res.message ?? "Failed to archive.");
  }

  if (!batch) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading batch…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href="/batches">Back to Batches</BackLink>
          <Link
            href={`/batches/${id}/submissions`}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
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
          <Link
            href={`/batches/${id}/settings`}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm transition hover:bg-amber-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              batch.status === BATCH_STATUS.ARCHIVED ? "bg-slate-100 text-slate-600" : "bg-teal-100 text-teal-700"
            }`}
          >
            {batch.status === BATCH_STATUS.ARCHIVED ? "Archived" : "Active"}
          </span>
          {!trainerOnly && (
            <button
              type="button"
              onClick={archive}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50"
            >
              Archive batch
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Edit batch</h1>
          <p className="mt-1 text-sm text-slate-600">Update name, courses, schedule, and meeting link.</p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-8">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Basic info</h2>
            <div className="mt-3 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Batch name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q1 2025 – Full stack"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Trainer ID</label>
                <input
                  required
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value)}
                  placeholder="Trainer FUNT ID (e.g. TR-26-00001)"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Courses</h2>
            <p className="mt-1 text-sm text-slate-500">Select one or more courses included in this batch. Order is preserved.</p>
            <div className="mt-3">
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search courses…"
                className={`${INPUT_CLASS} mb-2 max-w-md`}
              />
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                {courses
                  .filter((c) => !courseSearch.trim() || c.title.toLowerCase().includes(courseSearch.trim().toLowerCase()))
                  .map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-slate-200 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(c.id)}
                        onChange={() =>
                          setSelectedCourseIds((prev) =>
                            prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-800">{c.title}</span>
                    </label>
                  ))}
              </div>
              {selectedCourseIds.length > 0 && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {selectedCourseIds.length} course{selectedCourseIds.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Schedule & meeting</h2>
            <p className="mt-1 text-sm text-slate-500">Start and end dates; optional Zoom or meeting link for students.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Start date</label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Zoom / meeting link</label>
                <input
                  type="url"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  placeholder="https://zoom.us/j/…"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
            <Link
              href="/batches"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
