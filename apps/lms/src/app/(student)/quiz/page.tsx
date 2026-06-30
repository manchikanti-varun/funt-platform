"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";

interface QuizOption {
  optionId: string;
  text: string;
  imageUrl?: string;
}

interface QuizQuestion {
  questionId: string;
  text: string;
  imageUrl?: string;
  marks: number;
  options: QuizOption[];
  savedAnswer: string | null;
}

interface AttemptData {
  attemptId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  timeLimitMinutes: number;
  totalQuestions: number;
  questions: QuizQuestion[];
}

interface QuizInfo {
  quizId: string;
  title: string;
  description: string;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number;
  questionCount: number;
}

interface ResultQuestion {
  questionId: string;
  text: string;
  imageUrl?: string;
  marks: number;
  studentAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  marksAwarded: number;
  explanation: string;
  options: Array<{ optionId: string; text: string; imageUrl?: string; isCorrect: boolean }>;
}

interface QuizResult {
  attemptId: string;
  attemptNumber: number;
  totalMarks: number;
  scoredMarks: number;
  scorePercent: number;
  passed: boolean;
  passingScore: number;
  timeTakenSeconds: number;
  completedAt: string;
  questions: ResultQuestion[];
}

type ViewState = "loading" | "info" | "quiz" | "result" | "error";

