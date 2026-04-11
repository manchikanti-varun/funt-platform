"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { CourseCard } from "@/components/CourseCard";

interface MyCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  moduleCount: number;
  batchId: string;
  progressPercent: number;
  accessBlocked?: boolean;
}

interface ExploreCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  moduleCount: number;
  batchId: string;
}

interface UserMe {
  studentXp?: number;
  studentLevel?: number;
}

export default function StudentDashboardPage() {
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [explore, setExplore] = useState<ExploreCourse[]>([]);
  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<MyCourse[]>("/api/student/courses").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<ExploreCourse[]>("/api/student/courses/explore").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<UserMe>("/api/users/me").then((r) => (r.success && r.data ? r.data : null)),
    ])
      .then(([mine, ex, user]) => {
        setMyCourses(mine);
        setExplore(ex);
        setMe(user);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    );
  }

  const active = myCourses.filter((c) => !c.accessBlocked);
  const blocked = myCourses.filter((c) => c.accessBlocked);
  const startLearning = active.filter((c) => c.progressPercent === 0);
  const resumeLearning = active.filter((c) => c.progressPercent > 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-6 sm:px-6">
      <header className="relative overflow-hidden rounded-[2rem] border-2 border-black bg-white px-6 py-10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-funt-gold/35 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-funt-honey/80 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-black">FUNT Learn</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl md:text-[2.75rem] md:leading-tight">
            Build. Code. Create.
            <span className="block text-funt-gold-deep">Your robotics &amp; learning studio.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/70 sm:text-base">
            Bright, practical learning — aligned with the{" "}
            <a href="https://funt-frontend.vercel.app/" className="font-semibold text-black underline decoration-funt-gold decoration-2 underline-offset-2" target="_blank" rel="noopener noreferrer">
              FUNT Robotics Academy
            </a>{" "}
            spirit. Sign in with your username, track every chapter, and level up as you finish courses.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-3 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">XP</span>
              <span className="text-2xl font-black tabular-nums text-black">{me?.studentXp ?? 0}</span>
              <span className="h-8 w-px bg-black/10" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-funt-gold-deep">Level</span>
              <span className="text-2xl font-black tabular-nums text-black">{me?.studentLevel ?? 1}</span>
            </div>
            <Link href="/courses" className="btn-primary px-6 py-3 text-sm font-bold">
              Browse catalog
            </Link>
            <Link href="/progress" className="btn-secondary px-6 py-3 text-sm font-bold">
              Full progress
            </Link>
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">Start learning</h2>
        <p className="mt-2 text-sm text-black/55">Courses at 0% — open one to begin.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {startLearning.length === 0 ? (
            <p className="col-span-full rounded-2xl border-2 border-dashed border-black/15 bg-white py-14 text-center text-sm text-black/50">
              Nothing new here yet. Explore all courses below or open the full catalog.
            </p>
          ) : (
            startLearning.map((c) => (
              <CourseCard
                key={`${c.batchId}-${c.courseId}`}
                href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                title={c.courseTitle}
                batchName=""
                chapterCount={c.moduleCount}
                progressPercent={c.progressPercent}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">Resume learning</h2>
        <p className="mt-2 text-sm text-black/55">Above 0% — ring shows how far you&apos;ve come.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resumeLearning.length === 0 ? (
            <p className="col-span-full rounded-2xl border-2 border-dashed border-black/15 bg-white py-14 text-center text-sm text-black/50">
              Start a course above — your in-progress work will land here.
            </p>
          ) : (
            resumeLearning.map((c) => (
              <CourseCard
                key={`${c.batchId}-${c.courseId}`}
                href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                title={c.courseTitle}
                batchName=""
                chapterCount={c.moduleCount}
                progressPercent={c.progressPercent}
              />
            ))
          )}
        </div>
      </section>

      {blocked.length > 0 && (
        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">Access paused</h2>
          <p className="mt-2 text-sm text-black/55">Your school admin disabled LMS access for these enrollments.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {blocked.map((c) => (
              <CourseCard
                key={`${c.batchId}-${c.courseId}-blocked`}
                href="#"
                title={c.courseTitle}
                batchName=""
                chapterCount={c.moduleCount}
                progressPercent={0}
                locked
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">All courses we offer</h2>
            <p className="mt-2 text-sm text-black/55">Open a course to enroll or continue — same catalog as the full courses page.</p>
          </div>
          <Link href="/courses" className="btn-primary text-sm font-bold">
            Full catalog
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {explore.map((c) => (
            <Link
              key={`${c.batchId}-${c.courseId}`}
              href={`/courses/${c.courseId}?batchId=${c.batchId}`}
              className="group rounded-2xl border-2 border-black/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-funt-gold hover:shadow-lg"
            >
              <p className="font-bold text-black group-hover:text-funt-gold-deep">{c.courseTitle}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-black/55">{c.description ?? "—"}</p>
              <p className="mt-3 text-xs font-bold text-black/45">{c.moduleCount} chapters</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-black/10 bg-funt-honey/40 px-6 py-5 text-sm text-black">
        <p className="font-bold text-black">Rewards &amp; kits</p>
        <p className="mt-2 text-black/70">
          FUNT coins for shop discounts are planned for a later release. For now, use{" "}
          <Link href="/shop" className="font-bold text-black underline decoration-funt-gold decoration-2">
            Kits
          </Link>{" "}
          and{" "}
          <Link href="/shop?shelf=COMPONENTS" className="font-bold text-black underline decoration-funt-gold decoration-2">
            Components
          </Link>{" "}
          in the shop header — pay with coins or submit payment proof as shown on each product.
        </p>
      </section>
    </div>
  );
}
