"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, clearToken } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { Compass, CreditCard, ExternalLink, Eye, GraduationCap, LayoutGrid, Search, Table2 } from "lucide-react";

interface MyCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  chapterCount?: number;
  moduleCount: number;
  batchId: string;
  accessBlocked?: boolean;
  courseHeaderImageUrl?: string;
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
}

function randomPlaceholderImage(seed: string): string {
  const safeSeed = encodeURIComponent(seed || "course");
  return `https://picsum.photos/seed/${safeSeed}/960/420`;
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
    // Prefer an unblocked row when duplicates exist for same course.
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

  const [activeTab, setActiveTab] = useState<"my" | "explore">("my");
  const [layout, setLayout] = useState<"table" | "cards">("cards");

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold-deep" />
      </div>
    );
  }

  return (
    <AppPageShell className="flex flex-col gap-3">
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

      {}
      <div className="shrink-0 flex items-center gap-2 rounded-2xl border border-black/10 bg-white/90 p-1.5 shadow-md shadow-black/5 ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => setActiveTab("my")}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 ${
            activeTab === "my"
              ? "bg-white text-slate-900 shadow-lg shadow-slate-200/25 ring-1 ring-slate-200/80"
              : "text-slate-600 hover:bg-white/80 hover:text-slate-800 hover:ring-1 hover:ring-slate-200/60"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <GraduationCap className="h-4 w-4" aria-hidden />
            Courses
          </span>
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
          <span className="inline-flex items-center gap-2">
            <Compass className="h-4 w-4" aria-hidden />
            Explore
          </span>
        </button>
        <button
          type="button"
          onClick={() => setLayout("table")}
          title="Table layout"
          aria-label="Switch to table layout"
          className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            layout === "table" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Table2 className="h-4 w-4" aria-hidden />
            Table
          </span>
        </button>
        <button
          type="button"
          onClick={() => setLayout("cards")}
          title="Card layout"
          aria-label="Switch to card layout"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            layout === "cards" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Cards
          </span>
        </button>
      </div>

      {}
      <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
        {activeTab === "my" ? (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
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
            ) : layout === "table" ? (
              <div className="min-h-0 flex-1 overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Course</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Chapters</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Status</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myCourses.map((c) => (
                      <tr key={`${c.courseId}::${c.batchId}`} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-3.5 font-medium text-slate-800">{c.courseTitle}</td>
                        <td className="px-6 py-3.5 text-slate-600">{c.chapterCount ?? c.moduleCount}</td>
                        <td className="px-6 py-3.5">
                          {c.accessBlocked ? (
                            <span className="rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-bold text-red-900">Blocked by admin</span>
                          ) : (
                            <span className="rounded-full border border-black/15 bg-funt-gold/25 px-3 py-1 text-xs font-bold text-black">Enrolled</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                            title={c.accessBlocked ? "View status" : "Open course"}
                            aria-label={c.accessBlocked ? "View status" : "Open course"}
                            className={
                              c.accessBlocked
                                ? "inline-flex items-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-950 shadow-sm transition duration-200 hover:bg-red-100"
                                : "inline-flex items-center gap-2 rounded-xl bg-funt-gold px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-amber-900/15 ring-1 ring-funt-gold-deep/25 transition duration-200 hover:bg-funt-gold-hover hover:shadow-xl"
                            }
                          >
                            {c.accessBlocked ? "View status" : "Open"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                {myCourses.map((c) => (
                  <article key={`${c.courseId}::${c.batchId}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <img
                      src={c.courseHeaderImageUrl || randomPlaceholderImage(`${c.courseId}`)}
                      alt={c.courseTitle}
                      className="h-32 w-full object-cover"
                    />
                    <div className="space-y-2.5 p-3.5">
                      <h3 className="text-base font-semibold text-slate-900">{c.courseTitle}</h3>
                      <p className="text-xs text-slate-500">{c.chapterCount ?? c.moduleCount} chapters</p>
                      {c.accessBlocked ? (
                        <span className="rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-bold text-red-900">Blocked by admin</span>
                      ) : (
                        <span className="rounded-full border border-black/15 bg-funt-gold/25 px-3 py-1 text-xs font-bold text-black">Enrolled</span>
                      )}
                      <div>
                        <Link
                          href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                          title={c.accessBlocked ? "View status" : "Open course"}
                          aria-label={c.accessBlocked ? "View status" : "Open course"}
                          className={c.accessBlocked ? "inline-flex rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900" : "inline-flex rounded-xl bg-funt-gold px-3 py-2 text-sm font-semibold text-black"}
                        >
                          {c.accessBlocked ? "View status" : "Open"}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
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
            ) : layout === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Course</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Chapters</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Fee (INR)</th>
                      <th className="px-6 py-3.5 font-semibold text-slate-700">Status</th>
                      <th className="px-6 py-3.5 text-right font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exploreCourses.map((c) => (
                      <tr key={`${c.courseId}::${c.batchId}`} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-3.5 font-medium text-slate-800">{c.courseTitle}</td>
                        <td className="px-6 py-3.5 text-slate-600">{c.chapterCount ?? c.moduleCount}</td>
                        <td className="px-6 py-3.5 text-slate-600">
                          {c.enrollmentPriceInPaise && c.enrollmentPriceInPaise > 0 ? (
                            <span>
                              ₹
                              {(c.enrollmentPriceInPaise / 100).toLocaleString("en-IN", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {enrolledKeySet.has(`${String(c.courseId).trim()}::${String(c.batchId).trim()}`) ? (
                            <span className="rounded-full border border-black/15 bg-funt-gold/25 px-3 py-1 text-xs font-bold text-black">Enrolled</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Explore</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {enrolledKeySet.has(`${String(c.courseId).trim()}::${String(c.batchId).trim()}`) ? (
                              <Link
                                href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                                title="Open course"
                                aria-label="Open course"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-funt-gold px-3 py-2 text-xs font-bold text-black shadow-md transition hover:bg-funt-gold-hover"
                              >
                                Open
                              </Link>
                            ) : (
                              <>
                                <Link
                                  href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                                  title="View course details"
                                  aria-label="View course details"
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100/80 transition hover:bg-slate-50"
                                >
                                  Details
                                </Link>
                                <Link
                                  href={`/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}`}
                                  title="Pay for course"
                                  aria-label="Pay for course"
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-funt-gold px-3 py-2 text-xs font-bold text-black shadow-md transition hover:bg-funt-gold-hover"
                                >
                                  Pay
                                </Link>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                {exploreCourses.map((c) => {
                  const enrolled = enrolledKeySet.has(`${String(c.courseId).trim()}::${String(c.batchId).trim()}`);
                  return (
                    <article key={`${c.courseId}::${c.batchId}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <img
                        src={c.courseHeaderImageUrl || randomPlaceholderImage(`${c.courseId}`)}
                        alt={c.courseTitle}
                        className="h-32 w-full object-cover"
                      />
                      <div className="space-y-2.5 p-3.5">
                        <h3 className="text-base font-semibold text-slate-900">{c.courseTitle}</h3>
                        <p className="text-xs text-slate-500">{c.chapterCount ?? c.moduleCount} chapters</p>
                        <p className="text-xs text-slate-600">
                          {c.enrollmentPriceInPaise && c.enrollmentPriceInPaise > 0
                            ? `₹${(c.enrollmentPriceInPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                            : "—"}
                        </p>
                        {enrolled ? (
                          <span className="rounded-full border border-black/15 bg-funt-gold/25 px-3 py-1 text-xs font-bold text-black">Enrolled</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Explore</span>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {enrolled ? (
                            <Link href={`/courses/${c.courseId}?batchId=${c.batchId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-funt-gold px-3 py-2 text-xs font-bold text-black" title="Open course" aria-label="Open course">
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              Open
                            </Link>
                          ) : (
                            <>
                              <Link href={`/courses/${c.courseId}?batchId=${c.batchId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" title="Course details" aria-label="View course details">
                                <Eye className="h-3.5 w-3.5" aria-hidden />
                                Details
                              </Link>
                              <Link href={`/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-funt-gold px-3 py-2 text-xs font-bold text-black" title="Pay" aria-label="Pay for course">
                                <CreditCard className="h-3.5 w-3.5" aria-hidden />
                                Pay
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