export default function QuizPage() {
  const params = useSearchParams();
  const quizId = params.get("quizId") ?? "";
  const batchId = params.get("batchId") ?? "";
  const courseId = params.get("courseId") ?? "";
  const chapterOrder = params.get("chapterOrder");
  const milestoneId = params.get("milestoneId");

  const [view, setView] = useState<ViewState>("loading");
  const [quizInfo, setQuizInfo] = useState<QuizInfo | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load quiz info
  useEffect(() => {
    if (!quizId) { setView("error"); setError("No quiz specified."); return; }
    api<QuizInfo>(`/api/student/quizzes/${encodeURIComponent(quizId)}`)
      .then((r) => {
        if (r.success && r.data) { setQuizInfo(r.data); setView("info"); }
        else { setError(r.message ?? "Quiz not found"); setView("error"); }
      })
      .catch(() => { setError("Failed to load quiz"); setView("error"); });
  }, [quizId]);

  // Start attempt
  const handleStart = useCallback(async () => {
    setError("");
    const body: Record<string, unknown> = { quizId, batchId, courseId };
    if (chapterOrder != null) body.chapterOrder = Number(chapterOrder);
    if (milestoneId) body.milestoneId = milestoneId;

    const r = await api<AttemptData>("/api/student/quizzes/attempt", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (r.success && r.data) {
      setAttempt(r.data);
      // Restore saved answers
      const saved: Record<string, string | null> = {};
      for (const q of r.data.questions) {
        if (q.savedAnswer) saved[q.questionId] = q.savedAnswer;
      }
      setAnswers(saved);
      setCurrentIdx(0);
      setView("quiz");
    } else {
      setError(r.message ?? "Failed to start quiz");
    }
  }, [quizId, batchId, courseId, chapterOrder, milestoneId]);

  // Auto-save answer
  const selectOption = useCallback(async (questionId: string, optionId: string) => {
    if (!attempt) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    // Fire-and-forget save
    api(`/api/student/quizzes/attempt/${attempt.attemptId}`, {
      method: "PATCH",
      body: JSON.stringify({ questionId, selectedOptionId: optionId }),
    }).catch(() => {});
  }, [attempt]);

  // Submit quiz
  const handleSubmit = useCallback(async () => {
    if (!attempt) return;
    setSubmitting(true);
    setError("");
    const finalAnswers = attempt.questions.map((q) => ({
      questionId: q.questionId,
      selectedOptionId: answers[q.questionId] ?? null,
    }));
    const r = await api<QuizResult>(`/api/student/quizzes/attempt/${attempt.attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers: finalAnswers }),
    });
    setSubmitting(false);
    if (r.success && r.data) {
      setResult(r.data);
      setView("result");
    } else {
      setError(r.message ?? "Failed to submit quiz");
    }
  }, [attempt, answers]);

  const currentQuestion = attempt?.questions[currentIdx];
  const totalQuestions = attempt?.totalQuestions ?? 0;
  const answeredCount = Object.values(answers).filter(Boolean).length;

  const backUrl = courseId
    ? `/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}&learn=1`
    : "/courses";

  // ─── Error state ────────────────────────────────────────────────────────
  if (view === "error") {
    return (
      <AppPageShell className="max-w-2xl pb-8">
        <div className="mt-12 text-center">
          <p className="text-lg font-semibold text-red-600">{error || "Something went wrong"}</p>
          <Link href={backUrl} className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline">
            ← Back to course
          </Link>
        </div>
      </AppPageShell>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <AppPageShell className="max-w-2xl pb-8">
        <div className="mt-12 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </AppPageShell>
    );
  }

  // ─── Quiz info / start screen ───────────────────────────────────────────
  if (view === "info" && quizInfo) {
    return (
      <AppPageShell className="max-w-2xl pb-8">
        <div className="mt-8">
          <Link href={backUrl} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back to course
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{quizInfo.title}</h1>
            {quizInfo.description && <p className="mt-2 text-sm text-slate-600">{quizInfo.description}</p>}
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Questions</p>
                <p className="text-lg font-bold text-slate-900">{quizInfo.questionCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Passing Score</p>
                <p className="text-lg font-bold text-slate-900">{quizInfo.passingScore}%</p>
              </div>
              {quizInfo.timeLimitMinutes > 0 && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-400">Time Limit</p>
                  <p className="text-lg font-bold text-slate-900">{quizInfo.timeLimitMinutes} min</p>
                </div>
              )}
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Attempts</p>
                <p className="text-lg font-bold text-slate-900">{quizInfo.maxAttempts === 0 ? "Unlimited" : quizInfo.maxAttempts}</p>
              </div>
            </div>
            {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleStart}
              className="mt-8 w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-indigo-500"
            >
              Start Quiz
            </button>
          </div>
        </div>
      </AppPageShell>
    );
  }

  // ─── Quiz in progress (one question at a time) ──────────────────────────
  if (view === "quiz" && attempt && currentQuestion) {
    return (
      <AppPageShell className="max-w-3xl pb-8">
        <div className="mt-6">
          {/* Header: progress bar */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Question {currentIdx + 1} of {totalQuestions}
            </p>
            <p className="text-sm text-slate-500">{answeredCount}/{totalQuestions} answered</p>
          </div>
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 mb-2">
                {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? "s" : ""}
              </p>
              <h2 className="text-lg font-bold text-slate-900 whitespace-pre-wrap">{currentQuestion.text}</h2>
              {currentQuestion.imageUrl && (
                <img
                  src={currentQuestion.imageUrl}
                  alt="Question"
                  className="mt-4 max-h-64 rounded-lg border border-slate-200 object-contain"
                />
              )}
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((opt, idx) => {
                const selected = answers[currentQuestion.questionId] === opt.optionId;
                return (
                  <button
                    key={opt.optionId}
                    type="button"
                    onClick={() => selectOption(currentQuestion.questionId, opt.optionId)}
                    className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-800">{opt.text}</span>
                      {opt.imageUrl && (
                        <img src={opt.imageUrl} alt="" className="mt-2 max-h-32 rounded-lg border border-slate-200 object-contain" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            {currentIdx < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.min(totalQuestions - 1, i + 1))}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Quiz"}
              </button>
            )}
          </div>
          {error && <p className="mt-4 text-center text-sm font-semibold text-red-600">{error}</p>}
        </div>
      </AppPageShell>
    );
  }

  // ─── Result screen ──────────────────────────────────────────────────────
  if (view === "result" && result) {
    const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    };
    return (
      <AppPageShell className="max-w-3xl pb-8">
        <div className="mt-8">
          <Link href={backUrl} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back to course
          </Link>

          {/* Score card */}
          <div className={`rounded-2xl border-2 p-8 text-center ${result.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black ${result.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {result.scorePercent}%
            </div>
            <h2 className={`mt-4 text-2xl font-black ${result.passed ? "text-emerald-800" : "text-red-800"}`}>
              {result.passed ? "Quiz Passed!" : "Quiz Failed"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {result.scoredMarks}/{result.totalMarks} marks • Passing: {result.passingScore}% • Time: {formatTime(result.timeTakenSeconds)} • Attempt #{result.attemptNumber}
            </p>
          </div>

          {/* Detailed results */}
          <div className="mt-8 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Question Review</h3>
            {result.questions.map((q, idx) => (
              <div key={q.questionId} className={`rounded-xl border p-5 ${q.isCorrect ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${q.isCorrect ? "bg-emerald-500" : "bg-red-500"}`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{q.text}</p>
                    {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-2 max-h-40 rounded-lg border border-slate-200 object-contain" />}
                    <div className="mt-3 space-y-1.5">
                      {q.options.map((o) => {
                        const isStudentPick = o.optionId === q.studentAnswer;
                        const isCorrectOpt = o.isCorrect;
                        let style = "border-slate-200 bg-white";
                        if (isCorrectOpt) style = "border-emerald-300 bg-emerald-50";
                        if (isStudentPick && !isCorrectOpt) style = "border-red-300 bg-red-50";
                        return (
                          <div key={o.optionId} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${style}`}>
                            {isStudentPick && <span className="text-xs font-bold text-slate-500">Your answer</span>}
                            {isCorrectOpt && <span className="text-xs font-bold text-emerald-600">✓</span>}
                            <span className="text-slate-700">{o.text}</span>
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        <span className="font-semibold">Explanation:</span> {q.explanation}
                      </div>
                    )}
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {q.marksAwarded}/{q.marks} marks
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={backUrl} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500">
              Back to Course
            </Link>
            {!result.passed && (
              <button
                type="button"
                onClick={() => { setResult(null); setView("info"); }}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Try Again
              </button>
            )}
            {result.passed && (
              <button
                type="button"
                onClick={() => { setResult(null); setView("info"); }}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Retake for Practice
              </button>
            )}
          </div>
        </div>
      </AppPageShell>
    );
  }

  return null;
}
