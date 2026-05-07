"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { SUBMISSION_TYPE } from "@funt-platform/constants";
import { AppPageShell, DataPanel } from "@/components/ui";

interface AssignmentInfo {
  id: string;
  title: string;
  instructions: string;
  submissionType: string;
}

interface GlobalAssignment extends AssignmentInfo {
  skillTags: string[];
  status: string;
}

interface MySubmissionItem {
  id: string;
  type: "chapter" | "general";
  assignmentId: string;
  assignmentTitle: string;
  batchId?: string;
  batchName?: string;
  courseId?: string;
  chapterOrder?: number;
  status: string;
  feedback?: string;
  rating?: number;
  submittedAt: string;
  reviewedAt?: string;
}

const SUBMISSION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: SUBMISSION_TYPE.TEXT, label: "Text" },
  { value: SUBMISSION_TYPE.LINK, label: "Link" },
];

function toSubmissionType(raw: string): SUBMISSION_TYPE {
  return raw === SUBMISSION_TYPE.LINK ? SUBMISSION_TYPE.LINK : raw === SUBMISSION_TYPE.FILE ? SUBMISSION_TYPE.FILE : SUBMISSION_TYPE.TEXT;
}

const RICH_TEXT_PREVIEW_CLASS =
  "[&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0 [&_li]:my-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_.ql-align-center]:text-center [&_.ql-align-right]:text-right [&_.ql-align-justify]:text-justify [&_.ql-indent-1]:pl-3 [&_.ql-indent-2]:pl-6 [&_.ql-indent-3]:pl-[4.5rem] [&_.ql-indent-4]:pl-[6rem]";

