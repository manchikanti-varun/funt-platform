"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { IconAttendance, IconBook, IconCertificates, IconProgress } from "@/components/icons/NavIcons";
import { clearParentSession, getParentSelectedStudentSession } from "@/lib/parentSelection";

interface AttendanceSummaryItem {
  batchId?: string;
  batchName?: string;
  // Backend (attendance.service) uses:
  // - presentCount / totalSessions / percentage
  presentCount?: number;
  totalSessions?: number;
  percentage?: number;

  // Legacy / UI-expected names (kept optional for backward compatibility)
  attendedCount?: number;
  totalCount?: number;
  attendancePercent?: number;
}

interface ParentStudentProfile {
  user: {
    name: string;
    username: string;
    grade?: string;
    schoolName?: string;
    city?: string;
  };
  coursesCount?: number;
  certificatesCount?: number;
  certificates?: Array<{
    certificateId?: string;
    courseName?: string;
    issuedAt?: string;
  }>;
  attendanceSummary?: AttendanceSummaryItem[];
  enrollments?: Array<{
    status: string;
    courseNames: string[];
  }>;
  moduleProgressSummary?: {
    modulesCompleted: number;
    modulesPending: number;
    modulesTotal: number;
    completionPercent: number;
    courses: Array<{
      courseKey: string;
      batchName?: string;
      courseName: string;
      modules: Array<{
        order: number;
        title: string;
        completed: boolean;
      }>;
      modulesCompleted: number;
      modulesPending: number;
      modulesTotal: number;
      completionPercent: number;
    }>;
  };
  chapterProgressSummary?: {
    chaptersCompleted: number;
    chaptersPending: number;
    chaptersTotal: number;
    completionPercent: number;
    courses: Array<{
      courseKey: string;
      batchName?: string;
      courseName: string;
      chapters: Array<{
        order: number;
        title: string;
        completed: boolean;
      }>;
      chaptersCompleted: number;
      chaptersPending: number;
      chaptersTotal: number;
      completionPercent: number;
    }>;
  };
}

