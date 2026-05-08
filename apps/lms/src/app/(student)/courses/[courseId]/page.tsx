"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, resolveMediaPlaybackUrl } from "@/lib/api";
import { emitStudentMeRefresh } from "@/lib/studentMeEvents";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { AppPageShell, DataPanel } from "@/components/ui";

interface ChapterItem {
  order: number;
  title: string;
  description?: string;
  content?: string;
  youtubeUrl?: string;
  videoUrl?: string;
  youtubeEmbedUrl?: string;
  /** Parsed id for LMS embed (avoids iframe → API redirect → YouTube with YT.Player, which triggers Error 153). */
  youtubeVideoId?: string;
  videoPlaybackUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
  unlocked: boolean;
  completed: boolean;
  hasContent?: boolean;
  hasVideo?: boolean;
  hasYoutube?: boolean;
  hasAssignment?: boolean;
  contentCompleted?: boolean;
  videoCompleted?: boolean;
  youtubeCompleted?: boolean;
  assignmentCompleted?: boolean;
}

interface BatchCourse {
  batchId: string;
  courseId?: string;
  visibility?: "PUBLIC" | "PRIVATE";
  name: string;
  hasAccess?: boolean;
  /** Enrolled but admin disabled LMS access for this batch enrollment */
  accessBlocked?: boolean;
  isEnrolled?: boolean;
  hasPendingRequest?: boolean;
  hasPendingCoursePayment?: boolean;
  hasRejectedCoursePayment?: boolean;
  coursePaymentRejectReason?: string;
  courseSnapshot: {
    chapters?: ChapterItem[];
    title?: string;
    description?: string;
  };
  zoomLink?: string;
}

/**
 * In-page nocookie embed. `enablejsapi` + `origin` let the parent listen for `onStateChange` / ENDED via postMessage (no YT.Player — avoids Error 153).
 * Do not use /watch URLs or API /media/play as iframe src for the primary player.
 */
