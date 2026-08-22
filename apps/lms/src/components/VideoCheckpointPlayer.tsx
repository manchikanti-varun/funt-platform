"use client";

/**
 * VideoCheckpointPlayer — checkpoint-aware video player with:
 * - Timeline progress markers (green/amber/grey dots)
 * - Multi-type questions (MCQ, true/false, multi-select, fill-blank, code-output)
 * - Gamification (XP awards, streak counter)
 * - Seek protection and progress persistence
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, Flame, Star, Trophy, Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckpointOption {
  optionId: string;
  text: string;
}

type CheckpointType = "mcq" | "true_false" | "multi_select" | "fill_blank" | "code_output";

interface Checkpoint {
  _id: string;
  moduleId: string;
  questionTimestamp: number;
  reviewTimestamp: number;
  question: string;
  type: CheckpointType;
  options: CheckpointOption[];
  codeSnippet?: string;
  codeLanguage?: string;
  bonusXp?: number;
}

interface CheckpointProgressEntry {
  checkpointId: string;
  attempts: number;
  completed: boolean;
  firstAttemptCorrect?: boolean;
}

interface AnswerResponse {
  correct: boolean;
  attempts: number;
  completed: boolean;
  reviewTimestamp?: number;
  explanation?: string;
  xpAwarded: number;
  currentStreak: number;
  bestStreak: number;
  totalXpEarned: number;
}

type CheckpointState = "idle" | "showing" | "correct" | "incorrect";

interface VideoCheckpointPlayerProps {
  videoSrc: string;
  moduleId: string;
  onVideoEnded?: () => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoCheckpointPlayer({
  videoSrc,
  moduleId,
  onVideoEnded,
  className = "",
}: VideoCheckpointPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [progress, setProgress] = useState<CheckpointProgressEntry[]>([]);
  const [lastPosition, setLastPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // Gamification state
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  // Checkpoint interaction state
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const [checkpointState, setCheckpointState] = useState<CheckpointState>("idle");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Seek protection
  const lastAllowedTimeRef = useRef(0);
  const triggeredInCycleRef = useRef<Set<string>>(new Set());
  const positionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load checkpoints + progress ───────────────────────────────────────────

  useEffect(() => {
    if (!moduleId) return;
    api<Checkpoint[]>(`/api/student/checkpoints?moduleId=${moduleId}`).then((r) => {
      if (r.success && r.data) setCheckpoints(r.data);
    });
    api<{ checkpoints: CheckpointProgressEntry[]; lastPosition: number; currentStreak: number; bestStreak: number; totalXpEarned: number }>(
      `/api/student/checkpoints/progress?moduleId=${moduleId}`
    ).then((r) => {
      if (r.success && r.data) {
        setProgress(r.data.checkpoints);
        setLastPosition(r.data.lastPosition);
        setCurrentStreak(r.data.currentStreak);
        setBestStreak(r.data.bestStreak);
        setTotalXpEarned(r.data.totalXpEarned);
      }
    });
  }, [moduleId]);

  // ─── Restore position ─────────────────────────────────────────────────────

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      if (lastPosition > 0) videoRef.current.currentTime = lastPosition;
    }
  }, [lastPosition]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function isCompleted(cpId: string): boolean {
    return progress.some((p) => p.checkpointId === cpId && p.completed);
  }

  function getProgressState(cpId: string): "completed" | "attempted" | "pending" {
    const entry = progress.find((p) => p.checkpointId === cpId);
    if (!entry) return "pending";
    if (entry.completed) return "completed";
    if (entry.attempts > 0) return "attempted";
    return "pending";
  }

  // ─── Seek protection ──────────────────────────────────────────────────────

  const handleSeeking = useCallback(() => {
    const video = videoRef.current;
    if (!video || checkpoints.length === 0) return;
    const seekTarget = video.currentTime;
    const currentAllowed = lastAllowedTimeRef.current;
    const blockingCheckpoint = checkpoints.find(
      (cp) => !isCompleted(cp._id) && cp.questionTimestamp > currentAllowed && cp.questionTimestamp <= seekTarget
    );
    if (blockingCheckpoint) {
      video.currentTime = Math.max(0, blockingCheckpoint.questionTimestamp - 0.5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints, progress]);

  // ─── Time update — detect checkpoints ─────────────────────────────────────

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || checkpoints.length === 0 || checkpointState !== "idle") return;
    const currentTime = video.currentTime;
    if (currentTime > lastAllowedTimeRef.current) lastAllowedTimeRef.current = currentTime;

    for (const cp of checkpoints) {
      if (isCompleted(cp._id)) continue;
      if (triggeredInCycleRef.current.has(cp._id)) continue;
      if (currentTime >= cp.questionTimestamp && currentTime < cp.questionTimestamp + 1) {
        video.pause();
        triggeredInCycleRef.current.add(cp._id);
        setActiveCheckpoint(cp);
        setCheckpointState("showing");
        setSelectedOption(null);
        setSelectedOptions([]);
        setTextAnswer("");
        setAnswerResult(null);
        setSubmitError("");
        return;
      }
    }

    if (positionSaveTimerRef.current === null) {
      positionSaveTimerRef.current = setTimeout(() => {
        positionSaveTimerRef.current = null;
        void api("/api/student/checkpoints/position", {
          method: "POST",
          body: JSON.stringify({ moduleId, position: Math.floor(currentTime) }),
        });
      }, 10000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints, progress, checkpointState, moduleId]);

  // ─── Submit answer ────────────────────────────────────────────────────────

  async function handleSubmitAnswer() {
    if (!activeCheckpoint) return;
    setSubmitting(true);
    setSubmitError("");

    const body: Record<string, unknown> = { moduleId };
    if (activeCheckpoint.type === "mcq" || activeCheckpoint.type === "true_false") {
      if (!selectedOption) { setSubmitError("Select an answer."); setSubmitting(false); return; }
      body.selectedOptionId = selectedOption;
    } else if (activeCheckpoint.type === "multi_select") {
      if (selectedOptions.length === 0) { setSubmitError("Select at least one option."); setSubmitting(false); return; }
      body.selectedOptionIds = selectedOptions;
    } else {
      if (!textAnswer.trim()) { setSubmitError("Type your answer."); setSubmitting(false); return; }
      body.textAnswer = textAnswer.trim();
    }

    const res = await api<AnswerResponse>(
      `/api/student/checkpoints/${activeCheckpoint._id}/answer`,
      { method: "POST", body: JSON.stringify(body) }
    );

    if (res.success && res.data) {
      setAnswerResult(res.data);
      setCurrentStreak(res.data.currentStreak);
      setBestStreak(res.data.bestStreak);
      setTotalXpEarned(res.data.totalXpEarned);

      if (res.data.correct) {
        setCheckpointState("correct");
        setProgress((prev) => {
          const existing = prev.find((p) => p.checkpointId === activeCheckpoint._id);
          if (existing) return prev.map((p) => p.checkpointId === activeCheckpoint._id ? { ...p, attempts: res.data!.attempts, completed: true } : p);
          return [...prev, { checkpointId: activeCheckpoint._id, attempts: res.data!.attempts, completed: true }];
        });
      } else {
        setCheckpointState("incorrect");
        setProgress((prev) => {
          const existing = prev.find((p) => p.checkpointId === activeCheckpoint._id);
          if (existing) return prev.map((p) => p.checkpointId === activeCheckpoint._id ? { ...p, attempts: res.data!.attempts, completed: false } : p);
          return [...prev, { checkpointId: activeCheckpoint._id, attempts: res.data!.attempts, completed: false }];
        });
      }
    } else {
      setSubmitError(res.message ?? "Unable to save your answer. Please try again.");
    }
    setSubmitting(false);
  }

  // ─── Continue / Review ────────────────────────────────────────────────────

  function handleContinue() {
    setCheckpointState("idle");
    setActiveCheckpoint(null);
    setAnswerResult(null);
    videoRef.current?.play();
  }

  function handleReviewAgain() {
    if (!answerResult || !activeCheckpoint) return;
    const reviewTime = answerResult.reviewTimestamp ?? activeCheckpoint.reviewTimestamp;
    triggeredInCycleRef.current.delete(activeCheckpoint._id);
    setCheckpointState("idle");
    setActiveCheckpoint(null);
    setAnswerResult(null);
    if (videoRef.current) { videoRef.current.currentTime = reviewTime; videoRef.current.play(); }
  }

  function handleEnded() {
    void api("/api/student/checkpoints/position", { method: "POST", body: JSON.stringify({ moduleId, position: 0 }) });
    onVideoEnded?.();
  }

  useEffect(() => { return () => { if (positionSaveTimerRef.current) clearTimeout(positionSaveTimerRef.current); }; }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  const completedCount = progress.filter((p) => p.completed).length;

  return (
    <div className={`relative ${className}`}>
      {/* Video element */}
      <div className="aspect-video rounded-xl overflow-hidden bg-black shadow-sm ring-1 ring-slate-200">
        <video
          ref={videoRef}
          src={videoSrc}
          controls={checkpointState === "idle"}
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          playsInline
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          onEnded={handleEnded}
          onLoadedMetadata={handleLoadedMetadata}
        />
      </div>

      {/* Timeline Progress Markers */}
      {checkpoints.length > 0 && videoDuration > 0 && (
        <div className="relative mt-2.5 h-2 rounded-full bg-slate-100 border border-slate-200">
          {checkpoints.map((cp) => {
            const pct = Math.min(100, (cp.questionTimestamp / videoDuration) * 100);
            const state = getProgressState(cp._id);
            const color = state === "completed"
              ? "bg-emerald-500 ring-emerald-200"
              : state === "attempted"
              ? "bg-amber-500 ring-amber-200"
              : "bg-slate-400 ring-slate-200";
            return (
              <div
                key={cp._id}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${color} ring-2 shadow-sm transition-all`}
                style={{ left: `${pct}%` }}
                title={`${formatTimeShort(cp.questionTimestamp)} — ${state === "completed" ? "Completed" : state === "attempted" ? "In Progress" : "Upcoming"}`}
              />
            );
          })}
        </div>
      )}

      {/* Gamification Stats Bar */}
      {checkpoints.length > 0 && (
        <div className="mt-2.5 flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          {currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
              <Flame className="h-3.5 w-3.5" /> {currentStreak} streak
            </span>
          )}
          {totalXpEarned > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <Star className="h-3.5 w-3.5" /> {totalXpEarned} XP
            </span>
          )}
          {bestStreak > 1 && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Trophy className="h-3 w-3" /> Best: {bestStreak}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {completedCount}/{checkpoints.length}
          </span>
        </div>
      )}

      {/* Checkpoint Overlay */}
      {checkpointState !== "idle" && activeCheckpoint && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
          <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-2xl max-h-[90%] overflow-y-auto">
            {/* Showing / answering */}
            {checkpointState === "showing" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    Checkpoint
                  </span>
                  {(activeCheckpoint.bonusXp ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                      <Zap className="h-3 w-3" /> +{activeCheckpoint.bonusXp} XP
                    </span>
                  )}
                </div>

                {/* Code snippet */}
                {activeCheckpoint.codeSnippet && (
                  <pre className="mb-3 rounded-lg bg-slate-900 p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    <code>{activeCheckpoint.codeSnippet}</code>
                  </pre>
                )}

                <p className="text-base font-semibold text-slate-900 mb-4 leading-relaxed">{activeCheckpoint.question}</p>

                {/* MCQ / True-False options */}
                {(activeCheckpoint.type === "mcq" || activeCheckpoint.type === "true_false") && (
                  <div className="space-y-2 mb-4">
                    {activeCheckpoint.options.map((opt) => (
                      <label key={opt.optionId}
                        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${selectedOption === opt.optionId ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                        <input type="radio" name="checkpoint-answer" value={opt.optionId}
                          checked={selectedOption === opt.optionId} onChange={() => setSelectedOption(opt.optionId)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-800">{opt.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Multi-select */}
                {activeCheckpoint.type === "multi_select" && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs text-slate-500 font-medium">Select all that apply</p>
                    {activeCheckpoint.options.map((opt) => (
                      <label key={opt.optionId}
                        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${selectedOptions.includes(opt.optionId) ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                        <input type="checkbox" checked={selectedOptions.includes(opt.optionId)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedOptions([...selectedOptions, opt.optionId]);
                            else setSelectedOptions(selectedOptions.filter((id) => id !== opt.optionId));
                          }} className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500" />
                        <span className="text-sm text-slate-800">{opt.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Fill-blank / Code output */}
                {(activeCheckpoint.type === "fill_blank" || activeCheckpoint.type === "code_output") && (
                  <div className="mb-4">
                    <input type="text" value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Type your answer..."
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSubmitAnswer(); }}
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
                  </div>
                )}

                {submitError && <p className="text-sm text-red-600 mb-3">{submitError}</p>}

                <button type="button" onClick={handleSubmitAnswer} disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition">
                  {submitting ? "Checking..." : "Submit Answer"}
                </button>
              </>
            )}

            {/* Correct */}
            {checkpointState === "correct" && answerResult && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-emerald-700">Correct!</p>
                    {answerResult.xpAwarded > 0 && (
                      <p className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" /> +{answerResult.xpAwarded} XP earned
                      </p>
                    )}
                  </div>
                </div>
                {answerResult.currentStreak > 1 && (
                  <div className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold text-orange-700">{answerResult.currentStreak} in a row!</span>
                  </div>
                )}
                {answerResult.explanation && <p className="text-sm text-slate-600 mb-4">{answerResult.explanation}</p>}
                <button type="button" onClick={handleContinue}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition">
                  Continue
                </button>
              </>
            )}

            {/* Incorrect */}
            {checkpointState === "incorrect" && answerResult && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <XCircle className="h-9 w-9 text-red-500 shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-red-700">Not quite</p>
                    <p className="text-sm text-slate-500">Let&apos;s review this section</p>
                  </div>
                </div>
                {answerResult.explanation && <p className="text-sm text-slate-600 mb-4">{answerResult.explanation}</p>}
                <button type="button" onClick={handleReviewAgain}
                  className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 transition">
                  Review Again
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