function StatCard({ title, value, accentClass }: { title: string; value: string | number; accentClass: string }) {
  return (
    <div className="card relative overflow-hidden border border-black/10 bg-gradient-to-b from-white to-[#fffdf6]">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} aria-hidden />
      <p className="text-xs uppercase tracking-wide text-black/55">{title}</p>
      <p className="mt-1 text-2xl font-black text-black">{value}</p>
    </div>
  );
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const studentUsername = useMemo(() => getParentSelectedStudentSession().trim(), []);
  const [data, setData] = useState<ParentStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseTab, setCourseTab] = useState<"completed" | "inProgress" | "notStarted">("inProgress");
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);
  const [detailAnimIn, setDetailAnimIn] = useState(false);
  const [detailClosing, setDetailClosing] = useState(false);

  function formatISODate(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  function switchProfile() {
    clearParentSession();
    router.push("/parent/profiles");
  }

  useEffect(() => {
    if (!studentUsername) {
      setLoading(false);
      setError("Please choose a student profile first.");
      return;
    }
    setLoading(true);
    setError("");
    api<ParentStudentProfile>("/api/parent/student-profile", {
      method: "GET",
    })
      .then((res) => {
        if (!res.success || !res.data) {
          setError(res.message ?? "Could not load student profile");
          return;
        }
        setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [studentUsername]);

  // Entry animation for the course detail drawer
  useEffect(() => {
    if (!selectedCourseKey) return;
    setDetailClosing(false);
    setDetailAnimIn(false);
    const id = window.requestAnimationFrame(() => setDetailAnimIn(true));
    return () => window.cancelAnimationFrame(id);
  }, [selectedCourseKey]);

  const closeCourseDetail = () => {
    setDetailClosing(true);
    setDetailAnimIn(false);
    window.setTimeout(() => {
      setSelectedCourseKey(null);
      setDetailClosing(false);
    }, 180);
  };

  // Exit drawer on Escape (entry/exit animation stays consistent via closeCourseDetail)
  useEffect(() => {
    if (!selectedCourseKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCourseDetail();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCourseKey]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    );
  }

  if (!studentUsername || error || !data) {
    return (
      <div className="card space-y-3 border border-funt-gold/20 bg-white/95 shadow-md shadow-funt-gold/10">
        <h1 className="text-xl font-bold text-black">Parent Dashboard</h1>
        <p className="text-sm text-black/65">{error || "Please select a student profile first."}</p>
        <div className="flex gap-2">
          <button type="button" onClick={switchProfile} className="btn-primary">
            Choose profile
          </button>
          <Link
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              clearParentSession();
              router.push("/login");
            }}
            className="btn-secondary"
          >
            Student login
          </Link>
        </div>
      </div>
    );
  }

  const attendance = data.attendanceSummary ?? [];
  const avgAttendance = attendance.length
    ? Math.round(
        attendance.reduce((sum, a) => sum + (a.percentage ?? a.attendancePercent ?? 0), 0) / attendance.length
      )
    : 0;
  const totalAttendedSessions = attendance.reduce((sum, a) => sum + (a.presentCount ?? a.attendedCount ?? 0), 0);
  const totalSessions = attendance.reduce((sum, a) => sum + (a.totalSessions ?? a.totalCount ?? 0), 0);

  const profileMeta = [data.user.grade, data.user.schoolName, data.user.city].filter(Boolean).join(" • ");

  // Course progress for parents: derived from enrollment status + enrolled course names.
  const enrollments = data.enrollments ?? [];
  const courseStatusPriority = (status: string) => {
    if (status === "COMPLETED") return 3;
    if (status === "ACTIVE") return 2;
    if (status === "PENDING") return 1;
    return 0;
  };

  const courseStatusByName = new Map<string, { status: string; priority: number }>();
  for (const e of enrollments) {
    for (const name of e.courseNames ?? []) {
      const priority = courseStatusPriority(e.status);
      const existing = courseStatusByName.get(name);
      if (!existing || priority > existing.priority) {
        courseStatusByName.set(name, { status: e.status, priority });
      }
    }
  }

  const moduleProgress = data.chapterProgressSummary ?? data.moduleProgressSummary;
  const courseModuleBreakdown =
    data.chapterProgressSummary?.courses?.map((c) => ({
      courseKey: c.courseKey,
      batchName: c.batchName,
      courseName: c.courseName,
      modules: c.chapters,
      modulesCompleted: c.chaptersCompleted,
      modulesPending: c.chaptersPending,
      modulesTotal: c.chaptersTotal,
      completionPercent: c.completionPercent,
    })) ??
    moduleProgress?.courses ??
    [];

  // Some course snapshots may have an empty `courseName` string.
  // Parent UI should never hide such courses; fall back to a safe label.
  const normalizedCourseModuleBreakdown = courseModuleBreakdown.map((c) => ({
    ...c,
    courseName: typeof c.courseName === "string" ? c.courseName.trim() || "Course" : "Course",
    modules: Array.isArray(c.modules) ? c.modules : [],
  }));

  const sortedCertificates = (data.certificates ?? [])
    .slice()
    .sort((a, b) => String(b.issuedAt ?? "").localeCompare(String(a.issuedAt ?? "")));

  const normalizeCourseName = (name: string | undefined) =>
    String(name ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const courseViews = normalizedCourseModuleBreakdown
    .map((c) => {
      const modules = Array.isArray(c.modules) ? c.modules : [];
      const pendingModules = modules.filter((m) => !m.completed);
      const completedModules = modules.filter((m) => m.completed);
      const modulesKnown = (c.modulesTotal ?? modules.length) > 0 || modules.length > 0;

      const enrollmentStatus = courseStatusByName.get(c.courseName)?.status;
      const computedStatus: "COMPLETED" | "ACTIVE" | "PENDING" = (() => {
        if (modulesKnown) {
          // Parent-friendly classification strictly from module completion.
          if (pendingModules.length === 0) return "COMPLETED";
          if (completedModules.length === 0) return "PENDING";
          return "ACTIVE";
        }
        // If module details are missing, fall back to enrollment status.
        if (enrollmentStatus === "COMPLETED") return "COMPLETED";
        if (enrollmentStatus === "PENDING") return "PENDING";
        return "ACTIVE";
      })();

      return {
        ...c,
        pendingModules,
        completedModules,
        modulesKnown,
        computedStatus,
        nextModuleTitle: pendingModules[0]?.title,
        inProgressModule: pendingModules[0],
        yetToStartModules: pendingModules.slice(1),
      };
    })
    // Always keep courses (even if upstream name fields are empty strings).
    .filter((c) => Boolean(c.courseKey) || Boolean(c.courseName));

  const fallbackCourseViews =
    courseViews.length === 0
      ? (() => {
          const emptyModules: Array<{ order: number; title: string; completed: boolean }> = [];
          return Array.from(courseStatusByName.entries()).map(([courseName, meta]) => ({
            courseKey: courseName,
            courseName: courseName || "Course",
            modules: emptyModules,
            modulesCompleted: 0,
            modulesPending: 0,
            modulesTotal: 0,
            completionPercent: 0,
            modulesKnown: false,
            pendingModules: emptyModules,
            completedModules: emptyModules,
            computedStatus:
              meta.status === "COMPLETED"
                ? ("COMPLETED" as const)
                : meta.status === "PENDING"
                  ? ("PENDING" as const)
                  : ("ACTIVE" as const),
            nextModuleTitle: undefined,
            inProgressModule: undefined,
            yetToStartModules: emptyModules,
          }));
        })()
      : [];

  const finalCourseViews = courseViews.length ? courseViews : fallbackCourseViews;

  const completedCourses = finalCourseViews
    .filter((c) => c.computedStatus === "COMPLETED")
    .slice()
    .sort((a, b) => b.completionPercent - a.completionPercent);
  const inProgressCourses = finalCourseViews
    .filter((c) => c.computedStatus === "ACTIVE")
    .slice()
    .sort((a, b) => a.completionPercent - b.completionPercent);
  const notStartedCourses = finalCourseViews
    .filter((c) => c.computedStatus === "PENDING")
    .slice()
    .sort((a, b) => a.completionPercent - b.completionPercent);

  const activeCourses =
    courseTab === "completed" ? completedCourses : courseTab === "inProgress" ? inProgressCourses : notStartedCourses;

  const selectedCourse = selectedCourseKey
    ? finalCourseViews.find((c) => c.courseKey === selectedCourseKey) ?? null
    : null;

  const selectedCourseCertificates = selectedCourse
    ? sortedCertificates.filter(
        (cert) => normalizeCourseName(cert.courseName) === normalizeCourseName(selectedCourse.courseName)
      )
    : [];
  const latestSelectedCourseCertificate = selectedCourseCertificates[0];

  const tabLabel = courseTab === "completed" ? "Completed" : courseTab === "inProgress" ? "In progress" : "Yet to start";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="page-hero border border-funt-gold/20 bg-gradient-to-b from-white to-[#fffaf0] shadow-md shadow-funt-gold/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-overline">Parent View</p>
            <h1 className="mt-1 text-2xl font-black text-black">{data.user.name}</h1>
            <p className="mt-1 text-sm text-black/60">Course progress, attendance, and what to help next.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-black/65">
          <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 font-mono">{data.user.username}</span>
          {profileMeta ? <span className="rounded-full border border-black/10 bg-white/70 px-2.5 py-1">{profileMeta}</span> : null}
        </div>
      </div>

      {/* Simple top summary (no batch concept) */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Completed courses" value={completedCourses.length} accentClass="bg-emerald-400/80" />
        <StatCard title="In progress" value={inProgressCourses.length} accentClass="bg-funt-gold/80" />
        <StatCard title="Yet to start" value={notStartedCourses.length} accentClass="bg-sky-400/80" />
        <StatCard title="Attendance" value={`${avgAttendance}%`} accentClass="bg-sky-400/50" />
      </div>

      {/* Enrolled courses progress breakdown */}
      <div className="card relative overflow-hidden rounded-3xl border border-funt-gold/20 bg-gradient-to-b from-white to-[#fffaf0] shadow-md shadow-funt-gold/10">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-overline">Parent dashboard</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-black">Enrolled courses progress</h2>
            <p className="mt-1 text-xs text-black/60">Clean snapshots. Tap a course to see full chapter names.</p>
          </div>
          <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold text-black/60">
            {finalCourseViews.length ? `${finalCourseViews.length} courses` : "—"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCourseTab("completed")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              courseTab === "completed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-200/30"
                : "border-black/10 bg-white/70 text-black/60 hover:bg-white hover:shadow-sm"
            }`}
          >
            <IconCertificates className="mr-2 inline-block h-4 w-4" />
            Completed <span className="ml-1 font-bold">{completedCourses.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setCourseTab("inProgress")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              courseTab === "inProgress"
                ? "border-funt-gold/50 bg-funt-gold/25 text-funt-ink shadow-sm shadow-funt-gold/20"
                : "border-black/10 bg-white/70 text-black/60 hover:bg-white hover:shadow-sm"
            }`}
          >
            <IconProgress className="mr-2 inline-block h-4 w-4" />
            In progress <span className="ml-1 font-bold">{inProgressCourses.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setCourseTab("notStarted")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              courseTab === "notStarted"
                ? "border-sky-200 bg-sky-50 text-sky-900 shadow-sm shadow-sky-200/30"
                : "border-black/10 bg-white/70 text-black/60 hover:bg-white hover:shadow-sm"
            }`}
          >
            <IconBook className="mr-2 inline-block h-4 w-4" />
            Yet to start <span className="ml-1 font-bold">{notStartedCourses.length}</span>
          </button>
        </div>

        <div className="mt-3">
          {finalCourseViews.length === 0 ? (
            <p className="text-sm text-black/60">No course progress found yet.</p>
          ) : activeCourses.length === 0 ? (
            <p className="text-sm text-black/60">No courses in this category.</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-2">
              {activeCourses.map((c) => (
                <button
                  key={c.courseKey}
                  type="button"
                  onClick={() => setSelectedCourseKey(c.courseKey)}
                  className="group w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2.5 text-left transition hover:bg-white hover:shadow-md hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-funt-gold/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            c.computedStatus === "COMPLETED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : c.computedStatus === "ACTIVE"
                                ? "border-funt-gold/50 bg-funt-gold/25 text-funt-ink"
                                : "border-sky-200 bg-sky-50 text-sky-900"
                          }`}
                        >
                          {c.computedStatus === "COMPLETED" ? (
                            <IconCertificates className="h-3.5 w-3.5" />
                          ) : c.computedStatus === "ACTIVE" ? (
                            <IconProgress className="h-3.5 w-3.5" />
                          ) : (
                            <IconBook className="h-3.5 w-3.5" />
                          )}
                          {c.computedStatus === "COMPLETED" ? "DONE" : c.computedStatus === "ACTIVE" ? "ACTIVE" : "PENDING"}
                        </span>
                      </div>

                      <p className="mt-1 font-semibold text-black truncate">{c.courseName}</p>
                      <p className="mt-0.5 text-[11px] text-black/60">
                        {!c.modulesKnown ? (
                          "Chapter details unavailable"
                        ) : c.inProgressModule ? (
                          <>
                            In progress: <span className="font-semibold text-black">{c.inProgressModule.title}</span>
                          </>
                        ) : c.yetToStartModules.length ? (
                          <>
                            Next:{" "}
                            <span className="font-semibold text-black">{c.yetToStartModules[0]?.title ?? "—"}</span>
                          </>
                        ) : (
                          "All chapters completed"
                        )}
                      </p>

                      <p className="mt-1 text-[11px] text-black/55">
                        Chapters:{" "}
                        <span className="font-semibold text-black">{c.completedModules.length}</span> done •{" "}
                        <span className="font-semibold text-black">{c.inProgressModule ? 1 : 0}</span> in progress •{" "}
                        <span className="font-semibold text-black">{c.yetToStartModules.length}</span> yet to start
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-gradient-to-b from-funt-honey to-funt-honey/70 px-2.5 py-1 text-[11px] font-semibold text-funt-ink shadow-sm shadow-funt-gold/20">
                      {c.completionPercent}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Course detail drawer */}
        {selectedCourse ? (
          <div className="fixed inset-0 z-50">
            <div
              className={`absolute inset-0 bg-black/35 backdrop-blur-sm transition-opacity duration-200 ${
                detailAnimIn && !detailClosing ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden
            />

            <div
              className={`absolute right-0 top-0 h-full w-full max-w-xl border-l border-black/10 bg-gradient-to-b from-white/95 to-[#fffaf0]/85 backdrop-blur-sm shadow-lg transition-transform duration-200 ${
                detailAnimIn && !detailClosing ? "translate-x-0" : "translate-x-6"
              }`}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 border-b border-black/10 bg-gradient-to-b from-[#fffaf0] to-white px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-black/55">{tabLabel}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {selectedCourse.computedStatus === "COMPLETED" ? (
                      <IconCertificates className="h-4 w-4 text-emerald-700" />
                    ) : selectedCourse.computedStatus === "ACTIVE" ? (
                      <IconProgress className="h-4 w-4 text-funt-gold-deep" />
                    ) : (
                      <IconBook className="h-4 w-4 text-sky-700" />
                    )}
                    <h3 className="truncate text-lg font-bold text-black">{selectedCourse.courseName}</h3>
                  </div>
                  <p className="mt-1 text-xs text-black/60">{selectedCourse.completionPercent}% complete</p>
                </div>
                <button
                  type="button"
                  onClick={closeCourseDetail}
                  className="rounded-xl border border-funt-gold/25 bg-white p-2 text-funt-ink shadow-sm shadow-funt-gold/10 hover:bg-[#fffdf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-funt-gold/40"
                  aria-label="Close course details"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="h-[calc(100%-56px)] overflow-y-auto px-4 py-4">
                {!selectedCourse.modulesKnown ? (
                  <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-3">
                    <p className="text-sm font-semibold text-black">Chapter details unavailable</p>
                    <p className="mt-1 text-xs text-black/60">Refresh the dashboard and try again.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-3">
                      <p className="text-xs font-semibold text-black/55">Progress summary</p>
                      <p className="mt-1 text-sm font-semibold text-black">
                        {selectedCourse.completedModules.length} done • {selectedCourse.inProgressModule ? 1 : 0} in progress •{" "}
                        {selectedCourse.yetToStartModules.length} yet to start
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-black/55">Certificate status:</span>
                        {selectedCourseCertificates.length > 0 ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            Issued{latestSelectedCourseCertificate?.issuedAt ? ` (${formatISODate(latestSelectedCourseCertificate.issuedAt)})` : ""}
                          </span>
                        ) : (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
                            Not issued
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-xs font-semibold text-black/55">
                        <IconCertificates className="h-4 w-4 text-emerald-700" />
                        Completed
                      </p>
                      {selectedCourse.completedModules.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedCourse.completedModules.map((m, idx) => (
                            <span
                              key={`${selectedCourse.courseKey}-completed-${idx}`}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                            >
                              {m.title}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-black/45">—</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-xs font-semibold text-black/55">
                        <IconProgress className="h-4 w-4 text-funt-gold-deep" />
                        In progress
                      </p>
                      {selectedCourse.inProgressModule ? (
                        <span className="inline-flex rounded-full border border-funt-gold/40 bg-funt-gold/20 px-3 py-1 text-[11px] font-semibold text-funt-ink">
                          {selectedCourse.inProgressModule.title}
                        </span>
                      ) : (
                        <p className="text-xs text-black/45">—</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-xs font-semibold text-black/55">
                        <IconBook className="h-4 w-4 text-sky-700" />
                        Yet to start
                      </p>
                      {selectedCourse.yetToStartModules.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedCourse.yetToStartModules.map((m, idx) => (
                            <span
                              key={`${selectedCourse.courseKey}-pending-${idx}`}
                              className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900"
                            >
                              {m.title}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-black/45">—</p>
                      )}
                    </div>

                    {selectedCourse.yetToStartModules.length ? (
                      <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-3">
                        <p className="text-xs font-semibold text-black/55">Next chapter</p>
                        <p className="mt-1 text-sm font-semibold text-black">{selectedCourse.yetToStartModules[0].title}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Simple attendance card (no batch concept) */}
      <div className="card border border-black/10 bg-gradient-to-b from-white to-[#fffdf7]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <IconAttendance className="h-5 w-5 text-funt-ink" />
              <h2 className="text-lg font-bold text-black">Attendance</h2>
            </div>
            <p className="mt-1 text-xs text-black/50">Simple participation summary for parents.</p>
          </div>
          <span className="rounded-full bg-funt-honey px-3 py-1 text-xs font-semibold text-funt-ink">
            {avgAttendance >= 85 ? "Strong" : avgAttendance >= 65 ? "Moderate" : "Needs attention"}
          </span>
        </div>

        {totalSessions === 0 ? (
          <p className="mt-3 text-sm text-black/60">No attendance records yet.</p>
        ) : (
          <div className="mt-3 rounded-xl border border-black/10 bg-white/90 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-black">Class participation</p>
              <p className="rounded-full bg-funt-honey px-2.5 py-1 text-sm font-semibold text-funt-ink">
                {avgAttendance}%
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-funt-gold-deep to-funt-gold"
                style={{ width: `${Math.min(100, Math.max(0, avgAttendance))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-black/55">
              {totalAttendedSessions} attended / {totalSessions} total sessions
            </p>
            <p className="mt-3 text-xs text-black/60">
              {avgAttendance >= 85
                ? "Keep the routine. Small consistent effort gives the best results."
                : avgAttendance >= 65
                  ? "Consistency will improve outcomes. Try to maintain regular attendance."
                  : "To improve progress, aim for more regular class participation over the next few sessions."}
            </p>
          </div>
        )}
      </div>

      {/* Certificates (simple list) */}
      <div className="card border border-black/10 bg-gradient-to-b from-white to-[#fffdf7]">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <IconCertificates className="h-5 w-5 text-emerald-800" />
              <h2 className="text-lg font-bold text-black">Certificates</h2>
            </div>
            <p className="mt-1 text-xs text-black/50">Latest achievements earned by your child.</p>
          </div>
          <span className="text-xs font-semibold text-black/55">
            {sortedCertificates.length ? `${sortedCertificates.length} earned` : "—"}
          </span>
        </div>

        {sortedCertificates.length === 0 ? (
          <p className="text-sm text-black/60">No certificates found yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedCertificates.slice(0, 4).map((cert) => (
              <div
                key={cert.certificateId ?? `${cert.courseName}-${cert.issuedAt}`}
                className="rounded-xl border border-black/10 bg-white/95 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">{cert.courseName ?? "Course"}</p>
                    <p className="mt-0.5 text-xs text-black/55">Issued {formatISODate(cert.issuedAt)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-semibold text-emerald-900 border border-emerald-200/50">
                    Certificate
                  </span>
                </div>
              </div>
            ))}
            {sortedCertificates.length > 4 ? (
              <p className="text-xs text-black/55">Showing latest 4 certificates.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