function youtubeNocookieEmbedSrc(videoId: string, pageOrigin: string): string {
  const q = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    enablejsapi: "1",
  });
  const o = pageOrigin.trim();
  if (o) q.set("origin", o);
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId.trim())}?${q.toString()}`;
}

const YT_MSG_ORIGINS = new Set(["https://www.youtube.com", "https://www.youtube-nocookie.com"]);
/** YT.PlayerState.ENDED */
const YT_STATE_ENDED = 0;

export function CourseViewerPage({ defaultShowChapters = false }: { defaultShowChapters?: boolean } = {}) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const batchIdFromQuery = searchParams.get("batchId") ?? undefined;
  const learnMode = searchParams.get("learn") === "1";
  const [data, setData] = useState<BatchCourse | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [showChapters, setShowChapters] = useState(defaultShowChapters || learnMode);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [markCompleteSuccess, setMarkCompleteSuccess] = useState(false);
  const [markCompleteError, setMarkCompleteError] = useState<string | null>(null);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [certSuccess, setCertSuccess] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [completedJustNow, setCompletedJustNow] = useState<{ chapterOrder: number; part: "content" | "video" | "youtube" } | null>(null);
  const [ytPageOrigin, setYtPageOrigin] = useState("");
  const youtubeAutoMarkedRef = useRef("");
  const ytListenerGenRef = useRef(0);
  const selectedYoutubeSnapRef = useRef<{ order: number; vid: string; done: boolean }>({ order: -1, vid: "", done: true });
  const markYoutubeDoneRef = useRef<() => void>(() => {});
  const youtubeFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setYtPageOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  /** Tell the nocookie embed we listen for state — required for infoDelivery / onStateChange without loading iframe_api.js. */
  const wireYoutubeIframeListening = useCallback(() => {
    const w = youtubeFrameRef.current?.contentWindow;
    if (!w) return;
    const target = "https://www.youtube-nocookie.com";
    try {
      w.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), target);
      w.postMessage(
        JSON.stringify({
          event: "command",
          func: "addEventListener",
          args: ["onStateChange"],
          id: 1,
          channel: "widget",
        }),
        target
      );
    } catch {
      /* ignore */
    }
  }, []);

  const fetchCourse = (): Promise<void> => {
    if (!courseId) return Promise.resolve();
    const query = new URLSearchParams({ t: String(Date.now()) });
    if (batchIdFromQuery) query.set("batchId", batchIdFromQuery);
    return api<BatchCourse>(`/api/student/courses/${encodeURIComponent(courseId)}?${query.toString()}`, { cache: "no-store" }).then((r) => {
      if (r.success && r.data) {
        setData(r.data);
        setLoadError(null);
      }
    });
  };

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      setData(null);
      setLoadError("Invalid course link.");
      return;
    }
    const query = new URLSearchParams();
    if (batchIdFromQuery) query.set("batchId", batchIdFromQuery);
    const qs = query.toString();
    const url = qs ? `/api/student/courses/${encodeURIComponent(courseId)}?${qs}` : `/api/student/courses/${encodeURIComponent(courseId)}`;
    setLoading(true);
    setLoadError(null);
    setData(null);
    api<BatchCourse>(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" })
      .then((r) => {
        if (r.success && r.data) {
          setData(r.data);
          setLoadError(null);
          return;
        }
        setData(null);
        setLoadError(r.message ?? "Course not found in this batch.");
      })
      .catch(() => {
        setData(null);
        setLoadError("Could not load this course. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [courseId, batchIdFromQuery]);

  const chapters = useMemo(() => {
    if (!data?.courseSnapshot?.chapters?.length) return [];
    return [...data.courseSnapshot.chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [data]);

  const selected = useMemo(() => {
    if (chapters.length === 0) return null;
    if (selectedOrder !== null) return chapters.find((m) => m.order === selectedOrder) ?? chapters[0];
    return chapters[0];
  }, [chapters, selectedOrder]);

  const batchQs = batchIdFromQuery ? `?batchId=${encodeURIComponent(batchIdFromQuery)}` : "";
  const learnRoute = `/courses/${encodeURIComponent(courseId)}${batchQs}${batchQs ? "&" : "?"}learn=1`;
  const courseRoute = `/courses/${encodeURIComponent(courseId)}${batchQs}`;

  useEffect(() => {
    if (learnMode) setShowChapters(true);
  }, [learnMode]);

  useEffect(() => {
    if (showChapters && selectedOrder === null && chapters[0]) {
      setSelectedOrder(chapters[0].order);
    }
  }, [showChapters, selectedOrder, chapters]);

  const normalizedLoadError = (loadError ?? "").toLowerCase();
  const isNetworkIssue =
    normalizedLoadError.includes("could not load") ||
    normalizedLoadError.includes("network") ||
    normalizedLoadError.includes("timeout");
  const shouldRedirectToCourses = !loading && !data && !isNetworkIssue;

  useEffect(() => {
    if (!shouldRedirectToCourses) return;
    router.replace("/courses");
  }, [shouldRedirectToCourses, router]);

  const hasYoutube = !!(selected?.youtubeVideoId || selected?.youtubeEmbedUrl);

  const selectedYoutubeKey = selected ? `${selected.order}:${selected.youtubeVideoId ?? ""}` : "";

  type Part = "content" | "video" | "youtube";
  async function handleMarkPartComplete(part: Part) {
    if (!data?.batchId || !data || selected?.order === undefined) return;
    const chapterOrder = selected.order;
    setMarkingComplete(true);
    setMarkCompleteError(null);
    setCompletedJustNow({ chapterOrder, part });
    setData((prev) => {
      if (!prev?.courseSnapshot?.chapters) return prev;
      const chapters = prev.courseSnapshot.chapters.map((m) => {
        if (m.order !== chapterOrder) return m;
        const key = part === "content" ? "contentCompleted" : part === "video" ? "videoCompleted" : "youtubeCompleted";
        return { ...m, [key]: true };
      });
      return { ...prev, courseSnapshot: { ...prev.courseSnapshot, chapters } };
    });
    try {
      const res = await api<{ completed: boolean; moduleCompleted?: boolean }>(`/api/student/batches/${data.batchId}/progress`, {
        method: "POST",
        body: JSON.stringify({ chapterOrder, part, courseId: data.courseId }),
      });
      if (res.success) {
        setMarkCompleteSuccess(true);
        setTimeout(() => setMarkCompleteSuccess(false), 3000);
        if (res.data?.moduleCompleted) emitStudentMeRefresh();
        await fetchCourse();
        setCompletedJustNow(null);
      } else {
        setMarkCompleteError(res.message ?? "Failed to save progress");
        setCompletedJustNow(null);
        fetchCourse();
      }
    } catch (err) {
      setMarkCompleteError(err instanceof Error ? err.message : "Failed to save progress");
      setCompletedJustNow(null);
      fetchCourse();
    } finally {
      setMarkingComplete(false);
    }
  }

  markYoutubeDoneRef.current = () => {
    void handleMarkPartComplete("youtube");
  };

  const coursePlayerOpen =
    !!data && !loading && data.hasAccess !== false && data.accessBlocked !== true;
  selectedYoutubeSnapRef.current =
    selected?.youtubeVideoId && coursePlayerOpen
      ? {
          order: selected.order,
          vid: selected.youtubeVideoId.trim(),
          done: !!selected.youtubeCompleted,
        }
      : { order: -1, vid: "", done: true };

  useEffect(() => {
    youtubeAutoMarkedRef.current = "";
    ytListenerGenRef.current += 1;
  }, [selectedYoutubeKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selected?.youtubeVideoId?.trim() || selected.youtubeCompleted) return;
    if (!coursePlayerOpen) return;

    const gen = ytListenerGenRef.current;

    const onMessage = (event: MessageEvent) => {
      if (ytListenerGenRef.current !== gen) return;
      if (!YT_MSG_ORIGINS.has(event.origin)) return;
      let body: Record<string, unknown>;
      try {
        body = typeof event.data === "string" ? (JSON.parse(event.data) as Record<string, unknown>) : (event.data as Record<string, unknown>);
      } catch {
        return;
      }
      if (!body || typeof body !== "object") return;

      let state: number | undefined;
      if (body.event === "onStateChange" && typeof body.info === "number") {
        state = body.info;
      } else if (body.event === "infoDelivery" && body.info && typeof body.info === "object") {
        const ps = (body.info as { playerState?: number }).playerState;
        if (typeof ps === "number") state = ps;
      }
      if (state !== YT_STATE_ENDED) return;

      const cur = selectedYoutubeSnapRef.current;
      if (!cur.vid || cur.done) return;
      const key = `${cur.order}:${cur.vid}`;
      if (youtubeAutoMarkedRef.current === key) return;
      youtubeAutoMarkedRef.current = key;
      markYoutubeDoneRef.current();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [coursePlayerOpen, selected?.youtubeVideoId, selected?.order, selected?.youtubeCompleted, selectedYoutubeKey, ytPageOrigin]);

  const isPartCompleted = (part: Part) => {
    if (!selected) return false;
    const fromServer = part === "content" ? selected.contentCompleted : part === "video" ? selected.videoCompleted : selected.youtubeCompleted;
    const justNow = completedJustNow?.chapterOrder === selected.order && completedJustNow?.part === part;
    return !!fromServer || !!justNow;
  };

  async function handleGenerateCertificate() {
    if (!data?.batchId) return;
    setGeneratingCert(true);
    setCertError(null);
    setCertSuccess(null);
    try {
      const res = await api<{ certificateId: string }>("/api/student/certificates/generate", {
        method: "POST",
        body: JSON.stringify({
          batchId: data.batchId,
        }),
      });
      if (res.success && res.data?.certificateId) setCertSuccess(res.data.certificateId);
      else setCertError(res.message ?? "Could not generate certificate");
    } catch (err) {
      setCertError(err instanceof Error ? err.message : "Could not generate certificate");
    } finally {
      setGeneratingCert(false);
    }
  }

  async function handleRequestAccess() {
    if (!data?.batchId) return;
    setRequestingAccess(true);
    setMarkCompleteError(null);
    try {
      const res = await api("/api/student/enrollment-requests", {
        method: "POST",
        body: JSON.stringify({ batchId: data.batchId, courseId: data.courseId }),
      });
      if (res.success) {
        await fetchCourse();
      } else {
        setMarkCompleteError(res.message ?? "Could not send access request");
      }
    } catch (err) {
      setMarkCompleteError(err instanceof Error ? err.message : "Could not send access request");
    } finally {
      setRequestingAccess(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold-deep" />
      </div>
    );
  }

  if (!data) {
    if (shouldRedirectToCourses) {
      return (
        <div className="flex h-full min-h-0 flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold-deep" />
        </div>
      );
    }
    const title = isNetworkIssue
      ? "Unable to load course"
      : "Course unavailable";
    const description = isNetworkIssue
      ? "We could not fetch this course right now. Please retry or open your courses list."
      : "This course is currently unavailable. Please open your courses list and select another course.";

    return (
      <AppPageShell className="max-w-6xl pb-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <DataPanel className="w-full max-w-3xl overflow-hidden border border-black/10 bg-white/95 shadow-xl shadow-black/10">
          <div className="border-b border-black/10 bg-gradient-to-r from-funt-honey/35 via-white to-funt-honey/20 px-6 py-5">
            <p className="label-overline">Course Access</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-black">{title}</h1>
            <p className="mt-1 text-sm text-black/70">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-6 py-5">
            <Link href="/courses" className="btn-primary inline-flex items-center justify-center">
              Back to courses
            </Link>
            {isNetworkIssue ? (
              <Link
                href={`/courses/${encodeURIComponent(courseId)}${batchIdFromQuery ? `?batchId=${encodeURIComponent(batchIdFromQuery)}` : ""}`}
                className="btn-secondary inline-flex items-center justify-center"
              >
                Retry this page
              </Link>
            ) : (
              <Link href="/dashboard" className="btn-secondary inline-flex items-center justify-center">
                Go to dashboard
              </Link>
            )}
          </div>
          </DataPanel>
        </div>
      </AppPageShell>
    );
  }

  const hasAccess = data.hasAccess !== false;
  const blockedByAdmin = data.accessBlocked === true;
  const courseTitle = data.courseSnapshot?.title ?? data.name;
  const courseDescription = data.courseSnapshot?.description ?? "";
  const hasProgress = chapters.some((m) => m.completed);
  const completedCount = chapters.filter((m) => m.completed).length;
  const totalChapters = chapters.length;
  const progressPercent = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;
  const hasLessons = !!(selected?.description || selected?.content);
  const hasHostedVideo = !!selected?.videoPlaybackUrl;
  const hasResourceLink = !!selected?.resourceLinkUrl?.trim?.();
  const hasAssignments = !!selected?.linkedAssignmentId;

  return (
    <AppPageShell className="max-w-7xl pb-8">
      <div className="page-hero flex shrink-0 items-center gap-3 border-black/10 py-5">
        <Link href="/courses" className="inline-flex items-center gap-2 rounded-lg border-2 border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/70 shadow-sm transition hover:border-black/20 hover:bg-funt-honey/30 hover:text-black">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to Courses
        </Link>
        {data.zoomLink && (
          <a href={data.zoomLink} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-2 rounded-lg bg-funt-gold px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-funt-gold-hover">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Join Zoom
          </a>
        )}
      </div>

      <DataPanel className="flex flex-col border border-black/10 bg-white/95 shadow-xl shadow-black/10">
        {!showChapters && (
          <div className="border-b border-black/10 bg-gradient-to-b from-funt-honey/40 to-white px-6 py-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-black">{courseTitle}</h1>
              {courseDescription && (
                <div className={`mt-5 w-full text-black/70 text-sm ${RICH_TEXT_VIEW_CLASS} [&_.ql-cursor]:hidden`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(courseDescription) }} />
              )}
            </div>
          </div>
        )}

        <div className="bg-funt-honey/20 px-6 py-6">
          {blockedByAdmin ? (
            <div className="surface-blocked mx-auto max-w-lg">
              <p className="label-overline text-rose-800/90">Access</p>
              <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700 ring-1 ring-rose-200/80">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-rose-950">Blocked by administrator</h2>
              <p className="text-muted mt-3 text-rose-900/90">
                LMS access is off for this enrollment — not billing or license redemption. Contact your school.
              </p>
            </div>
          ) : !hasAccess ? (
            <div className="card-elevated mx-auto max-w-lg p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-funt-gold/25 text-black ring-1 ring-funt-gold/35 mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <p className="text-lg font-semibold tracking-tight text-black">Not enrolled</p>
              <p className="text-muted mt-2">
                {data.visibility === "PRIVATE"
                  ? "This is a private batch. Ask management for access, or send an access request."
                  : (
                    <>
                      Choose <strong className="text-black">Pay</strong> to submit UPI or Razorpay proof, or{" "}
                      <strong className="text-black">Enter license key</strong> if your school gave you a code.
                    </>
                  )}
              </p>
              {data?.hasRejectedCoursePayment ? (
                <p className="mt-4 rounded-xl border-2 border-black bg-funt-honey px-4 py-3 text-sm font-medium text-black">
                  Your last payment was not approved.
                  {data.coursePaymentRejectReason?.trim() ? (
                    <span className="mt-1 block font-normal text-black/80">Reason: {data.coursePaymentRejectReason.trim()}</span>
                  ) : null}
                  <span className="mt-2 block font-normal text-black/80">Submit a new payment below with the correct details.</span>
                </p>
              ) : null}
              {chapters.length > 0 && (
                <div className="mt-6 rounded-xl border-2 border-black/10 bg-funt-honey/40 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/45">
                    Chapters ({chapters.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {chapters.slice().sort((a, b) => a.order - b.order).map((m) => (
                      <li key={m.order} className="flex items-center gap-2 text-sm text-black/70">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/10 text-xs font-bold text-black">{(m.order ?? 0) + 1}</span>
                        {m.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-6 space-y-3">
                {data?.hasPendingCoursePayment || data?.hasPendingRequest ? (
                  <p className="flex items-center gap-2 rounded-xl border-2 border-black/15 bg-funt-gold/25 px-4 py-3 text-sm font-semibold text-black">
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {data?.hasPendingCoursePayment
                      ? "Payment submitted — waiting for admin approval before you can start."
                      : "Enrollment request pending — waiting for admin approval."}
                  </p>
                ) : null}
                {data.visibility === "PRIVATE" ? (
                  <button
                    type="button"
                    onClick={() => void handleRequestAccess()}
                    disabled={requestingAccess || !!data?.hasPendingRequest}
                    className="inline-flex items-center justify-center rounded-xl bg-funt-gold px-6 py-3 text-sm font-bold text-black shadow-md transition hover:bg-funt-gold-hover disabled:opacity-60"
                  >
                    {data?.hasPendingRequest
                      ? "Access request pending"
                      : requestingAccess
                        ? "Requesting access…"
                        : "Request access"}
                  </button>
                ) : null}
                {data?.batchId && courseId && !data?.hasPendingCoursePayment && data.visibility !== "PRIVATE" ? (
                  <Link
                    href={`/payment?type=course&batchId=${encodeURIComponent(data.batchId)}&courseId=${encodeURIComponent(courseId)}`}
                    className="inline-flex items-center justify-center rounded-xl bg-funt-gold px-6 py-3 text-sm font-bold text-black shadow-md transition hover:bg-funt-gold-hover"
                  >
                    Pay for access
                  </Link>
                ) : null}
                <div className="rounded-xl border border-dashed border-black/15 bg-funt-honey/25 px-4 py-4">
                  <p className="text-sm font-semibold text-black">Have a license key?</p>
                  <Link href="/enroll-license" className="btn-secondary mt-3 inline-flex w-full items-center justify-center py-2.5 text-sm font-semibold">
                    Enter license key
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              {!showChapters ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-black/10 bg-white/95 p-10 shadow-lg shadow-black/10 ring-1 ring-black/5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-funt-honey text-black mb-4">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <span className="rounded-full bg-funt-gold/30 px-3 py-1 text-sm font-bold text-black">{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</span>
                  <p className="mt-4 text-black/65">Open the chapter list and start learning.</p>
                  <button type="button" onClick={() => router.push(learnRoute)} className="mt-6 rounded-xl bg-funt-gold px-10 py-3.5 text-base font-bold text-black shadow-lg shadow-black/10 transition hover:bg-funt-gold-hover hover:shadow-black/15">
                    {hasProgress ? "Continue" : "Start"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-black/10 bg-white/95 p-5 shadow-lg shadow-black/10 ring-1 ring-black/5 lg:w-80">
                    <button
                      type="button"
                      onClick={() => {
                        if (defaultShowChapters) {
                          router.push(courseRoute);
                          return;
                        }
                        setShowChapters(false);
                      }}
                      className="mb-3 flex w-fit items-center gap-1.5 text-sm font-semibold text-black/60 hover:text-black"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      Back
                    </button>
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-funt-gold/35 text-black"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg></span>
                      Chapters
                    </h2>
                    <div className="mb-4 rounded-xl border-2 border-black/10 bg-funt-honey/40 p-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-funt-gold-deep transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-black">{completedCount} of {totalChapters} completed</p>
                      <p className="text-xs text-black/50">{totalChapters - completedCount} pending</p>
                      {markCompleteSuccess && <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-black">Progress saved</p>}
                    </div>
                    {totalChapters > 0 && progressPercent === 100 && (
                      <div className="mb-4 rounded-xl border-2 border-black/10 bg-funt-honey/50 p-3">
                        {certSuccess ? (
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-sm font-bold text-black">Certificate generated</p>
                            <Link href="/certificates" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-funt-gold px-3 py-2 text-sm font-bold text-black shadow-sm transition hover:bg-funt-gold-hover">View in Certificates</Link>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-black">Course completed</p>
                            <p className="text-xs text-black/70">Certificates are free — tap generate when you are eligible.</p>
                            <button type="button" onClick={handleGenerateCertificate} disabled={generatingCert} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-funt-gold px-3 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-funt-gold-hover disabled:opacity-60">
                              {generatingCert ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />Generating…</> : <>Generate certificate</>}
                            </button>
                            {certError && <p className="text-xs font-semibold text-black">{certError}</p>}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="-mx-1 px-1">
                      <ul className="space-y-1.5">
                        {chapters.map((m) => (
                          <li key={m.order}>
                            <button type="button" onClick={() => setSelectedOrder(m.order)} disabled={!m.unlocked} className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${selected?.order === m.order ? "bg-funt-gold text-black shadow-md ring-2 ring-black/10" : m.unlocked ? "text-black/80 hover:bg-funt-honey/50 hover:text-black" : "cursor-not-allowed text-black/35"}`}>
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{m.unlocked ? (m.completed ? "✓" : (m.order ?? 0) + 1) : "🔒"}</span>
                              <span className="min-w-0 flex-1 truncate">{m.title}</span>
                              <span className="shrink-0 text-[11px] font-semibold text-black/55">
                                {m.completed ? "Completed" : m.unlocked ? "In Progress" : "Not Started"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </aside>
                  <div className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white/95 p-6 shadow-lg shadow-black/10 ring-1 ring-black/5">
                    {selected ? (
                      <div className="space-y-8">
                        <h2 className="text-xl font-black tracking-tight text-black border-b border-black/10 pb-4">{selected.title}</h2>
                        {hasLessons && (
                          <section className="rounded-2xl border-2 border-black/10 bg-gradient-to-b from-funt-honey/30 to-white p-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-black/60 mb-2">Content</h3>
                            {selected.description && (
                              <div className={`text-black/70 text-sm mb-4 ${RICH_TEXT_VIEW_CLASS}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.description) }} />
                            )}
                            {selected.content && <div className={`text-black/80 ${RICH_TEXT_VIEW_CLASS}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.content) }} />}
                            {selected.hasContent && (
                              <div className="mt-4">
                                {isPartCompleted("content") ? <span className="inline-flex items-center gap-2 rounded-xl border-2 border-black/15 bg-funt-honey px-4 py-2.5 text-sm font-bold text-black">Completed</span> : <button type="button" onClick={() => handleMarkPartComplete("content")} disabled={markingComplete} className="inline-flex items-center gap-2 rounded-xl bg-funt-gold px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-funt-gold-hover disabled:opacity-60">{markingComplete ? "Marking…" : "Mark as completed"}</button>}
                              </div>
                            )}
                          </section>
                        )}
                        {hasYoutube && (
                          <section className="rounded-2xl border-2 border-black/10 bg-gradient-to-b from-funt-honey/30 to-white p-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-black/60 mb-2">YouTube Video</h3>
                            {selected.youtubeVideoId ? (
                              <>
                                <div className="aspect-video rounded-xl overflow-hidden bg-black/10 shadow-inner ring-1 ring-black/10">
                                  <iframe
                                    ref={youtubeFrameRef}
                                    title={selected.title}
                                    src={youtubeNocookieEmbedSrc(selected.youtubeVideoId, ytPageOrigin)}
                                    className="h-full w-full min-h-[220px]"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    suppressHydrationWarning
                                    onLoad={() => {
                                      wireYoutubeIframeListening();
                                      window.setTimeout(wireYoutubeIframeListening, 400);
                                    }}
                                  />
                                </div>
                                <div className="mt-4 space-y-2">
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold ${
                                      selected.youtubeCompleted
                                        ? "border-black/15 bg-funt-honey text-black"
                                        : selected.unlocked
                                          ? "border-black/10 bg-white text-black/75"
                                          : "border-black/10 bg-white text-black/55"
                                    }`}
                                  >
                                    {selected.youtubeCompleted
                                      ? "Completed"
                                      : selected.unlocked
                                        ? "In Progress"
                                        : "Not Started"}
                                  </span>
                                  {markCompleteError && <p className="text-sm font-medium text-black">{markCompleteError}</p>}
                                </div>
                              </>
                            ) : (
                              <div className="rounded-xl border border-black/10 bg-funt-honey/30 p-4 text-sm text-black/80">
                                <p className="font-medium text-black">Inline player needs a course refresh</p>
                                <p className="mt-2 text-black/70">
                                  This chapter has no embed id yet. Ask your admin to re-save the course, or open the video in a new tab (your LMS tab stays here).
                                </p>
                                {selected.youtubeEmbedUrl ? (
                                  <a
                                    href={resolveMediaPlaybackUrl(selected.youtubeEmbedUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-funt-gold px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-funt-gold-hover"
                                  >
                                    Open video in new tab
                                  </a>
                                ) : null}
                              </div>
                            )}
                          </section>
                        )}
                        {hasHostedVideo && (
                          <section className="rounded-2xl border-2 border-black/10 bg-gradient-to-b from-funt-honey/30 to-white p-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-black/60 mb-2">Video</h3>
                            <div className="aspect-video rounded-xl overflow-hidden bg-black/10 shadow-inner">
                              <video
                                src={resolveMediaPlaybackUrl(selected.videoPlaybackUrl)}
                                controls
                                controlsList="nodownload noremoteplayback"
                                disablePictureInPicture
                                className="w-full h-full"
                                onEnded={() => {
                                  if (!isPartCompleted("video")) void handleMarkPartComplete("video");
                                }}
                              />
                            </div>
                            <div className="mt-4">
                              {isPartCompleted("video") ? (
                                <span className="inline-flex items-center gap-2 rounded-xl border-2 border-black/15 bg-funt-honey px-4 py-2.5 text-sm font-bold text-black">Completed</span>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-black/70">
                                  Auto-completes after full video playback.
                                </span>
                              )}
                              {markCompleteError && <p className="mt-2 text-sm font-medium text-black">{markCompleteError}</p>}
                            </div>
                          </section>
                        )}
                        {hasResourceLink && (
                          <section className="rounded-2xl border-2 border-black/10 bg-gradient-to-b from-funt-honey/30 to-white p-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-black/60 mb-2">Resource</h3>
                            <a
                              href={selected.resourceLinkUrl!.startsWith("http") ? selected.resourceLinkUrl! : `https://${selected.resourceLinkUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black shadow-sm transition hover:border-funt-gold hover:bg-funt-honey/50"
                            >
                              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              Open resource
                            </a>
                          </section>
                        )}
                        {hasAssignments && (
                          <section className="rounded-2xl border-2 border-black/10 bg-gradient-to-b from-funt-honey/30 to-white p-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-black/60 mb-2">Assignment</h3>
                            <p className="text-black/70 mb-4">Course assignment for this chapter. Submit and wait for admin approval to complete this part.</p>
                            {selected.assignmentCompleted ? <span className="inline-flex items-center gap-2 rounded-xl border-2 border-black/15 bg-funt-honey px-4 py-2.5 text-sm font-bold text-black">Approved</span> : <Link href={`/assignments?batchId=${data.batchId}&courseId=${data.courseId ?? ""}&chapterOrder=${selected.order}&assignmentId=${selected.linkedAssignmentId}`} className="inline-flex items-center gap-2 rounded-xl bg-funt-gold px-5 py-2.5 text-sm font-bold text-black shadow-md transition hover:bg-funt-gold-hover">Submit Assignment</Link>}
                          </section>
                        )}
                      </div>
                    ) : (
                      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border-2 border-dashed border-black/15 bg-funt-honey/20"><p className="text-black/55">Select a chapter from the list.</p></div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DataPanel>
    </AppPageShell>
  );
}

export default CourseViewerPage;
