"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { SUBMISSION_TYPE } from "@funt-platform/constants";

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
  type: "module" | "general";
  assignmentId: string;
  assignmentTitle: string;
  batchId?: string;
  batchName?: string;
  courseId?: string;
  moduleOrder?: number;
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

function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

export default function AssignmentsPage() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId") ?? "";
  const courseIdParam = searchParams.get("courseId") ?? "";
  const moduleOrder = searchParams.get("moduleOrder") ?? "";
  const assignmentIdParam = searchParams.get("assignmentId") ?? "";
  const isInModuleMode = !!(batchId && moduleOrder !== "" && assignmentIdParam);

  const [assignments, setAssignments] = useState<GlobalAssignment[]>([]);
  const [moduleAssignment, setModuleAssignment] = useState<AssignmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [assignmentId, setAssignmentId] = useState("");
  const [submissionType, setSubmissionType] = useState(SUBMISSION_TYPE.TEXT);
  const [submissionContent, setSubmissionContent] = useState("");
  const [mySubmissions, setMySubmissions] = useState<{ moduleSubmissions: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] } | null>(null);
  /** Set to true after a successful module submit so the UI shows "Already submitted" immediately without waiting for refetch. */
  const [submittedJustNow, setSubmittedJustNow] = useState(false);

  useEffect(() => {
    if (isInModuleMode) {
      const params = new URLSearchParams({ batchId, moduleOrder });
      if (courseIdParam) params.set("courseId", courseIdParam);
      const assignUrl = `/api/student/assignments/${assignmentIdParam}?${params.toString()}`;
      Promise.all([
        api<AssignmentInfo>(assignUrl),
        api<{ moduleSubmissions: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions"),
      ])
        .then(([assignRes, subsRes]) => {
          if (assignRes.success && assignRes.data) {
            setModuleAssignment(assignRes.data);
            setSubmissionType(toSubmissionType(assignRes.data.submissionType));
          }
          if (subsRes.success && subsRes.data) setMySubmissions(subsRes.data);
        })
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        api<GlobalAssignment[]>("/api/student/assignments/general").then((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
        api<{ moduleSubmissions: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions").then((r) =>
          r.success && r.data ? r.data : { moduleSubmissions: [], generalSubmissions: [] }
        ),
      ])
        .then(([a, subs]) => {
          setAssignments(a);
          setMySubmissions(subs);
        })
        .finally(() => setLoading(false));
    }
  }, [isInModuleMode, assignmentIdParam, batchId, courseIdParam, moduleOrder]);

  const hasAlreadySubmittedModule =
    isInModuleMode &&
    (submittedJustNow ||
      !!mySubmissions?.moduleSubmissions.some(
        (s) =>
          s.batchId === batchId &&
          s.moduleOrder === Number(moduleOrder) &&
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
        api<{ moduleSubmissions: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions").then((r) =>
          r.success && r.data ? setMySubmissions(r.data) : null
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

  async function submitInModule(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleAssignment) return;
    setMessage(null);
    setSubmitLoading(true);
    try {
      const res = await api("/api/assignments/submit", {
        method: "POST",
        body: JSON.stringify({
          batchId,
          courseId: courseIdParam || undefined,
          moduleOrder: Number(moduleOrder),
          assignmentId: assignmentIdParam,
          submissionType: moduleAssignment.submissionType,
          submissionContent: submissionContent.trim(),
        }),
      });
      if (res.success) {
        setMessage({ type: "success", text: "Successfully submitted. Your trainer will review and you can see feedback under Submissions." });
        setSubmissionContent("");
        setSubmittedJustNow(true);
        // Refetch so submissions list is up to date when they navigate there
        api<{ moduleSubmissions: MySubmissionItem[]; generalSubmissions: MySubmissionItem[] }>("/api/student/assignments/my-submissions").then((r) => {
          if (r.success && r.data) setMySubmissions(r.data);
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
    "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800";

  const messageAlert = message ? (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
        message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {message.type === "success" ? (
        <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )}
      {message.text}
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  if (isInModuleMode) {
    if (!moduleAssignment) {
      return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8">
          <Link href="/assignments" className={backButtonClass}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Assignments
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-600">Assignment not found or you don&apos;t have access.</p>
            <Link href="/courses" className="mt-4 inline-block text-sm font-medium text-teal-600 hover:text-teal-700">Back to Courses</Link>
          </div>
        </div>
      );
    }

    const courseBackHref = courseIdParam ? `/courses/${encodeURIComponent(courseIdParam)}${batchId ? `?batchId=${encodeURIComponent(batchId)}` : ""}` : "/courses";

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link href="/assignments" className={backButtonClass}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Assignments
          </Link>
          <Link href={courseBackHref} className={backButtonClass}>
            Back to course
          </Link>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30 ring-1 ring-slate-100">
          <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Module assignment</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{moduleAssignment.title}</h1>
            <p className="mt-2 text-sm text-slate-600">Submit your work for this module. Your trainer will review and approve or send feedback.</p>
          </div>

          <div className="px-6 py-6">
          {hasAlreadySubmittedModule ? (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-slate-700">
                <svg className="h-6 w-6 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-slate-800">Already submitted</p>
                  <p className="text-sm text-slate-600">You can only submit once for this module. Your trainer will review and you can see feedback under Assignments.</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={courseBackHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
                >
                  Continue with course
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
                <Link href="/assignments" className="text-sm font-medium text-slate-600 hover:text-slate-800">View submissions</Link>
              </div>
            </>
          ) : (
          <form onSubmit={submitInModule} className="space-y-5">
            {moduleAssignment.instructions && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <p className="text-sm font-medium text-slate-700">Instructions</p>
                <div className="mt-1 text-sm leading-relaxed text-slate-600 prose prose-sm max-w-none [&_p]:my-1 [&_ul]:list-disc [&_ol]:list-decimal" dangerouslySetInnerHTML={{ __html: moduleAssignment.instructions }} />
              </div>
            )}
            <div>
              <label htmlFor="content-module" className="block text-sm font-semibold text-slate-700">
                {moduleAssignment.submissionType === SUBMISSION_TYPE.LINK ? "Your link" : "Your submission (text)"}
              </label>
              <textarea
                id="content-module"
                required
                value={submissionContent}
                onChange={(e) => setSubmissionContent(e.target.value)}
                placeholder={moduleAssignment.submissionType === SUBMISSION_TYPE.LINK ? "Paste your link here" : "Write your submission here"}
                className="mt-2 min-h-[180px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                rows={6}
              />
            </div>
            {messageAlert}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitLoading || !submissionContent.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
              >
                {submitLoading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Submitting…</>
                ) : (
                  "Submit"
                )}
              </button>
              <Link href={courseBackHref} className="text-sm font-medium text-slate-600 hover:text-slate-800">Back to course</Link>
            </div>
          </form>
          )}
          </div>
        </div>
      </div>
    );
  }

  const expandedId = assignmentId || null;
  const expandedAssignment = expandedId ? assignments.find((a) => a.id === expandedId) : null;
  const expandedAlreadySubmitted = expandedId ? mySubmissions?.generalSubmissions.some((s) => s.assignmentId === expandedId) : false;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assignments</h1>
        <p className="mt-2 text-sm text-slate-600">
          General assignments assigned to you. You can submit once per assignment. Module assignments are submitted from within each course.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Assignments assigned to you</h2>
          {assignments.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
              <p className="text-slate-600">No assignments assigned to you yet.</p>
              <p className="mt-1 text-sm text-slate-500">Assignments your trainer adds for you will appear here.</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a) => {
                const alreadySubmitted = mySubmissions?.generalSubmissions.some((s) => s.assignmentId === a.id);
                const isExpanded = expandedId === a.id;
                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl border bg-white shadow-sm ring-1 transition ${
                      isExpanded ? "border-teal-300 ring-teal-200" : "border-slate-200 ring-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">{a.title}</h3>
                        {alreadySubmitted ? (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Submitted</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {SUBMISSION_TYPE_OPTIONS.find((o) => o.value === a.submissionType)?.label ?? a.submissionType}
                          </span>
                        )}
                      </div>
                      {a.instructions && (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{stripHtml(a.instructions)}</p>
                      )}
                      {!alreadySubmitted && (
                        <button
                          type="button"
                          onClick={() => {
                            handleAssignmentChange(a.id);
                            setAssignmentId(isExpanded ? "" : a.id);
                          }}
                          className="mt-3 w-full rounded-xl border border-teal-200 bg-teal-50 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
                        >
                          {isExpanded ? "Cancel" : "Submit"}
                        </button>
                      )}
                    </div>

                    {isExpanded && expandedAssignment && !expandedAlreadySubmitted && (
                      <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                        <form
                          onSubmit={submitGlobal}
                          className="space-y-4"
                        >
                          {expandedAssignment.instructions && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                              <p className="text-sm font-medium text-slate-700">Instructions</p>
                              <div className="mt-1 text-sm leading-relaxed text-slate-600 [&_p]:my-1 [&_ul]:list-disc [&_ol]:list-decimal" dangerouslySetInnerHTML={{ __html: expandedAssignment.instructions }} />
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
                              className="mt-1.5 min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                              rows={4}
                            />
                          </div>
                          {messageAlert}
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={submitLoading || !submissionContent.trim()}
                              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-teal-700 disabled:opacity-50"
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
          {mySubmissions && (mySubmissions.moduleSubmissions.length > 0 || mySubmissions.generalSubmissions.length > 0) ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
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
                    {[...mySubmissions.moduleSubmissions, ...mySubmissions.generalSubmissions]
                      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                      .map((sub) => (
                        <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{sub.assignmentTitle}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {sub.type === "module" && sub.batchName != null
                              ? `${sub.batchName} · Module ${(sub.moduleOrder ?? 0) + 1}`
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
                            {sub.type === "module" && sub.rating != null && (
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
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/50 px-6 py-8 text-center">
              <p className="text-slate-600">No submissions yet.</p>
              <p className="mt-1 text-sm text-slate-500">When you submit an assignment, it will appear here with status and feedback.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
