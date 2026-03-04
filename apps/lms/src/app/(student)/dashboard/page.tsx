"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { CourseCard } from "@/components/CourseCard";

interface Enrollment {
  id: string;
  batchId: string;
  courseId?: string;
  status: string;
  batch?: {
    name?: string;
    courseSnapshot?: { courseId?: string; title?: string; modules?: unknown[] };
    courseSnapshots?: Array<{ courseId?: string; title?: string; modules?: unknown[] }>;
  };
}

interface BatchAttendance {
  batchId: string;
  totalSessions: number;
  presentCount: number;
  percentage: number;
}

interface SkillProfile {
  skills: { tag: string; score: number }[];
}

interface Achievement {
  id?: string;
  badgeType: string;
  displayName?: string;
  icon?: string;
  awardedAt: string;
}


const BADGE_COLORS = [
  { bg: "bg-amber-100", icon: "text-amber-700" },
  { bg: "bg-violet-100", icon: "text-violet-700" },
  { bg: "bg-teal-100", icon: "text-teal-700" },
  { bg: "bg-emerald-100", icon: "text-emerald-700" },
  { bg: "bg-sky-100", icon: "text-sky-700" },
];

function getAchievementIcon(iconKey: string, sizeClass = "h-9 w-9") {
  const key = (iconKey || "star").toLowerCase();
  if (key === "assignment") {
    return (
      <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (key === "streak") {
    return (
      <svg className={sizeClass} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 23c0 0 5-4 5-10 0-2.5-1.2-4.5-2.5-6-.5-.6-1-1.1-1.5-1.5V2h-2v3.5c-.5.4-1 1-1.5 1.5C6.2 8.5 5 10.5 5 13c0 6 5 10 5 10s5-4 5-10z" />
      </svg>
    );
  }
  if (key === "course") {
    return (
      <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    );
  }
  if (key === "attendance") {
    return (
      <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className={sizeClass} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function AchievementBadge({
  displayName,
  icon,
  badgeType,
  colorIndex = 0,
}: {
  displayName: string;
  icon?: string;
  badgeType: string;
  colorIndex?: number;
}) {
  const title = displayName || badgeType.replace(/_/g, " ");
  const style = BADGE_COLORS[colorIndex % BADGE_COLORS.length];
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <span className={`flex h-20 w-20 items-center justify-center rounded-full shadow-inner ring-1 ring-black/5 sm:h-24 sm:w-24 ${style.bg} ${style.icon}`}>
        {getAchievementIcon(icon ?? "star", "h-10 w-10 sm:h-12 sm:w-12")}
      </span>
      <span className="max-w-[88px] truncate text-center text-sm font-medium text-slate-600">{title}</span>
    </div>
  );
}

export default function StudentDashboardPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendance, setAttendance] = useState<BatchAttendance[]>([]);
  const [skillProfile, setSkillProfile] = useState<SkillProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [achievementIndex, setAchievementIndex] = useState(0);

  useEffect(() => {
    Promise.all([
      api<Enrollment[]>("/api/enrollments/me").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<BatchAttendance[]>("/api/attendance/me").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<SkillProfile>("/api/skills/me").then((r) => (r.success && r.data ? r.data : null)),
      api<Achievement[]>("/api/achievements/me").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
    ])
      .then(([enrolls, att, skills, badges]) => {
        setEnrollments(enrolls);
        setAttendance(att);
        setSkillProfile(skills);
        setAchievements(badges);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  const totalPresent = attendance.reduce((s, b) => s + b.presentCount, 0);
  const avgSkillScore = skillProfile?.skills?.length
    ? Math.round(skillProfile.skills.reduce((a, s) => a + s.score, 0) / skillProfile.skills.length)
    : 0;
  const flattenedCourses = enrollments.flatMap((e) => {
    const batch = e.batch;
    const snapshots = Array.isArray(batch?.courseSnapshots) && batch.courseSnapshots.length > 0
      ? batch.courseSnapshots
      : batch?.courseSnapshot
        ? [batch.courseSnapshot]
        : [];
    return snapshots.map((snap) => ({
      id: `${e.id}-${(snap as { courseId?: string }).courseId ?? "single"}`,
      batchId: e.batchId,
      courseId: (snap as { courseId?: string }).courseId ?? e.batchId,
      title: (snap as { title?: string }).title ?? "Course",
      batchName: batch?.name ?? "Batch",
      moduleCount: Array.isArray((snap as { modules?: unknown[] }).modules) ? (snap as { modules: unknown[] }).modules.length : 0,
      status: e.status,
    }));
  });
  const displayCourses = flattenedCourses.slice(0, 2);
  const hasMoreCourses = flattenedCourses.length > 2;

  const achievementList = achievements.slice(0, 8);
  const badgesPerView = 4;
  const maxIndex = Math.max(0, achievementList.length - badgesPerView);
  const canGoLeft = achievementIndex > 0;
  const canGoRight = achievementIndex < maxIndex;
  const visibleBadges = achievementList.slice(achievementIndex, achievementIndex + badgesPerView);

  return (
    <div className="mx-auto flex h-full w-full min-h-[calc(100vh-6rem)] max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-6">
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="flex min-h-0 flex-col lg:col-span-2">
          <div className="flex shrink-0 items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Learning</p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">Courses</h2>
            </div>
            {hasMoreCourses && (
              <Link href="/courses" className="rounded-xl px-3 py-2 text-sm font-semibold text-teal-600 shadow-sm ring-1 ring-teal-200/50 transition duration-200 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md hover:ring-teal-300/50">
                View all
              </Link>
            )}
          </div>
          {flattenedCourses.length === 0 ? (
            <div className="mt-5 flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white p-10 text-center shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
              <p className="text-sm text-slate-500">Not enrolled in any batch yet.</p>
              <Link href="/courses" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 ring-1 ring-teal-700/20 transition duration-200 hover:bg-teal-700 hover:shadow-xl hover:shadow-teal-900/25">
                Browse courses
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-5 sm:grid-cols-2">
              {displayCourses.map((c, i) => {
                const variants = ["violet", "teal"] as const;
                return (
                  <CourseCard
                    key={c.id}
                    href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                    title={c.title}
                    batchName={c.batchName}
                    moduleCount={c.moduleCount}
                    status={c.status}
                    variant={variants[i % variants.length]}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80 transition duration-200 hover:shadow-xl hover:shadow-slate-300/25">
          <p className="text-xs font-medium uppercase tracking-wider text-teal-600">Progress</p>
          <h2 className="mt-0.5 shrink-0 text-lg font-bold tracking-tight text-slate-900">Skills</h2>
          <div className="mt-5 flex min-h-0 flex-1 flex-col items-center justify-center">
            <div className="h-20 w-32 shrink-0 sm:h-24 sm:w-40">
              <svg viewBox="0 0 100 50" className="h-full w-full" aria-hidden>
                {}
                <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
                {}
                <path
                  d="M 10 45 A 40 40 0 0 1 90 45"
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(avgSkillScore / 100) * 125} 999`}
                />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-teal-600">{avgSkillScore}%</p>
            <Link href="/skills" className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-teal-600 transition hover:bg-teal-50 hover:text-teal-700">
              View skills
            </Link>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80 transition duration-200 hover:shadow-xl hover:shadow-slate-300/25 lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Badges</p>
          <h2 className="mt-0.5 shrink-0 text-lg font-bold tracking-tight text-slate-900">Achievements</h2>
          <div className="mt-5 flex min-h-0 flex-1 items-center justify-center gap-3">
            {achievementList.length === 0 ? (
              <p className="text-center text-sm text-slate-500">Earn badges by completing courses and assignments.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAchievementIndex((i) => Math.max(0, i - 1))}
                  disabled={!canGoLeft}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-md ring-1 ring-slate-100/80 transition duration-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-lg disabled:opacity-40 disabled:hover:bg-white disabled:hover:shadow-md"
                  aria-label="Previous achievements"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-5">
                  {visibleBadges.map((a, i) => (
                    <AchievementBadge
                      key={a.id ?? `${a.badgeType}-${a.awardedAt}`}
                      badgeType={a.badgeType}
                      displayName={a.displayName ?? a.badgeType.replace(/_/g, " ")}
                      icon={a.icon}
                      colorIndex={i}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAchievementIndex((i) => Math.min(maxIndex, i + 1))}
                  disabled={!canGoRight}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-md ring-1 ring-slate-100/80 transition duration-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-lg disabled:opacity-40 disabled:hover:bg-white disabled:hover:shadow-md"
                  aria-label="Next achievements"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80 transition duration-200 hover:shadow-xl hover:shadow-slate-300/25 lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Sessions</p>
          <h2 className="mt-0.5 shrink-0 text-lg font-bold tracking-tight text-slate-900">Attendance</h2>
          <div className="mt-5 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
            <span className="text-4xl font-bold tabular-nums text-slate-900 sm:text-5xl">{totalPresent}</span>
            <span className="mt-2 text-sm text-slate-500">sessions attended</span>
          </div>
        </div>
      </div>
    </div>
  );
}