export default function AssignmentsPage() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId") ?? "";
  const courseIdParam = searchParams.get("courseId") ?? "";
  const chapterOrder = searchParams.get("chapterOrder") ?? searchParams.get("moduleOrder") ?? "";
  const assignmentIdParam = searchParams.get("assignmentId") ?? "";
  const isInChapterMode = !!(batchId && chapterOrder !== "" && assignmentIdParam);

  const [assignments, setAssignments] = useState<GlobalAssignment[]>([]);
  const [chapterAssignment, setChapterAssignment] = useState<AssignmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [assignmentId, setAssignmentId] = useState("");
  const [submissionType, setSubmissionType] = useState(SUBMISSION_TYPE.TEXT);
  const [submissionContent, setSubmissionContent] = useState("");
  const [mySubmissions, setMySubmissions] = useState<{ chapterSubmissions: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] } | null>(null);
  /** Set to true after a successful chapter submit so the UI shows "Already submitted" immediately without waiting for refetch. */
  const [submittedJustNow, setSubmittedJustNow] = useState(false);

  useEffect(() => {
    if (isInChapterMode) {
      const params = new URLSearchParams({ batchId, chapterOrder });
      if (courseIdParam) params.set("courseId", courseIdParam);
      const assignUrl = `/api/student/assignments/${assignmentIdParam}?${params.toString()}`;
      Promise.all([
        api<AssignmentInfo>(assignUrl),
        api<{ chapterSubmissions?: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions"),
      ])
        .then(([assignRes, subsRes]) => {
          if (assignRes.success && assignRes.data) {
            setChapterAssignment(assignRes.data);
            setSubmissionType(toSubmissionType(assignRes.data.submissionType));
          }
          if (subsRes.success && subsRes.data) {
            setMySubmissions({
              chapterSubmissions: subsRes.data.chapterSubmissions ?? [],
              generalSubmissions: subsRes.data.generalSubmissions ?? [],
            });
          }
        })
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        api<GlobalAssignment[]>("/api/student/assignments/general").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
        api<{ chapterSubmissions?: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions").then((r) =>
          r.success && r.data
            ? {
                chapterSubmissions: r.data.chapterSubmissions ?? [],
                generalSubmissions: r.data.generalSubmissions ?? [],
              }
            : { chapterSubmissions: [], generalSubmissions: [] }
        ),
      ])
        .then(([a, subs]) => {
          setAssignments(a);
          setMySubmissions(subs);
        })
        .finally(() => setLoading(false));
    }
  }, [isInChapterMode, assignmentIdParam, batchId, courseIdParam, chapterOrder]);

  const hasAlreadySubmittedChapter =
    isInChapterMode &&
    (submittedJustNow ||
      !!mySubmissions?.chapterSubmissions.some(
        (s) =>
          s.batchId === batchId &&
          s.chapterOrder === Number(chapterOrder) &&
          (courseIdParam ? (s as { courseId?: string }).courseId === courseIdParam : true)
      ));

  const handleAssignmentChange = (id: string) => {
    setAssignmentId(id);
    const a = assignments.find((x) => x.id === id);
    if (a) setSubmissionType(toSubmissionType(a.submissionType));
  };

  const resetForm = () => {
    setAssignmentId("");
    setSubmissionType(SUBMISSION_TYPE.TEXT);
    setSubmissionContent("");
  };

  async function submitGlobal(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitLoading(true);
    try {
      const res = await api("/api/student/assignments/general/submit", {
        method: "POST",
        body: JSON.stringify({
          assignmentId,
          submissionType,
          submissionContent: submissionContent.trim(),
        }),
      });
      if (res.success) {
        setMessage({ type: "success", text: "Successfully submitted." });
        resetForm();
        api<{ chapterSubmissions?: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions").then((r) =>
          r.success && r.data
            ? setMySubmissions({
                chapterSubmissions: r.data.chapterSubmissions ?? [],
                generalSubmissions: r.data.generalSubmissions ?? [],
              })
            : null
        );
      } else {
        setMessage({ type: "error", text: res.message ?? "Submission failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setSubmitLoading(false);
    }
  }

  async function submitInChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!chapterAssignment) return;
    setMessage(null);
    setSubmitLoading(true);
    try {
      const res = await api("/api/assignments/submit", {
        method: "POST",
        body: JSON.stringify({
          batchId,
          courseId: courseIdParam || undefined,
          chapterOrder: Number(chapterOrder),
          assignmentId: assignmentIdParam,
          submissionType: chapterAssignment.submissionType,
          submissionContent: submissionContent.trim(),
        }),
      });
      if (res.success) {
        setMessage({ type: "success", text: "Successfully submitted. Your trainer will review and you can see feedback under Submissions." });
        setSubmissionContent("");
        setSubmittedJustNow(true);
        // Refetch so submissions list is up to date when they navigate there
        api<{ chapterSubmissions?: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions").then((r) => {
          if (r.success && r.data) {
            setMySubmissions({
              chapterSubmissions: r.data.chapterSubmissions ?? [],
              generalSubmissions: r.data.generalSubmissions ?? [],
            });
          }
        });
      } else {
        setMessage({ type: "error", text: res.message ?? "Submission failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setSubmitLoading(false);
    }
  }

  const backButtonClass =
    "inline-flex items-center gap-2 rounded-lg border-2 border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/70 shadow-sm transition hover:border-black/20 hover:bg-funt-honey/30 hover:text-black";

  const messageAlert = message ? (
    <div
      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold ${
        message.type === "success" ? "border-black/15 bg-funt-honey text-black" : "border-black bg-funt-gold/25 text-black"
      }`}
    >
      {message.type === "success" ? (
        <svg className="h-5 w-5 shrink-0 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="h-5 w-5 shrink-0 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )}
      {message.text}
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold-deep" />
      </div>
    );
  }

  if (isInChapterMode) {
    if (!chapterAssignment) {
      return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8">
          <Link href="/assignments" className={backButtonClass}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Assignments
          </Link>
          <div className="rounded-2xl border-2 border-black/10 bg-white px-6 py-10 shadow-sm">
            <p className="text-black/70">Assignment not found or you don&apos;t have access.</p>
            <Link href="/courses" className="mt-4 inline-block text-sm font-medium text-funt-gold-deep hover:text-funt-gold-deep/90">Back to Courses</Link>
          </div>
        </div>
      );
    }

    const courseBackHref = courseIdParam ? `/courses/${encodeURIComponent(courseIdParam)}${batchId ? `?batchId=${encodeURIComponent(batchId)}` : ""}` : "/courses";
    const courseLearnHref = courseIdParam
      ? `/courses/${encodeURIComponent(courseIdParam)}${batchId ? `?batchId=${encodeURIComponent(batchId)}&learn=1` : "?learn=1"}`
      : "/courses";

    return (
      <AppPageShell className="max-w-5xl pb-8">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link href="/assignments" className={backButtonClass}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Assignments
          </Link>
          <Link href={courseBackHref} className={backButtonClass}>
            Back to course
          </Link>
        </div>

        <DataPanel className="flex flex-col border-2 border-black/10 shadow-xl shadow-black/5">
          <div className="border-b border-black/10 bg-gradient-to-b from-funt-honey/40 to-white px-6 py-6">
            <p className="text-sm font-bold uppercase tracking-wider text-black/55">Chapter assignment</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-black">{chapterAssignment.title}</h1>
          </div>

          <div className="px-6 py-6">
          {hasAlreadySubmittedChapter ? (
            <>
              <div className="flex items-center gap-3 rounded-xl border-2 border-black/15 bg-funt-honey px-4 py-4 text-black">
                <svg className="h-6 w-6 shrink-0 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-bold text-black">Already submitted</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={courseLearnHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-funt-gold px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-funt-gold-hover"
                >
                  Continue with course
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
                <Link href="/assignments" className="text-sm font-semibold text-black/65 hover:text-black">View submissions</Link>
              </div>
            </>
          ) : (
          <form onSubmit={submitInChapter} className="space-y-5">
            {chapterAssignment.instructions && (
              <div className="rounded-xl border-2 border-black/10 bg-funt-honey/30 px-4 py-3">
                <p className="text-sm font-bold text-black">Instructions</p>
                <div className={`mt-1 text-sm text-black/75 ${RICH_TEXT_VIEW_CLASS}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(chapterAssignment.instructions) }} />
              </div>
            )}
            <div>
              <label htmlFor="content-module" className="block text-sm font-bold text-black">
                {chapterAssignment.submissionType === SUBMISSION_TYPE.LINK ? "Your link" : "Your submission (text)"}
              </label>
              <textarea
                id="content-module"
                required
                value={submissionContent}
                onChange={(e) => setSubmissionContent(e.target.value)}
                placeholder={chapterAssignment.submissionType === SUBMISSION_TYPE.LINK ? "Paste your link here" : "Write your submission here"}
                className="mt-2 min-h-[180px] w-full resize-y rounded-xl border-2 border-black/10 bg-white px-3.5 py-3 text-sm text-black placeholder-black/35 focus:border-funt-gold focus:outline-none focus:ring-2 focus:ring-funt-gold/25"
                rows={6}
              />
            </div>
            {messageAlert}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitLoading || !submissionContent.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-funt-gold px-6 py-3 text-sm font-semibold text-black shadow-md transition hover:bg-funt-gold-hover disabled:opacity-50"
              >
                {submitLoading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> Submitting…</>
                ) : (
                  "Submit"
                )}
              </button>
              <Link href={courseBackHref} className="text-sm font-semibold text-black/65 hover:text-black">Back to course</Link>
            </div>
          </form>
          )}
          </div>
        </DataPanel>
      </AppPageShell>
    );
  }

  const expandedId = assignmentId || null;
  const expandedAssignment = expandedId ? assignments.find((a) => a.id === expandedId) : null;
  const expandedAlreadySubmitted = expandedId ? mySubmissions?.generalSubmissions.some((s) => s.assignmentId === expandedId) : false;

  return (
    <AppPageShell className="max-w-5xl pb-8">
      <div className="page-hero shrink-0 py-5">
        <h1 className="text-2xl font-black tracking-tight text-black">Assignments</h1>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-black/50">Assignments assigned to you</h2>
          {assignments.length === 0 ? (
            <div className="mt-3 rounded-2xl border-2 border-black/10 bg-funt-honey/25 px-6 py-10 text-center">
              <p className="text-black/75">No assignments assigned to you yet.</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a) => {
                const alreadySubmitted = mySubmissions?.generalSubmissions.some((s) => s.assignmentId === a.id);
                const isExpanded = expandedId === a.id;
                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl border bg-white/95 shadow-md shadow-black/5 ring-1 transition ${
                      isExpanded ? "border-funt-gold ring-2 ring-black/10" : "border-black/10 ring-1 ring-black/5 hover:border-black/20"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-black">{a.title}</h3>
                        {alreadySubmitted ? (
                          <span className="shrink-0 rounded-full border border-black/15 bg-funt-gold/25 px-2.5 py-0.5 text-xs font-bold text-black">Submitted</span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-xs font-semibold text-black/65">
                            {SUBMISSION_TYPE_OPTIONS.find((o) => o.value === a.submissionType)?.label ?? a.submissionType}
                          </span>
                        )}
                      </div>
                      {a.instructions && (
                        <div
                          className={`mt-2 line-clamp-2 text-sm text-slate-600 ${RICH_TEXT_PREVIEW_CLASS}`}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.instructions) }}
                        />
                      )}
                      {!alreadySubmitted && (
                        <button
                          type="button"
                          onClick={() => {
                            handleAssignmentChange(a.id);
                            setAssignmentId(isExpanded ? "" : a.id);
                          }}
                          className="mt-3 w-full rounded-xl border border-funt-gold/40 bg-funt-honey py-2.5 text-sm font-medium text-funt-gold-deep transition hover:bg-funt-honey/80"
                        >
                          {isExpanded ? "Cancel" : "Submit"}
                        </button>
                      )}
                    </div>

                    {isExpanded && expandedAssignment && !expandedAlreadySubmitted && (
                      <div className="border-t border-slate-200 bg-slate-50/60 p-4">
                        <form
                          onSubmit={submitGlobal}
                          className="space-y-4"
                        >
                          {expandedAssignment.instructions && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                              <p className="text-sm font-medium text-slate-700">Instructions</p>
                              <div className={`mt-1 text-sm text-slate-600 ${RICH_TEXT_VIEW_CLASS}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(expandedAssignment.instructions) }} />
                            </div>
                          )}
                          <div>
                            <label htmlFor="content" className="block text-sm font-semibold text-slate-700">
                              {expandedAssignment.submissionType === SUBMISSION_TYPE.LINK ? "Your link" : "Your submission"}
                            </label>
                            <textarea
                              id="content"
                              required
                              value={submissionContent}
                              onChange={(e) => setSubmissionContent(e.target.value)}
                              placeholder={expandedAssignment.submissionType === SUBMISSION_TYPE.LINK ? "Paste your link" : "Write your submission"}
                              className="mt-1.5 min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-funt-gold focus:outline-none focus:ring-2 focus:ring-funt-gold/25"
                              rows={4}
                            />
                          </div>
                          {messageAlert}
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={submitLoading || !submissionContent.trim()}
                              className="rounded-xl bg-funt-gold px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:bg-funt-gold-hover disabled:opacity-50"
                            >
                              {submitLoading ? "Submitting…" : "Submit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAssignmentId(""); setMessage(null); resetForm(); }}
                              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Submissions</h2>
          {mySubmissions && (mySubmissions.chapterSubmissions.length > 0 || mySubmissions.generalSubmissions.length > 0) ? (
            <DataPanel className="mt-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-4 py-3 font-semibold text-slate-700">Assignment</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Context</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Submitted</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mySubmissions.chapterSubmissions, ...mySubmissions.generalSubmissions]
                      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                      .map((sub) => (
                        <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{sub.assignmentTitle}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {sub.type === "chapter" && sub.batchName != null
                              ? `${sub.batchName} · Chapter ${(sub.chapterOrder ?? 0) + 1}`
                              : "General"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                sub.status === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : sub.status === "REJECTED"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {sub.status === "PENDING" ? "Pending" : sub.status === "APPROVED" ? "Approved" : "Rejected"}
                            </span>
                            {sub.type === "chapter" && sub.rating != null && (
                              <span className="ml-1.5 text-slate-500">★ {sub.rating}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                          <td className="max-w-xs px-4 py-3">
                            {sub.feedback ? (
                              <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-slate-700">{sub.feedback}</p>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </DataPanel>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-8 text-center shadow-sm ring-1 ring-slate-100/70">
              <p className="text-slate-600">No submissions yet.</p>
            </div>
          )}
        </section>
      </div>
    </AppPageShell>
  );
}
