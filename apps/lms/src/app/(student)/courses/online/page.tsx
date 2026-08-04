"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { CourseCard } from "@/components/CourseCard";
import { Search } from "lucide-react";
import Link from "next/link";
import { CreditCard } from "lucide-react";

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

export default function LearnAtHomePage() {
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api<MyCourse[]>("/api/student/courses")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setCourses(r.data.filter((c) => c.batchType === "online"));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.courseTitle.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

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
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Learn at Home</h1>
          <p className="mt-1 text-sm text-slate-500">Course + Kit</p>
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

      {filtered.length > 0 ? (
        <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Enrolled</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800">Online Courses</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((c) => (
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
      ) : (
        <DataPanel className="flex flex-col bg-white/95 transition duration-200 hover:shadow-xl hover:shadow-slate-300/20">
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white p-10 shadow-inner ring-1 ring-slate-100/80">
            <div className="text-center">
              <p className="text-sm text-slate-500">
                {searchQuery.trim()
                  ? "No courses match your search."
                  : "You don't have any online courses yet."}
              </p>
              <Link
                href="/courses"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                <CreditCard className="h-3.5 w-3.5" aria-hidden />
                Browse Courses
              </Link>
            </div>
          </div>
        </DataPanel>
      )}
    </AppPageShell>
  );
}
