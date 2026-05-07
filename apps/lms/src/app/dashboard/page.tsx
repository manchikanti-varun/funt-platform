"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { richTextToPlainPreview } from "@/lib/sanitizeHtml";
import { AppPageShell, PageSection } from "@/components/ui";
import { ArrowRight, CalendarClock, Flame, Goal, Lock, Sparkles, Target, Users } from "lucide-react";

interface MyCourse {
  courseId: string;
  courseTitle: string;
  description?: string;
  chapterCount?: number;
  moduleCount: number;
  batchId: string;
  progressPercent: number;
  accessBlocked?: boolean;
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
}

interface UserMe {
  name?: string;
  username?: string;
  studentXp?: number;
  studentLevel?: number;
}

interface AchievementRow {
  id: string;
  displayName: string;
  awardedAt: string;
}

interface SubmissionItem {
  id: string;
  status: string;
  submittedAt: string;
}

export default function StudentDashboardPage() {
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [explore, setExplore] = useState<ExploreCourse[]>([]);
  const [me, setMe] = useState<UserMe | null>(null);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<MyCourse[]>("/api/student/courses").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<ExploreCourse[]>("/api/student/courses/explore").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<UserMe>("/api/users/me").then((r) => (r.success && r.data ? r.data : null)),
      api<AchievementRow[]>("/api/achievements/my").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
      api<{ chapterSubmissions?: SubmissionItem[]; generalSubmissions?: SubmissionItem[] }>("/api/student/assignments/my-submissions").then((r) => {
        if (!r.success || !r.data) return [];
        return [...(r.data.chapterSubmissions ?? []), ...(r.data.generalSubmissions ?? [])];
      }),
    ])
      .then(([mine, ex, user, badges, subs]) => {
        setMyCourses(mine);
        setExplore(ex);
        setMe(user);
        setAchievements(badges);
        setSubmissions(subs);
      })
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(() => myCourses.filter((c) => !c.accessBlocked), [myCourses]);
  const blocked = useMemo(() => myCourses.filter((c) => c.accessBlocked), [myCourses]);
  const sortedByProgress = useMemo(() => [...active].sort((a, b) => b.progressPercent - a.progressPercent), [active]);
  const sortedNeedsAttention = useMemo(() => [...active].sort((a, b) => a.progressPercent - b.progressPercent), [active]);
  const nextCourse = sortedByProgress[0] ?? sortedNeedsAttention[0] ?? null;
  const trailingCourse = sortedNeedsAttention[0] ?? null;
  const exploreTop = explore.slice(0, 4);
  const pendingReviews = submissions.filter((s) => s.status === "PENDING").length;
  const approvedReviews = submissions.filter((s) => s.status === "APPROVED").length;
  const recentUnlocks = [...achievements]
    .sort((a, b) => +new Date(b.awardedAt) - +new Date(a.awardedAt))
    .slice(0, 3);
  const xp = me?.studentXp ?? 0;
  const level = me?.studentLevel ?? 1;
  const xpIntoLevel = xp % 100;
  const xpProgress = Math.min(100, Math.max(0, xpIntoLevel));
  const avgProgress = active.length ? Math.round(active.reduce((sum, c) => sum + c.progressPercent, 0) / active.length) : 0;
  const aheadSignal = avgProgress >= 65 ? "Ahead of plan" : avgProgress >= 35 ? "On track" : "Behind pace";
  const streakDays = Math.max(1, Math.min(14, Math.floor((approvedReviews + recentUnlocks.length + level) / 2)));
  const missionHref = nextCourse ? `/courses/${nextCourse.courseId}?batchId=${nextCourse.batchId}` : "/courses";
  const missionText = nextCourse
    ? `Continue ${nextCourse.courseTitle}`
    : "Pick your first course to start momentum";
  const focusQuestion =
    blocked.length > 0
      ? "Unlock blocked access to avoid losing momentum."
      : pendingReviews > 0
        ? "Check feedback loops and close pending work."
        : "Ship one focused learning sprint today.";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    );
  }

  return (
    <AppPageShell className="gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <PageSection className="border-[#e6dcc0] bg-gradient-to-br from-[#fffdf6] to-white shadow-[0_8px_30px_rgba(180,150,60,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b7a13]">Today Mission</p>
              <h1 className="mt-1 text-xl font-semibold text-black">{missionText}</h1>
              <p className="mt-1 text-sm text-black/65">{focusQuestion}</p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-[#eadfbf] bg-[#fff7dd] px-3 py-1 text-xs font-semibold text-[#7b6113]">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              {streakDays} day streak
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={missionHref} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/assignments" className="btn-secondary px-4 py-2 text-sm">Assignments</Link>
            <Link href="/courses?tab=explore" className="btn-secondary px-4 py-2 text-sm">Explore</Link>
          </div>
        </PageSection>

        <PageSection className="border-[#ece5cf] bg-[#fffefb]">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#9b7a13]">XP</p>
              <p className="mt-1 text-lg font-semibold text-black">{xp}</p>
            </div>
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#9b7a13]">Level</p>
              <p className="mt-1 text-lg font-semibold text-black">{level}</p>
            </div>
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#9b7a13]">Pace</p>
              <p className="mt-1 text-lg font-semibold text-black">{avgProgress}%</p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#efe9d4]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#c49b1f]" style={{ width: `${xpProgress}%` }} />
          </div>
          <p className="mt-1 text-xs text-black/55">{xpIntoLevel}/100 XP to next level · {aheadSignal}</p>
        </PageSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PageSection title="Attention" subtitle="Handle first" className="border-[#ece5cf] bg-[#fffefb]">
          <div className="space-y-2">
            <div className="rounded-xl border border-[#f0dba5] bg-[#fff8e6] px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-black"><CalendarClock className="h-3.5 w-3.5 text-[#9b7a13]" aria-hidden /> Pending reviews</p>
              <p className="mt-1 text-sm text-black">{pendingReviews}</p>
            </div>
            <div className="rounded-xl border border-[#f0dba5] bg-[#fff8e6] px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-black"><Lock className="h-3.5 w-3.5 text-[#9b7a13]" aria-hidden /> Blocked courses</p>
              <p className="mt-1 text-sm text-black">{blocked.length}</p>
            </div>
            <Link href="/courses" className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0d2ab] bg-[#fff6da] px-3 py-1.5 text-xs font-semibold text-[#7b6113]">Resolve <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
        </PageSection>

        <PageSection title="Journey" subtitle="Now / Risk / Next" className="border-[#ece5cf] bg-[#fffefb]">
          <div className="space-y-2">
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#9b7a13]">Now</p>
              <p className="mt-0.5 text-sm font-semibold text-black">{nextCourse ? nextCourse.courseTitle : "Start first course"}</p>
            </div>
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#9b7a13]">Risk</p>
              <p className="mt-0.5 text-sm font-semibold text-black">{trailingCourse ? trailingCourse.courseTitle : "No lag detected"}</p>
            </div>
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#9b7a13]">Next unlock</p>
              <p className="mt-0.5 text-sm font-semibold text-black">Level {level + 1}</p>
            </div>
          </div>
        </PageSection>

        <PageSection title="Cohort Pulse" subtitle="What’s moving" className="border-[#ece5cf] bg-[#fffefb]">
          <div className="space-y-2">
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-black"><Users className="h-3.5 w-3.5 text-[#9b7a13]" aria-hidden /> Active enrollments</p>
              <p className="mt-1 text-sm text-black">{active.length}</p>
            </div>
            <div className="rounded-xl border border-[#eadfbf] bg-white px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-black"><Target className="h-3.5 w-3.5 text-[#9b7a13]" aria-hidden /> Focus call</p>
              <p className="mt-1 text-xs text-black/65">{pendingReviews > 0 ? "Clear feedback loops first." : "Complete one chapter today."}</p>
            </div>
          </div>
        </PageSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <PageSection title="Momentum Board" subtitle="Top active courses" className="border-[#ece5cf] bg-[#fffefb]">
          <div className="grid gap-2">
            {sortedByProgress.slice(0, 4).map((c) => (
              <Link key={`${c.batchId}-${c.courseId}`} href={`/courses/${c.courseId}?batchId=${c.batchId}`} className="rounded-xl border border-[#e8dec1] bg-white px-3 py-2.5 transition hover:border-[#d4af37]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-black">{c.courseTitle}</p>
                  <p className="text-xs font-semibold text-[#9b7a13]">{c.progressPercent}%</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#efe9d4]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#c49b1f]" style={{ width: `${c.progressPercent}%` }} />
                </div>
              </Link>
            ))}
            {sortedByProgress.length === 0 ? <p className="text-sm text-black/55">No active courses yet.</p> : null}
          </div>
        </PageSection>

        <PageSection title="Unlocked" subtitle="Recent rewards" className="border-[#ece5cf] bg-[#fffefb]">
          <div className="space-y-2">
            {recentUnlocks.length === 0 ? (
              <p className="text-sm text-black/55">No recent unlocks yet.</p>
            ) : (
              recentUnlocks.map((a) => (
                <div key={a.id} className="rounded-xl border border-[#e8dec1] bg-white px-3 py-2.5">
                  <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b7a13]">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Unlock
                  </p>
                  <p className="mt-1 text-sm font-semibold text-black">{a.displayName}</p>
                </div>
              ))
            )}
          </div>
        </PageSection>
      </div>

      <PageSection title="Recommended Next Paths" subtitle="Join a new cohort lane" className="border-[#ece5cf] bg-[#fffefb]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {exploreTop.map((c) => (
            <Link key={`${c.batchId}-${c.courseId}`} href={`/courses/${c.courseId}?batchId=${c.batchId}`} className="rounded-xl border border-[#e8dec1] bg-white px-3 py-2.5 transition hover:border-[#d4af37]">
              <p className="text-sm font-semibold text-black">{c.courseTitle}</p>
              <p className="mt-1 line-clamp-2 text-xs text-black/60">{richTextToPlainPreview(c.description) || "New learning path"}</p>
            </Link>
          ))}
          {exploreTop.length === 0 ? <p className="text-sm text-black/55">No new paths available now.</p> : null}
        </div>
      </PageSection>
    </AppPageShell>
  );
}
