"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function toYouTubeEmbedUrl(url: string): string | null {
  if (!url?.trim()) return null;
  const s = url.trim();
  const watchMatch = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const embedMatch = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  const shortIdMatch = s.match(/^([a-zA-Z0-9_-]{11})$/);
  const id = watchMatch?.[1] ?? embedMatch?.[1] ?? shortIdMatch?.[1];
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}`;
}

interface ModuleItem {
  order: number;
  title: string;
  description?: string;
  content?: string;
  youtubeUrl?: string;
  videoUrl?: string;
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
  name: string;
  hasAccess?: boolean;
  hasPendingRequest?: boolean;
  courseSnapshot: {
    modules?: ModuleItem[];
    title?: string;
    description?: string;
  };
  zoomLink?: string;
}

export default function CourseViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const batchIdFromQuery = searchParams.get("batchId") ?? undefined;
  const [data, setData] = useState<BatchCourse | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [showModules, setShowModules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [markCompleteSuccess, setMarkCompleteSuccess] = useState(false);
  const [markCompleteError, setMarkCompleteError] = useState<string | null>(null);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [certSuccess, setCertSuccess] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [requestingEnroll, setRequestingEnroll] = useState(false);
  const [requestEnrollSent, setRequestEnrollSent] = useState(false);
  const [requestEnrollError, setRequestEnrollError] = useState<string | null>(null);
  /** Track part just marked complete so UI switches to "Completed" immediately before refetch. */
  const [completedJustNow, setCompletedJustNow] = useState<{ moduleOrder: number; part: "content" | "video" | "youtube" } | null>(null);

  const fetchCourse = (): Promise<void> => {
    if (!courseId) return Promise.resolve();
    const query = new URLSearchParams({ t: String(Date.now()) });
    if (batchIdFromQuery) query.set("batchId", batchIdFromQuery);
    return api<BatchCourse>(`/api/student/courses/${encodeURIComponent(courseId)}?${query.toString()}`, { cache: "no-store" }).then((r) => {
      if (r.success && r.data) setData(r.data);
    });
  };

  useEffect(() => {
    if (!courseId) return;
    const query = new URLSearchParams();
    if (batchIdFromQuery) query.set("batchId", batchIdFromQuery);
    const qs = query.toString();
    const url = qs ? `/api/student/courses/${encodeURIComponent(courseId)}?${qs}` : `/api/student/courses/${encodeURIComponent(courseId)}`;
    api<BatchCourse>(url, { cache: "no-store" }).then((r) => {
      if (r.success && r.data) setData(r.data);
    }).finally(() => setLoading(false));
  }, [courseId, batchIdFromQuery]);

  type Part = "content" | "video" | "youtube";
  async function handleMarkPartComplete(part: Part) {
    if (!data?.batchId || !data || selected?.order === undefined) return;
    const moduleOrder = selected.order;
    setMarkingComplete(true);
    setMarkCompleteError(null);
    setCompletedJustNow({ moduleOrder, part });
    setData((prev) => {
      if (!prev?.courseSnapshot?.modules) return prev;
      const modules = prev.courseSnapshot.modules.map((m) => {
        if (m.order !== moduleOrder) return m;
        const key = part === "content" ? "contentCompleted" : part === "video" ? "videoCompleted" : "youtubeCompleted";
        return { ...m, [key]: true };
      });
      return { ...prev, courseSnapshot: { ...prev.courseSnapshot, modules } };
    });
    try {
      const res = await api<{ completed: boolean; moduleCompleted?: boolean }>(`/api/student/batches/${data.batchId}/progress`, {
        method: "POST",
        body: JSON.stringify({ moduleOrder, part, courseId: data.courseId }),
      });
      if (res.success) {
        setMarkCompleteSuccess(true);
        setTimeout(() => setMarkCompleteSuccess(false), 3000);
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

  const isPartCompleted = (part: Part) => {
    if (!selected) return false;
    const fromServer = part === "content" ? selected.contentCompleted : part === "video" ? selected.videoCompleted : selected.youtubeCompleted;
    const justNow = completedJustNow?.moduleOrder === selected.order && completedJustNow?.part === part;
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
        body: JSON.stringify({ batchId: data.batchId }),
      });
      if (res.success && res.data?.certificateId) setCertSuccess(res.data.certificateId);
      else setCertError(res.message ?? "Could not generate certificate");
    } catch (err) {
      setCertError(err instanceof Error ? err.message : "Could not generate certificate");
    } finally {
      setGeneratingCert(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  const hasAccess = data.hasAccess !== false;
  const courseTitle = data.courseSnapshot?.title ?? data.name;
  const courseDescription = data.courseSnapshot?.description ?? "";
  const modules = (data.courseSnapshot?.modules ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const hasProgress = modules.some((m) => m.completed);
  const selected = selectedOrder !== null ? modules.find((m) => m.order === selectedOrder) ?? modules[0] : modules[0];
  const completedCount = modules.filter((m) => m.completed).length;
  const totalModules = modules.length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const hasLessons = !!(selected?.description || selected?.content);
  const hasYoutube = !!selected?.youtubeUrl;
  const hasHostedVideo = !!selected?.videoUrl;
  const hasResourceLink = !!selected?.resourceLinkUrl?.trim?.();
  const hasAssignments = !!selected?.linkedAssignmentId;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
      <div className="flex shrink-0 items-center gap-3">
        <Link href="/courses" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to Courses
        </Link>
        {data.zoomLink && (
          <a href={data.zoomLink} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Join Zoom
          </a>
        )}
      </div>

      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30 ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{courseTitle}</h1>
            {courseDescription && (
              <div className="mt-5 max-w-3xl text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none [&_h1]:text-lg [&_h2]:text-base [&_p]:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_.ql-cursor]:hidden" dangerouslySetInnerHTML={{ __html: courseDescription }} />
            )}
          </div>
        </div>

        <div className="bg-slate-50/70 px-6 py-6">
          {!hasAccess ? (
            <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 shadow-lg ring-1 ring-slate-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <p className="text-slate-700 font-medium">You are not enrolled in this course.</p>
              <p className="mt-1 text-sm text-slate-500">
                Request enrollment below; you will be added to this batch when an admin approves.
              </p>
              {modules.length > 0 && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">What you&apos;ll learn ({modules.length} module{modules.length !== 1 ? "s" : ""})</h3>
                  <ul className="space-y-1.5">
                    {modules.slice().sort((a, b) => a.order - b.order).map((m) => (
                      <li key={m.order} className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700">{(m.order ?? 0) + 1}</span>
                        {m.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-6">
                {(data?.hasPendingRequest || requestEnrollSent) ? (
                  <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Already requested
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!courseId) return;
                        setRequestingEnroll(true);
                        setRequestEnrollError(null);
                        const body = batchIdFromQuery ? { courseId, batchId: batchIdFromQuery } : { courseId };
                        const res = await api<{ message?: string }>("/api/student/enrollment-requests", { method: "POST", body: JSON.stringify(body) });
                        setRequestingEnroll(false);
                        if (res.success) setRequestEnrollSent(true);
                        else setRequestEnrollError(res.message ?? "Could not send request");
                      }}
                      disabled={requestingEnroll}
                      className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
                    >
                      {requestingEnroll ? "Sending…" : "Request enrollment"}
                    </button>
                    {requestEnrollError && <p className="mt-2 text-sm text-red-600">{requestEnrollError}</p>}
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {!showModules ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 shadow-lg ring-1 ring-slate-100">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600 mb-4">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-700">{modules.length} module{modules.length !== 1 ? "s" : ""}</span>
                  <p className="mt-4 text-slate-600">Open the module list and start learning.</p>
                  <button type="button" onClick={() => { setShowModules(true); if (modules[0]) setSelectedOrder(modules[0].order); }} className="mt-6 rounded-xl bg-teal-600 px-10 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-teal-600/30">
                    {hasProgress ? "Continue" : "Start"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-md ring-1 ring-slate-100 lg:w-80">
                    <button type="button" onClick={() => setShowModules(false)} className="mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      Back
                    </button>
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-600"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg></span>
                      Modules
                    </h2>
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-teal-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">{completedCount} of {totalModules} completed</p>
                      <p className="text-xs text-slate-500">{totalModules - completedCount} pending</p>
                      {markCompleteSuccess && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">Progress saved</p>}
                    </div>
                    {totalModules > 0 && progressPercent === 100 && (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                        {certSuccess ? (
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">Certificate generated</p>
                            <Link href="/certificates" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700">View in Certificates</Link>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-700">Course completed</p>
                            <button type="button" onClick={handleGenerateCertificate} disabled={generatingCert} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60">
                              {generatingCert ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating…</> : <>Generate certificate</>}
                            </button>
                            {certError && <p className="text-xs font-medium text-red-600">{certError}</p>}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="-mx-1 px-1">
                      <ul className="space-y-1.5">
                        {modules.map((m) => (
                          <li key={m.order}>
                            <button type="button" onClick={() => setSelectedOrder(m.order)} disabled={!m.unlocked} className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${selected?.order === m.order ? "bg-teal-600 text-white shadow-md" : m.unlocked ? "text-slate-700 hover:bg-slate-100 hover:text-slate-900" : "cursor-not-allowed text-slate-400"}`}>
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{m.unlocked ? (m.completed ? "✓" : (m.order ?? 0) + 1) : "🔒"}</span>
                              <span className="truncate">{m.title}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </aside>
                  <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-md ring-1 ring-slate-100">
                    {selected ? (
                      <div className="space-y-8">
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-4">{selected.title}</h2>
                        {hasLessons && (
                          <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-6 ring-1 ring-slate-100">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Content</h3>
                            {selected.description && (
                              <div className="text-slate-600 text-sm mb-4 prose prose-sm max-w-none [&_h1]:text-lg [&_h2]:text-base [&_p]:my-1 [&_ul]:list-disc [&_ol]:list-decimal" dangerouslySetInnerHTML={{ __html: selected.description }} />
                            )}
                            {selected.content && <div className="text-slate-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selected.content }} />}
                            {selected.hasContent && (
                              <div className="mt-4">
                                {isPartCompleted("content") ? <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">Completed</span> : <button type="button" onClick={() => handleMarkPartComplete("content")} disabled={markingComplete} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">{markingComplete ? "Marking…" : "Mark as completed"}</button>}
                              </div>
                            )}
                          </section>
                        )}
                        {hasYoutube && (
                          <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-6 ring-1 ring-slate-100">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">YouTube Video</h3>
                            {(() => {
                              const embedSrc = selected.youtubeUrl ? toYouTubeEmbedUrl(selected.youtubeUrl) : null;
                              if (!embedSrc) return <a href={selected.youtubeUrl!.startsWith("http") ? selected.youtubeUrl! : `https://${selected.youtubeUrl}`} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-600 hover:underline">Watch video: {selected.youtubeUrl}</a>;
                              return (
                                <>
                                  <div className="aspect-video rounded-xl overflow-hidden bg-slate-200 shadow-inner">
                                    <iframe title={selected.title} src={embedSrc} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                                  </div>
                                  <div className="mt-4">
                                    {selected.youtubeCompleted ? <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">Completed</span> : <button type="button" onClick={() => handleMarkPartComplete("youtube")} disabled={markingComplete} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">{markingComplete ? "Marking…" : "Mark as completed"}</button>}
                                    {markCompleteError && <p className="mt-2 text-sm text-red-600">{markCompleteError}</p>}
                                  </div>
                                </>
                              );
                            })()}
                          </section>
                        )}
                        {hasHostedVideo && (
                          <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-6 ring-1 ring-slate-100">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Video</h3>
                            <div className="aspect-video rounded-xl overflow-hidden bg-slate-200 shadow-inner">
                              <video src={selected.videoUrl} controls className="w-full h-full" />
                            </div>
                            <div className="mt-4">
                              {isPartCompleted("video") ? <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">Completed</span> : <button type="button" onClick={() => handleMarkPartComplete("video")} disabled={markingComplete} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">{markingComplete ? "Marking…" : "Mark as completed"}</button>}
                              {markCompleteError && <p className="mt-2 text-sm text-red-600">{markCompleteError}</p>}
                            </div>
                          </section>
                        )}
                        {hasResourceLink && (
                          <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-6 ring-1 ring-slate-100">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Resource</h3>
                            <a
                              href={selected.resourceLinkUrl!.startsWith("http") ? selected.resourceLinkUrl! : `https://${selected.resourceLinkUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
                            >
                              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              Open resource
                            </a>
                          </section>
                        )}
                        {hasAssignments && (
                          <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-6 ring-1 ring-slate-100">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">Assignment</h3>
                            <p className="text-slate-600 mb-4">Course assignment for this module. Submit and wait for admin approval to complete this part.</p>
                            {selected.assignmentCompleted ? <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">Approved</span> : <Link href={`/assignments?batchId=${data.batchId}&courseId=${data.courseId ?? ""}&moduleOrder=${selected.order}&assignmentId=${selected.linkedAssignmentId}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700">Submit Assignment</Link>}
                          </section>
                        )}
                      </div>
                    ) : (
                      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50"><p className="text-slate-500">Select a module from the list.</p></div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
