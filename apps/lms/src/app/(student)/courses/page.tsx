"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface MyCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  moduleCount: number;
  batchId: string;
}

interface ExploreCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  moduleCount: number;
  batchId: string;
}

function filterBySearch<T>(
  items: T[],
  query: string,
  getTitle: (item: T) => string,
  getSubtitle?: (item: T) => string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const title = getTitle(item).toLowerCase();
    const subtitle = getSubtitle ? getSubtitle(item).toLowerCase() : "";
    return title.includes(q) || subtitle.includes(q);
  });
}

export default function CoursesPage() {
  const [myCoursesList, setMyCoursesList] = useState<MyCourse[]>([]);
  const [exploreCoursesList, setExploreCoursesList] = useState<ExploreCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [exploreError, setExploreError] = useState<string | null>(null);

  useEffect(() => {
    setExploreError(null);
    Promise.all([
      api<MyCourse[]>("/api/student/courses").then((r) =>
        r.success && Array.isArray(r.data) ? r.data : []
      ),
      api<ExploreCourse[]>("/api/student/courses/explore").then((r) => {
        if (!r.success) {
          setExploreError(r.message ?? "Failed to load courses");
          return [];
        }
        return Array.isArray(r.data) ? r.data : [];
      }),
    ])
      .then(([myList, exploreList]) => {
        setMyCoursesList(myList);
        setExploreCoursesList(exploreList);
      })
      .catch((err) => {
        setExploreError(err?.message ?? "Failed to load courses");
      })
      .finally(() => setLoading(false));
  }, []);

  const myCourses = useMemo(
    () =>
      filterBySearch(
        myCoursesList,
        searchQuery,
        (c) => c.courseTitle,
        (c) => c.description ?? ""
      ),
    [myCoursesList, searchQuery]
  );

  const exploreCourses = useMemo(
    () =>
      filterBySearch(
        exploreCoursesList,
        searchQuery,
        (c) => c.courseTitle,
        (c) => c.description ?? ""
      ),
    [exploreCoursesList, searchQuery]
  );

  const [activeTab, setActiveTab] = useState<"my" | "explore">("my");

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Learning</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Courses</h1>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/15"
          />
        </div>
      </div>

      {}
      <div className="shrink-0 flex gap-1 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-1.5 shadow-lg shadow-slate-200/15 ring-1 ring-slate-100/80">
        <button
          type="button"
          onClick={() => setActiveTab("my")}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 ${
            activeTab === "my"
              ? "bg-white text-slate-900 shadow-lg shadow-slate-200/25 ring-1 ring-slate-200/80"
              : "text-slate-600 hover:bg-white/80 hover:text-slate-800 hover:ring-1 hover:ring-slate-200/60"
          }`}
        >
          Courses
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("explore")}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 ${
            activeTab === "explore"
              ? "bg-white text-slate-900 shadow-lg shadow-slate-200/25 ring-1 ring-slate-200/80"
              : "text-slate-600 hover:bg-white/80 hover:text-slate-800 hover:ring-1 hover:ring-slate-200/60"
          }`}
        >
          Explore courses
        </button>
      </div>

      {}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/25 ring-1 ring-slate-100/80 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
        {activeTab === "my" ? (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-teal-600">Enrolled</p>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">Courses</h2>
            </div>
            {myCourses.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white p-10 shadow-inner ring-1 ring-slate-100/80">
                <p className="text-sm text-slate-500">
                  {searchQuery.trim()
                    ? "No enrolled courses match your search."
                    : "You are not enrolled in any course yet. Switch to Explore courses or request enrollment."}
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Course</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Modules</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Status</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myCourses.map((c) => (
                      <tr key={c.courseId} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-3.5 font-medium text-slate-800">{c.courseTitle}</td>
                        <td className="px-6 py-3.5 text-slate-600">{c.moduleCount}</td>
                        <td className="px-6 py-3.5">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Enrolled</span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 ring-1 ring-teal-700/30 transition duration-200 hover:bg-teal-700 hover:shadow-xl"
                          >
                            Open
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Browse</p>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">Explore courses</h2>
              <p className="mt-1 text-xs text-slate-500">All courses from the platform, including those you are not enrolled in.</p>
            </div>
            {exploreError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-10">
                <p className="text-sm font-medium text-amber-800">Could not load explore courses</p>
                <p className="text-xs text-amber-700">{exploreError}</p>
                <p className="text-xs text-slate-500">Check that the backend is running and you are logged in.</p>
              </div>
            ) : exploreCourses.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white p-10 shadow-inner ring-1 ring-slate-100/80">
                <p className="text-sm text-slate-500">
                  {searchQuery.trim()
                    ? "No courses match your search."
                    : "No courses in the platform yet."}
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Course</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Modules</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Status</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exploreCourses.map((c) => (
                      <tr key={c.courseId} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-3.5 font-medium text-slate-800">{c.courseTitle}</td>
                        <td className="px-6 py-3.5 text-slate-600">{c.moduleCount}</td>
                        <td className="px-6 py-3.5">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Explore</span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-md ring-1 ring-slate-100/80 transition duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-lg"
                          >
                            Open
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
