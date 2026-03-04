"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface CourseOption {
  id: string;
  title: string;
  description?: string;
  status: string;
}

import { BackLink } from "@/components/ui/BackLink";

export default function NewBatchPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CourseOption[]>("/api/courses").then((r) => {
      if (r.success && Array.isArray(r.data)) setCourses(r.data.filter((c) => c.status !== "ARCHIVED"));
    });
  }, []);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  function toggleCourse(id: string) {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selectedCourseIds.length === 0) {
      setError("Select at least one course.");
      return;
    }
    setLoading(true);
    try {
      const res = await api("/api/batches", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          courseIds: selectedCourseIds,
          trainerId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          zoomLink: zoomLink || undefined,
        }),
      });
      if (!res.success) {
        setError(res.message ?? "Failed to create batch.");
        setLoading(false);
        return;
      }
      router.push("/batches");
    } catch {
      setError("Failed to create batch.");
    } finally {
      setLoading(false);
    }
  }

  const selectedCourses = selectedCourseIds
    .map((id) => courses.find((c) => c.id === id))
    .filter(Boolean) as CourseOption[];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-6">
        <BackLink href="/batches">Back to Batches</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">New Batch</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create one batch with one or more courses. Students enrolled in this batch will see all selected courses.
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-1 max-w-2xl">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Batch Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="e.g. Robotics Jan 2025"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Trainer FUNT ID</label>
              <input
                required
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="e.g. TR-26-00001"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Start Date</label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Zoom Link</label>
              <input
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Courses</h3>
            <p className="mt-1 text-sm text-slate-600">
              Select one or more courses to include in this batch. Students enrolled in the batch will get access to all selected courses.
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search courses by title or description…"
                className="mb-3 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <div className="min-h-0 max-h-72 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                {filteredCourses.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">
                    {courseSearch.trim()
                      ? "No courses match your search."
                      : "No non-archived courses available. Create courses first."}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredCourses.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white">
                          <input
                            type="checkbox"
                            checked={selectedCourseIds.includes(c.id)}
                            onChange={() => toggleCourse(c.id)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm font-medium text-slate-800">{c.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {selectedCourseIds.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Selected ({selectedCourses.length}) course{selectedCourses.length !== 1 ? "s" : ""} in this batch
                </p>
                <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  {selectedCourses.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-slate-800">{c.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleCourse(c.id)}
                        className="text-xs font-medium text-slate-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            <button
              type="submit"
              disabled={loading || selectedCourseIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating batch…
                </>
              ) : (
                "Create Batch"
              )}
            </button>
            <Link
              href="/batches"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
