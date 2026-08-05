"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { CourseCard } from "@/components/CourseCard";
import { Search, CreditCard, Eye } from "lucide-react";
import Link from "next/link";

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
}

export default function LearnAtCentrePage() {
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [exploreCourses, setExploreCourses] = useState<ExploreCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([
      api<MyCourse[]>("/api/student/courses").then((r) =>
        r.success && Array.isArray(r.data) ? r.data.filter((c) => c.batchType === "centre") : []
      ).catch(() => [] as MyCourse[]),
      api<ExploreCourse[]>("/api/student/courses/explore").then((r) =>
        r.success && Array.isArray(r.data) ? r.data.filter((c) => c.batchType === "GLOBAL_CENTRE") : []
      ).catch(() => [] as ExploreCourse[]),
    ])
      .then(([my, explore]) => { setMyCourses(my); setExploreCourses(explore); })
      .finally(() => setLoading(false));
  }, []);

  const enrolledIds = useMemo(() => new Set(myCourses.map((c) => c.courseId)), [myCourses]);

  const filteredMy = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return myCourses;
    return myCourses.filter((c) => c.courseTitle.toLowerCase().includes(q));
  }, [myCourses, searchQuery]);

  const filteredExplore = useMemo(() => {
    const unenrolled = exploreCourses.filter((c) => !enrolledIds.has(c.courseId));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return unenrolled;
    return unenrolled.filter((c) => c.courseTitle.toLowerCase().includes(q));
  }, [exploreCourses, searchQuery, enrolledIds]);

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
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Learn at Centre</h1>
          <p className="mt-1 text-sm text-slate-500">Course access with shared lab kits at our centre. Kits are not included — if you want one after the course, contact your trainer for pricing.</p>
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

      {/* Enrolled */}
      {filteredMy.length > 0 && (
        <DataPanel className="flex flex-col bg-white/95">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">My Courses</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredMy.map((c) => (
              <CourseCard
                key={`${c.courseId}::${c.batchId}`}
                href={c.needsPayment ? `/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}` : `/courses/${c.courseId}?batchId=${c.batchId}`}
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

      {/* Available courses */}
      {filteredExplore.length > 0 && (
        <DataPanel className="flex flex-col bg-white/95">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Available</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">All Courses</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredExplore.map((c) => (
              <CourseCard
                key={`${c.courseId}::${c.batchId}`}
                href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                title={c.courseTitle}
                chapterCount={c.chapterCount ?? c.moduleCount}
                imageUrl={c.courseHeaderImageUrl}
                statusLabel={c.isDemo ? "Free demo" : "Learn at Centre"}
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
                      <Link href={`/payment?type=course&batchId=${encodeURIComponent(c.batchId)}&courseId=${encodeURIComponent(c.courseId)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">
                        <CreditCard className="h-3.5 w-3.5" aria-hidden /> Pay
                      </Link>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        </DataPanel>
      )}

      {/* Empty state */}
      {filteredMy.length === 0 && filteredExplore.length === 0 && (
        <DataPanel className="flex flex-col bg-white/95">
          <div className="flex flex-1 items-center justify-center p-10">
            <p className="text-sm text-slate-500">
              {searchQuery.trim() ? "No courses match your search." : "No centre courses available yet."}
            </p>
          </div>
        </DataPanel>
      )}
    </AppPageShell>
  );
}
