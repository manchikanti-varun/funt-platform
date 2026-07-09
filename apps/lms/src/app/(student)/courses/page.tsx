"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, clearToken } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { CourseCard } from "@/components/CourseCard";
import { CreditCard, ExternalLink, Eye, Search } from "lucide-react";

interface MyCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  chapterCount?: number;
  moduleCount: number;
  batchId: string;
  accessBlocked?: boolean;
  progressPercent?: number;
  courseHeaderImageUrl?: string;
  isDemo?: boolean;
}

interface ExploreCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  chapterCount?: number;
  moduleCount: number;
  batchId: string;
  enrollmentPriceInPaise?: number;
  paymentOptionsLabel?: string;
  courseHeaderImageUrl?: string;
  isDemo?: boolean;
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

function dedupeMyCoursesByCourseId(items: MyCourse[]): MyCourse[] {
  const byCourseId = new Map<string, MyCourse>();
  for (const item of items) {
    const key = String(item.courseId ?? "").trim();
    if (!key) continue;
    const prev = byCourseId.get(key);
    if (!prev) {
      byCourseId.set(key, item);
      continue;
    }
    if (!!prev.accessBlocked && !item.accessBlocked) {
      byCourseId.set(key, item);
    }
  }
  return Array.from(byCourseId.values());
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
    () => {
      const filtered = filterBySearch(
        myCoursesList,
        searchQuery,
        (c) => c.courseTitle,
        (c) => c.description ?? ""
      );
      return dedupeMyCoursesByCourseId(filtered);
    },
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

  const enrolledKeySet = useMemo(() => {
    return new Set(
      myCoursesList.map((c) => `${String(c.courseId).trim()}::${String(c.batchId).trim()}`)
    );
  }, [myCoursesList]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <AppPageShell className="flex flex-col gap-5">
      <div className="page-hero flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Learning</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Courses</h1>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="h-5 w-5" aria-hidden />
          </span>
          <input
            type="search"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-funt-gold focus:outline-none focus:ring-2 focus:ring-funt-gold/25"
          />
        </div>
      </div>

      {/* Enrolled Courses */}
      <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">My Courses</h2>
        </div>
        {myCourses.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white p-10 shadow-inner ring-1 ring-slate-100/80">
            <p className="text-sm text-slate-500">
              {searchQuery.trim()
                ? "No enrolled courses match your search."
                : "You are not enrolled in any course yet. Scroll down to explore available courses."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {myCourses.map((c) => (
              <CourseCard
                key={`${c.courseId}::${c.batchId}`}
                href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                title={c.courseTitle}
                chapterCount={c.chapterCount ?? c.moduleCount}
                progressPercent={c.progressPercent ?? 0}
                locked={!!c.accessBlocked}
                imageUrl={c.courseHeaderImageUrl}
                statusLabel={c.accessBlocked ? "Blocked by admin" : "Enrolled"}
                isDemo={!!c.isDemo}
              />
            ))}
          </div>
        )}
      </DataPanel>

      {/* Explore Courses */}
      <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Browse</p>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">Explore Courses</h2>
          <p className="mt-1 text-xs text-slate-500">All courses from the platform, including those you are not enrolled in.</p>
        </div>
        {exploreError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-10 text-center">
            <p className="text-sm font-medium text-amber-800">Could not load explore courses</p>
            <p className="text-xs text-amber-700">{exploreError}</p>
            {/insufficient role|forbidden/i.test(exploreError) ? (
              <div className="max-w-md space-y-2 text-xs text-amber-950">
                <p>
                  FUNT Learn only works with a <strong>student</strong> account. If you used an Admin / Trainer login (@funt), open the{" "}
                  <strong>Admin</strong> site instead, or log out here and sign in as a student.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    clearToken();
                    window.location.href = "/login";
                  }}
                  className="rounded-lg bg-amber-200 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-300"
                >
                  Log out and try again
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Check that the backend is running and you are logged in.</p>
            )}
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
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {exploreCourses.map((c) => {
              const enrolled = enrolledKeySet.has(`${String(c.courseId).trim()}::${String(c.batchId).trim()}`);
              const feeLabel =
                c.enrollmentPriceInPaise && c.enrollmentPriceInPaise > 0
                  ? `₹${(c.enrollmentPriceInPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                  : "—";
              return (
                <CourseCard
                  key={`${c.courseId}::${c.batchId}`}
                  href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                  title={c.courseTitle}
                  chapterCount={c.chapterCount ?? c.moduleCount}
                  imageUrl={c.courseHeaderImageUrl}
                  statusLabel={enrolled ? "Enrolled" : "Explore"}
                  isDemo={!!c.isDemo}
                  footerExtra={
                    <p className="text-xs text-slate-600">
                      {c.isDemo ? "Free demo · no payment" : `Fee: ${feeLabel}`}
                    </p>
                  }
                  actions={
                    enrolled ? (
                      <Link
                        href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
                        title="Open course"
                        aria-label="Open course"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Open
                      </Link>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          title="Course details"
                          aria-label="View course details"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Details
                        </Link>
                        <Link
                          href={`/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
                          title="Pay"
                          aria-label="Pay for course"
                        >
                          <CreditCard className="h-3.5 w-3.5" aria-hidden />
                          Pay
                        </Link>
                      </div>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
