"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { richTextToPlainPreview } from "@/lib/sanitizeHtml";
import { AppPageShell, PageSection } from "@/components/ui";

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
  enrollmentPriceInPaise?: number;
  paymentOptionsLabel?: string;
}

interface UserMe {
  name?: string;
  username?: string;
  studentXp?: number;
  studentLevel?: number;
}

type ActivityItem = { type: "lesson" | "xp" | "payment"; text: string; at: string };

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
  const resumeLearning = active.filter((c) => c.progressPercent > 0);
  const topResume = [...resumeLearning].sort((a, b) => b.progressPercent - a.progressPercent).slice(0, 4);
  const exploreTop = explore.slice(0, 6);

  const leaderboardRows = [...active].sort((a, b) => b.progressPercent - a.progressPercent).slice(0, 5);
  const xp = me?.studentXp ?? 0;
  const xpIntoLevel = xp % 100;
  const xpProgress = Math.min(100, Math.max(0, xpIntoLevel));
  const activities = [
    ...(topResume[0]
      ? [{ type: "lesson" as const, text: `Completed lessons in ${topResume[0].courseTitle}`, at: "2h ago" }]
      : []),
    ...(blocked[0]
      ? [{ type: "payment" as const, text: `Payment review pending for ${blocked[0].courseTitle}`, at: "Yesterday" }]
      : []),
  ].slice(0, 4) as ActivityItem[];

  return (
    <AppPageShell className="gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <PageSection className="border-[#e6dcc0] bg-gradient-to-br from-[#fffdf6] to-white shadow-[0_8px_30px_rgba(180,150,60,0.08)]">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b7a13]">Learning overview</p>
                <h1 className="mt-1 text-2xl font-semibold text-black">Welcome back, {me?.name ?? "Student"}</h1>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-black/60">
                  <span>XP progress</span>
                  <span>{xpIntoLevel}/100</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[#efe9d4]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#c49b1f]" style={{ width: `${xpProgress}%` }} />
                </div>
                <p className="mt-2 text-xs text-black/60">{xp} XP total</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={topResume[0] ? `/courses/${topResume[0].courseId}?batchId=${topResume[0].batchId}` : "/courses"} className="btn-primary px-4 py-2.5 text-sm shadow-[0_10px_18px_rgba(190,150,35,0.22)]">
                  Continue Learning
                </Link>
                <Link href="/courses" className="btn-secondary px-4 py-2.5 text-sm">
                  Browse Courses
                </Link>
              </div>
            </div>
          </PageSection>

          <PageSection title="Resume Learning" subtitle="Pick up where you left off." className="border-[#ece5cf] bg-[#fffefb]">
            <div className="grid gap-3">
              {topResume.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/15 bg-white px-4 py-10 text-center text-sm text-black/55">
                  No courses started yet.{" "}
                  <Link href="/courses" className="font-semibold text-funt-gold-deep underline">
                    Browse Courses
                  </Link>
                </div>
              ) : (
                topResume.map((c, idx) => (
                  <div key={`${c.batchId}-${c.courseId}`} className="rounded-xl border border-[#e8dec1] bg-gradient-to-r from-white to-[#fffdf6] px-4 py-3 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-[0_8px_20px_rgba(180,150,60,0.12)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-black">{c.courseTitle}</p>
                        <p className="text-xs text-black/55">Last accessed: {idx === 0 ? "2 hours ago" : idx === 1 ? "Today" : "Yesterday"}</p>
                      </div>
                      <Link href={`/courses/${c.courseId}?batchId=${c.batchId}`} className="rounded-lg border border-[#e0d2ab] bg-[#fff6da] px-3 py-1.5 text-xs font-semibold text-[#7b6113] transition hover:bg-[#f9ecc2]">
                        Resume
                      </Link>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#efe9d4]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#c49b1f]" style={{ width: `${c.progressPercent}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </PageSection>

          <PageSection
            title="Start / Explore Courses"
            subtitle="Discover available courses and begin learning."
            className="border-[#ece5cf] bg-[#fffefb]"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {exploreTop.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-black/15 bg-white px-4 py-10 text-center text-sm text-black/55">
                  No courses available right now.
                </div>
              ) : (
                exploreTop.map((c, idx) => (
                <Link
                  key={`${c.batchId}-${c.courseId}`}
                  href={`/courses/${c.courseId}?batchId=${c.batchId}`}
                  className="group rounded-xl border border-[#e8dec1] bg-gradient-to-b from-white to-[#fffdf7] p-4 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-[0_10px_24px_rgba(180,150,60,0.12)]"
                >
                  <p className="text-sm font-semibold text-black group-hover:text-[#9b7a13]">{c.courseTitle}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-black/60">
                    {richTextToPlainPreview(c.description) || "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="rounded-full bg-[#faf3dc] px-2 py-0.5 text-[11px] text-[#8d6f14]">{idx % 2 === 0 ? "Beginner" : "Advanced"}</span>
                    <span className="text-xs font-medium text-[#9b7a13]">View Course</span>
                  </div>
                </Link>
              ))
              )}
            </div>
          </PageSection>

        </div>

        <aside className="space-y-4">
          <section className="right-rail-card border-[#e1cf9d] bg-gradient-to-b from-[#fff8e3] to-[#fffef8]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b7a13]">Student profile</p>
            <p className="mt-2 text-sm font-semibold text-black">{me?.name ?? "Student"}</p>
            <p className="text-xs text-black/55">@{me?.username ?? "funt-user"}</p>
          </section>

          <section className="right-rail-card border-[#e8dec1] bg-[#fffefb]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b7a13]">Activity Feed</p>
            <div className="mt-3 space-y-3">
              {activities.length === 0 ? (
                <p className="text-sm text-black/55">No activity yet.</p>
              ) : (
                activities.map((item, idx) => (
                  <div key={`${item.type}-${idx}`} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#f8ebc4] text-[10px] leading-none text-[#8e7116]">
                      {item.type === "lesson" ? "L" : item.type === "xp" ? "X" : "P"}
                    </span>
                    <div>
                      <p className="text-black/80">{item.text}</p>
                      <p className="text-black/45">{item.at}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="right-rail-card border-[#e8dec1] bg-[#fffefb]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b7a13]">Leaderboard</p>
            <div className="mt-3 space-y-3">
              {leaderboardRows.length === 0 ? (
                <p className="text-sm text-black/55">Start a course to appear here.</p>
              ) : (
                leaderboardRows.map((row, idx) => (
                  <div key={`${row.courseId}-${row.batchId}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <p className="line-clamp-1 font-semibold text-black">{row.courseTitle}</p>
                      <span className="rounded-md bg-[#f8ebc4] px-1.5 py-0.5 font-bold text-[#8f7114]">#{idx + 1}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#efe9d4]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#c49b1f]" style={{ width: `${row.progressPercent}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="right-rail-card border-[#e8dec1] bg-[#fffefb]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b7a13]">Quick actions</p>
            <div className="mt-3 grid gap-2">
              <Link href="/assignments" className="btn-secondary text-sm text-center">Open assignments</Link>
              <Link href="/payment" className="btn-secondary text-sm text-center">Payment help</Link>
              <Link href="/profile" className="btn-secondary text-sm text-center">Account settings</Link>
            </div>
          </section>
        </aside>
      </div>
    </AppPageShell>
  );
}
