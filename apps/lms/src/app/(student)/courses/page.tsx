"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { CourseCard } from "@/components/CourseCard";
import { CreditCard, Eye, Search, Home, Building2 } from "lucide-react";

interface MyCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  chapterCount?: number;
  moduleCount: number;
  batchId: string;
  batchType?: "online" | "centre" | "other";
  accessBlocked?: boolean;
  needsPayment?: boolean;
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
  batchType?: string;
  enrollmentPriceInPaise?: number;
  courseHeaderImageUrl?: string;
  isDemo?: boolean;
  deliveryMode?: string;
  levelTag?: string;
  milestoneFeesInPaise?: number[];
  totalMilestoneFeePaise?: number;
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
  const [browseTab, setBrowseTab] = useState<"online" | "centre">("online");

  useEffect(() => {
    Promise.all([
      api<MyCourse[]>("/api/student/courses").then((r) =>
        r.success && Array.isArray(r.data) ? r.data : []
      ).catch(() => [] as MyCourse[]),
      api<ExploreCourse[]>("/api/student/courses/explore").then((r) =>
        r.success && Array.isArray(r.data) ? r.data : []
      ).catch(() => [] as ExploreCourse[]),
    ])
      .then(([myList, exploreList]) => {
        setMyCoursesList(myList);
        setExploreCoursesList(exploreList);
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

  const onlineCourses = useMemo(() => myCourses.filter((c) => c.batchType === "online"), [myCourses]);
  const centreCourses = useMemo(() => myCourses.filter((c) => c.batchType === "centre"), [myCourses]);
  const otherCourses = useMemo(() => myCourses.filter((c) => !c.batchType || c.batchType === "other"), [myCourses]);

  const enrolledKeySet = useMemo(() => new Set(myCoursesList.map((c) => String(c.courseId).trim())), [myCoursesList]);

  const exploreOnline = useMemo(
    () => exploreCoursesList.filter((c) => c.batchType === "GLOBAL_ONLINE" && !enrolledKeySet.has(String(c.courseId).trim())),
    [exploreCoursesList, enrolledKeySet]
  );
  const exploreCentre = useMemo(
    () => exploreCoursesList.filter((c) => c.batchType === "GLOBAL_CENTRE" && !enrolledKeySet.has(String(c.courseId).trim())),
    [exploreCoursesList, enrolledKeySet]
  );

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

      {/* Learn at Home — Online Batch */}
      {onlineCourses.length > 0 && (
        <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">Learn at Home <span className="text-sm font-normal text-slate-500">(Course + Kit)</span></h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {onlineCourses.map((c) => (
              <CourseCard
                key={`${c.courseId}::${c.batchId}`}
                href={c.needsPayment ? `/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}&from=%2Fcourses` : `/courses/${c.courseId}?batchId=${c.batchId}`}
                title={c.courseTitle}
                chapterCount={c.chapterCount ?? c.moduleCount}
                progressPercent={c.needsPayment ? 0 : (c.progressPercent ?? 0)}
                locked={!!c.accessBlocked || !!c.needsPayment}
                imageUrl={c.courseHeaderImageUrl}
                statusLabel={c.accessBlocked ? "Blocked by admin" : c.needsPayment ? "Pay to unlock" : "Enrolled"}
                isDemo={!!c.isDemo}
              />
            ))}
          </div>
        </DataPanel>
      )}

      {/* Learn at Centre — Centre Batch */}
      {centreCourses.length > 0 && (
        <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">Learn at Centre <span className="text-sm font-normal text-slate-500">(Course only · no kit)</span></h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {centreCourses.map((c) => (
              <CourseCard
                key={`${c.courseId}::${c.batchId}`}
                href={c.needsPayment ? `/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}&from=%2Fcourses` : `/courses/${c.courseId}?batchId=${c.batchId}`}
                title={c.courseTitle}
                chapterCount={c.chapterCount ?? c.moduleCount}
                progressPercent={c.needsPayment ? 0 : (c.progressPercent ?? 0)}
                locked={!!c.accessBlocked || !!c.needsPayment}
                imageUrl={c.courseHeaderImageUrl}
                statusLabel={c.accessBlocked ? "Blocked by admin" : c.needsPayment ? "Pay to unlock" : "Enrolled"}
                isDemo={!!c.isDemo}
              />
            ))}
          </div>
        </DataPanel>
      )}

      {/* Other Batches (custom batches, junior level, etc.) */}
      {otherCourses.length > 0 && (
        <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">My Courses</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {otherCourses.map((c) => (
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
        </DataPanel>
      )}

      {/* No courses at all */}
      {myCourses.length === 0 && (
        <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">My Courses</h2>
          </div>
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white p-10 shadow-inner ring-1 ring-slate-100/80">
            <p className="text-sm text-slate-500">
              {searchQuery.trim()
                ? "No enrolled courses match your search."
                : "You are not enrolled in any course yet. Scroll down to explore available courses."}
            </p>
          </div>
        </DataPanel>
      )}

      {/* Browse — Unified tabbed interface */}
      <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Browse</p>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">Explore Courses</h2>

          {/* Tab Buttons */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setBrowseTab("online")}
              className={`flex flex-1 items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                browseTab === "online"
                  ? "border-indigo-300 bg-indigo-50 shadow-sm ring-1 ring-indigo-200"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Home className={`mt-0.5 h-5 w-5 shrink-0 ${browseTab === "online" ? "text-indigo-600" : "text-slate-400"}`} aria-hidden />
              <div>
                <span className={`text-sm font-bold ${browseTab === "online" ? "text-indigo-700" : "text-slate-700"}`}>
                  Learn at Home
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  Complete course + brand new kit. One-time purchase — the kit is yours to keep forever.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setBrowseTab("centre")}
              className={`flex flex-1 items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                browseTab === "centre"
                  ? "border-emerald-300 bg-emerald-50 shadow-sm ring-1 ring-emerald-200"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Building2 className={`mt-0.5 h-5 w-5 shrink-0 ${browseTab === "centre" ? "text-emerald-600" : "text-slate-400"}`} aria-hidden />
              <div>
                <span className={`text-sm font-bold ${browseTab === "centre" ? "text-emerald-700" : "text-slate-700"}`}>
                  Learn at Centre
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  Course access with shared lab kits at our centre. Kits are not included — if you want one after the course, contact your trainer for pricing.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content — Online */}
        {browseTab === "online" && (
          exploreOnline.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-slate-500">No online courses available right now.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                {exploreOnline.map((c) => (
                  <CourseCard
                    key={`${c.courseId}::${c.batchId}`}
                    href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                    title={c.courseTitle}
                    chapterCount={c.chapterCount ?? c.moduleCount}
                    imageUrl={c.courseHeaderImageUrl}
                    statusLabel={c.isDemo ? "Free demo" : "Learn at Home"}
                    isDemo={!!c.isDemo}
                    footerExtra={
                      !c.isDemo && c.enrollmentPriceInPaise && c.enrollmentPriceInPaise > 0 ? (
                        <p className="text-xs text-slate-600">Fee: ₹{(c.enrollmentPriceInPaise / 100).toLocaleString("en-IN")}</p>
                      ) : undefined
                    }
                    actions={
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/courses/${c.courseId}?batchId=${c.batchId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                          <Eye className="h-3.5 w-3.5" aria-hidden /> Details
                        </Link>
                        {!c.isDemo && (
                          <Link href={`/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}&from=%2Fcourses`} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">
                            <CreditCard className="h-3.5 w-3.5" aria-hidden /> Pay
                          </Link>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </>
          )
        )}

        {/* Tab Content — Centre */}
        {browseTab === "centre" && (
          exploreCentre.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-slate-500">No centre courses available right now.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                {exploreCentre.map((c) => {
                  const isLevelCourse = c.deliveryMode === "LEARNING_PLAN";
                  const milestonePerMonth = isLevelCourse && Array.isArray(c.milestoneFeesInPaise) && c.milestoneFeesInPaise.length > 0
                    ? `₹${(c.milestoneFeesInPaise[0] / 100).toLocaleString("en-IN")}`
                    : null;
                  const totalMilestoneFee = isLevelCourse && c.totalMilestoneFeePaise && c.totalMilestoneFeePaise > 0
                    ? `₹${(c.totalMilestoneFeePaise / 100).toLocaleString("en-IN")}`
                    : null;
                  const individualFee = !isLevelCourse && c.enrollmentPriceInPaise && c.enrollmentPriceInPaise > 0
                    ? `₹${(c.enrollmentPriceInPaise / 100).toLocaleString("en-IN")}`
                    : null;

                  return (
                    <CourseCard
                      key={`${c.courseId}::${c.batchId}`}
                      href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                      title={c.courseTitle}
                      chapterCount={c.chapterCount ?? c.moduleCount}
                      imageUrl={c.courseHeaderImageUrl}
                      statusLabel={c.isDemo ? "Free demo" : isLevelCourse ? "Level · Per Month" : "Individual · Full Access"}
                      isDemo={!!c.isDemo}
                      footerExtra={
                        !c.isDemo ? (
                          <div className="space-y-1">
                            {c.levelTag && (
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                c.levelTag === 'JUNIOR' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                c.levelTag === 'SENIOR' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                c.levelTag === 'SUPER_SENIOR' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {c.levelTag === 'JUNIOR' ? 'Junior' : c.levelTag === 'SENIOR' ? 'Senior' : c.levelTag === 'SUPER_SENIOR' ? 'Super Senior' : c.levelTag}
                              </span>
                            )}
                            {isLevelCourse ? (
                              <>
                                {milestonePerMonth && (
                                  <p className="text-xs font-semibold text-slate-700">
                                    {milestonePerMonth}<span className="font-normal text-slate-500"> / month (milestone-based)</span>
                                  </p>
                                )}
                                {totalMilestoneFee && (
                                  <p className="text-[11px] text-slate-500">Total fee: {totalMilestoneFee}</p>
                                )}
                              </>
                            ) : (
                              individualFee && (
                                <p className="text-xs font-semibold text-slate-700">
                                  Fee: {individualFee} <span className="font-normal text-slate-500">(one-time · full course)</span>
                                </p>
                              )
                            )}
                          </div>
                        ) : undefined
                      }
                      actions={
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/courses/${c.courseId}?batchId=${c.batchId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            <Eye className="h-3.5 w-3.5" aria-hidden /> Details
                          </Link>
                          {!c.isDemo && (
                            <Link href={`/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}&from=%2Fcourses`} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">
                              <CreditCard className="h-3.5 w-3.5" aria-hidden /> Pay
                            </Link>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </>
          )
        )}
      </DataPanel>
    </AppPageShell>
  );
}
