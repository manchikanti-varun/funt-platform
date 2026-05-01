"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, PageSection } from "@/components/ui";

interface UserMe {
  name?: string;
  studentXp?: number;
  studentLevel?: number;
}

interface MyCourse {
  courseId: string;
  courseTitle: string;
  batchId: string;
  progressPercent: number;
  moduleCount: number;
  accessBlocked?: boolean;
}

export default function ProgressPage() {
  const [me, setMe] = useState<UserMe | null>(null);
  const [courses, setCourses] = useState<MyCourse[]>([]);

  useEffect(() => {
    Promise.all([
      api<UserMe>("/api/users/me").then((r) => (r.success && r.data ? r.data : null)),
      api<MyCourse[]>("/api/student/courses").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
    ]).then(([u, c]) => {
      setMe(u);
      setCourses(c);
    });
  }, []);

  return (
    <AppPageShell className="max-w-5xl">
      <div className="page-hero py-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-black">Progress</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-black">Your learning journey</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/65">
          <strong className="text-black">XP</strong> from finished chapters and approved assignments. <strong className="text-black">Level</strong> +1 per course certificate. Details below and under Skills / Assignments.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="card-premium">
          <p className="text-xs font-black uppercase text-black/50">Total XP</p>
          <p className="mt-2 text-4xl font-black tabular-nums text-black">{me?.studentXp ?? 0}</p>
          <p className="mt-2 text-xs text-black/55">+40 XP per chapter · +50 XP per approved assignment</p>
        </div>
        <div className="card-premium border-funt-gold">
          <p className="text-xs font-black uppercase text-funt-gold-deep">Level</p>
          <p className="mt-2 text-4xl font-black tabular-nums text-black">{me?.studentLevel ?? 1}</p>
          <p className="mt-2 text-xs text-black/55">+1 level per completed course (certificate)</p>
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/profile" className="card-student block border-2 border-black/10 hover:border-funt-gold">
          <h2 className="font-black text-black">Medals</h2>
          <p className="mt-1 text-sm text-black/55">Badges on your profile</p>
        </Link>
        <Link href="/assignments" className="card-student block border-2 border-black/10 hover:border-funt-gold">
          <h2 className="font-black text-black">Projects</h2>
          <p className="mt-1 text-sm text-black/55">Assignments &amp; submissions</p>
        </Link>
        <Link href="/skills" className="card-student block border-2 border-black/10 hover:border-funt-gold">
          <h2 className="font-black text-black">Skills</h2>
          <p className="mt-1 text-sm text-black/55">Skill profile</p>
        </Link>
        <Link href="/certificates" className="card-student block border-2 border-black/10 hover:border-funt-gold">
          <h2 className="font-black text-black">Certificates</h2>
          <p className="mt-1 text-sm text-black/55">Completed courses</p>
        </Link>
      </div>

      <PageSection className="mt-4">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">Per-course analysis</h2>
        <p className="mt-2 text-sm text-black/55">Enrollment progress — open a course for chapters and assignments.</p>
        <ul className="mt-4 space-y-3">
          {courses.length === 0 ? (
            <li className="rounded-2xl border-2 border-dashed border-black/15 py-10 text-center text-sm text-black/50">No enrollments yet.</li>
          ) : (
            courses.map((c) => (
              <li key={`${c.batchId}-${c.courseId}`}>
                <Link
                  href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black/10 bg-white px-5 py-4 transition hover:border-funt-gold"
                >
                  <div>
                    <p className="font-bold text-black">{c.courseTitle}</p>
                    <p className="text-xs text-black/50">
                      {c.moduleCount} chapters
                      {c.accessBlocked ? " · blocked by admin" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-black/10">
                      <div className="h-full rounded-full bg-funt-gold" style={{ width: `${c.progressPercent}%` }} />
                    </div>
                    <span className="text-sm font-black tabular-nums text-black">{c.progressPercent}%</span>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </PageSection>
    </AppPageShell>
  );
}
