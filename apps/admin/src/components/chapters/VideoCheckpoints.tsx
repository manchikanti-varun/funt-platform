"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

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
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctText?: string;
  acceptableAnswers?: string[];
  codeSnippet?: string;
  codeLanguage?: string;
  explanation?: string;
  bonusXp?: number;
  isActive: boolean;
  createdAt: string;
}

interface VideoCheckpointsProps {
  moduleId: string;
  videoPreviewUrl: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseTimeInput(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) return m * 60 + s;
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && h >= 0 && m >= 0 && s >= 0 && m < 60 && s < 60)
      return h * 3600 + m * 60 + s;
  }
  return null;
}

const TYPE_LABELS: Record<CheckpointType, string> = {
  mcq: "Multiple Choice",
  true_false: "True / False",
  multi_select: "Multi-Select",
  fill_blank: "Fill in the Blank",
  code_output: "Code Output",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoCheckpoints({ moduleId, videoPreviewUrl }: VideoCheckpointsProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);
  const [previewCheckpoint, setPreviewCheckpoint] = useState<Checkpoint | null>(null);
  const [previewAnswer, setPreviewAnswer] = useState<string | null>(null);
  const [previewMultiAnswers, setPreviewMultiAnswers] = useState<string[]>([]);
  const [previewTextAnswer, setPreviewTextAnswer] = useState("");
  const [previewResult, setPreviewResult] = useState<"correct" | "incorrect" | null>(null);

  // Form state
  const [questionType, setQuestionType] = useState<CheckpointType>("mcq");
  const [questionTimestamp, setQuestionTimestamp] = useState("");
  const [reviewTimestamp, setReviewTimestamp] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<CheckpointOption[]>([
    { optionId: "a", text: "" },
    { optionId: "b", text: "" },
    { optionId: "c", text: "" },
    { optionId: "d", text: "" },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState("");
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>([]);
  const [correctText, setCorrectText] = useState("");
  const [acceptableAnswers, setAcceptableAnswers] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("");
  const [explanation, setExplanation] = useState("");
  const [bonusXp, setBonusXp] = useState("5");

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // ─── Load checkpoints ─────────────────────────────────────────────────────

  const fetchCheckpoints = useCallback(async () => {
    setLoading(true);
    const res = await api<Checkpoint[]>(`/api/checkpoints/module/${moduleId}`);
    if (res.success && res.data) setCheckpoints(res.data);
    setLoading(false);
  }, [moduleId]);

  useEffect(() => {
    if (moduleId) void fetchCheckpoints();
  }, [moduleId, fetchCheckpoints]);

  // ─── Use Current Time ─────────────────────────────────────────────────────

  function useCurrentTimeForQuestion() {
    if (videoRef.current) setQuestionTimestamp(formatTime(videoRef.current.currentTime));
  }
  function useCurrentTimeForReview() {
    if (videoRef.current) setReviewTimestamp(formatTime(videoRef.current.currentTime));
  }

  // ─── Reset form ───────────────────────────────────────────────────────────

  function resetForm() {
    setQuestionType("mcq");
    setQuestionTimestamp("");
    setReviewTimestamp("");
    setQuestion("");
    setOptions([
      { optionId: "a", text: "" },
      { optionId: "b", text: "" },
      { optionId: "c", text: "" },
      { optionId: "d", text: "" },
    ]);
    setCorrectOptionId("");
    setCorrectOptionIds([]);
    setCorrectText("");
    setAcceptableAnswers("");
    setCodeSnippet("");
    setCodeLanguage("");
    setExplanation("");
    setBonusXp("5");
    setEditingId(null);
    setError("");
  }

  // ─── Open edit ────────────────────────────────────────────────────────────

  function openEdit(cp: Checkpoint) {
    setEditingId(cp._id);
    setQuestionType(cp.type);
    setQuestionTimestamp(formatTime(cp.questionTimestamp));
    setReviewTimestamp(formatTime(cp.reviewTimestamp));
    setQuestion(cp.question);
    setOptions(cp.options.length >= 2 ? cp.options : [...cp.options, ...Array(Math.max(0, 4 - cp.options.length)).fill(null).map((_, i) => ({ optionId: String.fromCharCode(97 + cp.options.length + i), text: "" }))]);
    setCorrectOptionId(cp.correctOptionId ?? "");
    setCorrectOptionIds(cp.correctOptionIds ?? []);
    setCorrectText(cp.correctText ?? "");
    setAcceptableAnswers((cp.acceptableAnswers ?? []).join(", "));
    setCodeSnippet(cp.codeSnippet ?? "");
    setCodeLanguage(cp.codeLanguage ?? "");
    setExplanation(cp.explanation ?? "");
    setBonusXp(String(cp.bonusXp ?? 5));
    setShowForm(true);
    setError("");
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setError("");
    const qtSec = parseTimeInput(questionTimestamp);
    const rtSec = parseTimeInput(reviewTimestamp);
    if (qtSec === null || rtSec === null) { setError("Enter timestamps in MM:SS or HH:MM:SS format."); return; }
    if (rtSec >= qtSec) { setError("Review timestamp must be before question timestamp."); return; }
    if (!question.trim()) { setError("Question is required."); return; }

    setSaving(true);
    const body: Record<string, unknown> = {
      questionTimestamp: qtSec,
      reviewTimestamp: rtSec,
      question: question.trim(),
      type: questionType,
      explanation: explanation.trim(),
      bonusXp: parseInt(bonusXp, 10) || 5,
    };

    if (questionType === "mcq" || questionType === "multi_select") {
      const validOptions = options.filter((o) => o.text.trim());
      if (validOptions.length < 2) { setError("At least 2 options required."); setSaving(false); return; }
      body.options = validOptions.map((o) => ({ optionId: o.optionId, text: o.text.trim() }));
      if (questionType === "mcq") {
        if (!correctOptionId) { setError("Select the correct answer."); setSaving(false); return; }
        body.correctOptionId = correctOptionId;
      } else {
        if (correctOptionIds.length < 1) { setError("Select at least one correct answer."); setSaving(false); return; }
        body.correctOptionIds = correctOptionIds;
      }
    } else if (questionType === "true_false") {
      body.options = [{ optionId: "true", text: "True" }, { optionId: "false", text: "False" }];
      if (!correctOptionId) { setError("Select True or False."); setSaving(false); return; }
      body.correctOptionId = correctOptionId;
    } else if (questionType === "fill_blank" || questionType === "code_output") {
      if (!correctText.trim()) { setError("Correct answer is required."); setSaving(false); return; }
      body.correctText = correctText.trim();
      body.acceptableAnswers = acceptableAnswers.split(",").map((s) => s.trim()).filter(Boolean);
      if (questionType === "code_output") {
        body.codeSnippet = codeSnippet;
        body.codeLanguage = codeLanguage;
      }
    }

    let res;
    if (editingId) {
      res = await api(`/api/checkpoints/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      res = await api(`/api/checkpoints/module/${moduleId}`, { method: "POST", body: JSON.stringify(body) });
    }

    if (res.success) { resetForm(); setShowForm(false); void fetchCheckpoints(); }
    else setError(res.message ?? "Failed to save checkpoint.");
    setSaving(false);
  }

  // ─── Delete / Toggle ──────────────────────────────────────────────────────

  async function handleDelete(cpId: string) {
    if (!confirm("Delete this checkpoint?")) return;
    const res = await api(`/api/checkpoints/${cpId}`, { method: "DELETE" });
    if (res.success) void fetchCheckpoints();
  }

  async function handleToggleActive(cp: Checkpoint) {
    await api(`/api/checkpoints/${cp._id}`, { method: "PUT", body: JSON.stringify({ isActive: !cp.isActive }) });
    void fetchCheckpoints();
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async function handleExport() {
    const res = await api<unknown[]>(`/api/checkpoints/module/${moduleId}/export`);
    if (res.success && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `checkpoints-${moduleId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ─── Bulk Import ──────────────────────────────────────────────────────────

  async function handleBulkImport() {
    setError("");
    let parsed;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setError("Invalid JSON. Paste an array of checkpoint objects.");
      return;
    }
    const items = Array.isArray(parsed) ? parsed : parsed.checkpoints;
    if (!Array.isArray(items) || items.length === 0) {
      setError("Expected an array of checkpoints.");
      return;
    }
    setImporting(true);
    const res = await api(`/api/checkpoints/module/${moduleId}/bulk-import`, {
      method: "POST",
      body: JSON.stringify({ checkpoints: items }),
    });
    if (res.success) {
      setShowImport(false);
      setImportJson("");
      void fetchCheckpoints();
    } else {
      setError(res.message ?? "Import failed.");
    }
    setImporting(false);
  }

  // ─── Duplicate from another module ────────────────────────────────────────

  async function handleDuplicate() {
    const sourceId = prompt("Enter the source module ID to copy checkpoints from:");
    if (!sourceId?.trim()) return;
    const res = await api(`/api/checkpoints/module/${moduleId}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ sourceModuleId: sourceId.trim() }),
    });
    if (res.success) void fetchCheckpoints();
    else alert(res.message ?? "Duplicate failed.");
  }

  // ─── Preview Mode ─────────────────────────────────────────────────────────

  function startPreview() {
    setPreviewMode(true);
    setPreviewCheckpoint(null);
    setPreviewResult(null);
    // Start video playback - checkpoint detection done via timeupdate
  }

  function handlePreviewTimeUpdate() {
    const video = previewVideoRef.current;
    if (!video || previewCheckpoint) return;
    for (const cp of checkpoints.filter((c) => c.isActive)) {
      if (video.currentTime >= cp.questionTimestamp && video.currentTime < cp.questionTimestamp + 1) {
        video.pause();
        setPreviewCheckpoint(cp);
        setPreviewAnswer(null);
        setPreviewMultiAnswers([]);
        setPreviewTextAnswer("");
        setPreviewResult(null);
        return;
      }
    }
  }

  function handlePreviewSubmit() {
    if (!previewCheckpoint) return;
    const cp = previewCheckpoint;
    let correct = false;
    if (cp.type === "mcq" || cp.type === "true_false") {
      correct = previewAnswer === cp.correctOptionId;
    } else if (cp.type === "multi_select") {
      const sorted = [...(cp.correctOptionIds ?? [])].sort();
      const sel = [...previewMultiAnswers].sort();
      correct = sorted.length === sel.length && sorted.every((id, i) => id === sel[i]);
    } else {
      const answer = previewTextAnswer.trim().toLowerCase();
      const correctT = (cp.correctText ?? "").trim().toLowerCase();
      correct = answer === correctT || (cp.acceptableAnswers ?? []).some((a) => a.trim().toLowerCase() === answer);
    }
    setPreviewResult(correct ? "correct" : "incorrect");
  }

  function handlePreviewContinue() {
    setPreviewCheckpoint(null);
    setPreviewResult(null);
    previewVideoRef.current?.play();
  }

  function handlePreviewReview() {
    if (!previewCheckpoint) return;
    const rt = previewCheckpoint.reviewTimestamp;
    setPreviewCheckpoint(null);
    setPreviewResult(null);
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = rt;
      previewVideoRef.current.play();
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!videoPreviewUrl) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">Interactive Checkpoints</p>
        <p className="mt-1 text-xs text-slate-500">Upload an MP4 video to enable interactive checkpoints.</p>
      </div>
    );
  }

  // ─── Preview Mode Overlay ─────────────────────────────────────────────────

  if (previewMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-indigo-700">🎬 Preview Mode</p>
          <button type="button" onClick={() => setPreviewMode(false)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Exit Preview
          </button>
        </div>
        <div className="relative">
          <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black">
            <video ref={previewVideoRef} src={videoPreviewUrl} controls playsInline preload="metadata"
              className="h-full w-full" onTimeUpdate={handlePreviewTimeUpdate} />
          </div>
          {previewCheckpoint && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
              <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-2xl">
                {!previewResult && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
                      {TYPE_LABELS[previewCheckpoint.type]} • {formatTime(previewCheckpoint.questionTimestamp)}
                    </p>
                    {previewCheckpoint.codeSnippet && (
                      <pre className="mb-3 rounded-lg bg-slate-900 p-3 text-xs text-green-300 overflow-x-auto">
                        <code>{previewCheckpoint.codeSnippet}</code>
                      </pre>
                    )}
                    <p className="text-base font-semibold text-slate-900 mb-4">{previewCheckpoint.question}</p>
                    {(previewCheckpoint.type === "mcq" || previewCheckpoint.type === "true_false") && (
                      <div className="space-y-2 mb-4">
                        {previewCheckpoint.options.map((opt) => (
                          <label key={opt.optionId} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition ${previewAnswer === opt.optionId ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}>
                            <input type="radio" name="preview-answer" value={opt.optionId}
                              checked={previewAnswer === opt.optionId} onChange={() => setPreviewAnswer(opt.optionId)}
                              className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm">{opt.text}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {previewCheckpoint.type === "multi_select" && (
                      <div className="space-y-2 mb-4">
                        {previewCheckpoint.options.map((opt) => (
                          <label key={opt.optionId} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition ${previewMultiAnswers.includes(opt.optionId) ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}>
                            <input type="checkbox" checked={previewMultiAnswers.includes(opt.optionId)}
                              onChange={(e) => {
                                if (e.target.checked) setPreviewMultiAnswers([...previewMultiAnswers, opt.optionId]);
                                else setPreviewMultiAnswers(previewMultiAnswers.filter((id) => id !== opt.optionId));
                              }} className="h-4 w-4 text-indigo-600 rounded" />
                            <span className="text-sm">{opt.text}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {(previewCheckpoint.type === "fill_blank" || previewCheckpoint.type === "code_output") && (
                      <input type="text" value={previewTextAnswer} onChange={(e) => setPreviewTextAnswer(e.target.value)}
                        placeholder="Type your answer..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4" />
                    )}
                    <button type="button" onClick={handlePreviewSubmit}
                      className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
                      Submit Answer
                    </button>
                  </>
                )}
                {previewResult === "correct" && (
                  <>
                    <p className="text-lg font-bold text-emerald-700 mb-2">✓ Correct!</p>
                    {previewCheckpoint.explanation && <p className="text-sm text-slate-600 mb-4">{previewCheckpoint.explanation}</p>}
                    <button type="button" onClick={handlePreviewContinue}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500">Continue</button>
                  </>
                )}
                {previewResult === "incorrect" && (
                  <>
                    <p className="text-lg font-bold text-red-700 mb-2">✗ Incorrect</p>
                    {previewCheckpoint.explanation && <p className="text-sm text-slate-600 mb-4">{previewCheckpoint.explanation}</p>}
                    <button type="button" onClick={handlePreviewReview}
                      className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500">Review Again</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-slate-700">Interactive Checkpoints</p>
        <div className="flex gap-2 flex-wrap">
          {checkpoints.length > 0 && (
            <>
              <button type="button" onClick={startPreview} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">
                ▶ Preview
              </button>
              <button type="button" onClick={handleExport} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                ↓ Export
              </button>
            </>
          )}
          <button type="button" onClick={() => setShowImport(!showImport)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
            ↑ Import
          </button>
          <button type="button" onClick={handleDuplicate} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
            ⊕ Duplicate
          </button>
          {!showForm && (
            <button type="button" onClick={() => { resetForm(); setShowForm(true); }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition">
              + Add Checkpoint
            </button>
          )}
        </div>
      </div>

      {/* Bulk Import Panel */}
      {showImport && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600">Paste JSON (array of checkpoint objects)</p>
          <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} rows={6}
            placeholder='[{"questionTimestamp": 510, "reviewTimestamp": 405, "question": "...", "type": "mcq", "options": [...], "correctOptionId": "b"}]'
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleBulkImport} disabled={importing}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {importing ? "Importing…" : "Import"}
            </button>
            <button type="button" onClick={() => { setShowImport(false); setError(""); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Video Player — use for timestamp selection</p>
          <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-black">
            <video ref={videoRef} src={videoPreviewUrl} controls controlsList="nodownload noremoteplayback"
              disablePictureInPicture playsInline preload="metadata" className="h-full w-full" />
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Question appears at</label>
              <div className="flex gap-2">
                <input type="text" value={questionTimestamp} onChange={(e) => setQuestionTimestamp(e.target.value)}
                  placeholder="MM:SS" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
                <button type="button" onClick={useCurrentTimeForQuestion}
                  className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">Use Current Time</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Review starts at</label>
              <div className="flex gap-2">
                <input type="text" value={reviewTimestamp} onChange={(e) => setReviewTimestamp(e.target.value)}
                  placeholder="MM:SS" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
                <button type="button" onClick={useCurrentTimeForReview}
                  className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">Use Current Time</button>
              </div>
            </div>
          </div>

          {/* Question Type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Question Type</label>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value as CheckpointType)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Question */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Question</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is JWT mainly used for?" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
          </div>

          {/* Code snippet (for code_output) */}
          {questionType === "code_output" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Code Snippet</label>
              <textarea value={codeSnippet} onChange={(e) => setCodeSnippet(e.target.value)} rows={4}
                placeholder="console.log(typeof null);" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none" />
              <input type="text" value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}
                placeholder="Language (e.g. javascript)" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            </div>
          )}

          {/* Options (MCQ / Multi-select) */}
          {(questionType === "mcq" || questionType === "multi_select") && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Options ({questionType === "multi_select" ? "check all correct" : "mark the correct one"})
              </label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={opt.optionId} className="flex items-center gap-2">
                    {questionType === "mcq" ? (
                      <input type="radio" name="correctOption" value={opt.optionId}
                        checked={correctOptionId === opt.optionId} onChange={() => setCorrectOptionId(opt.optionId)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" />
                    ) : (
                      <input type="checkbox" checked={correctOptionIds.includes(opt.optionId)}
                        onChange={(e) => {
                          if (e.target.checked) setCorrectOptionIds([...correctOptionIds, opt.optionId]);
                          else setCorrectOptionIds(correctOptionIds.filter((id) => id !== opt.optionId));
                        }} className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500" />
                    )}
                    <span className="text-xs font-semibold text-slate-500 w-5">{opt.optionId.toUpperCase()}.</span>
                    <input type="text" value={opt.text} onChange={(e) => {
                      const updated = [...options]; updated[i] = { ...updated[i], text: e.target.value }; setOptions(updated);
                    }} placeholder={`Option ${opt.optionId.toUpperCase()}`}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* True/False options */}
          {questionType === "true_false" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Correct Answer</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tfAnswer" value="true" checked={correctOptionId === "true"}
                    onChange={() => setCorrectOptionId("true")} className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">True</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tfAnswer" value="false" checked={correctOptionId === "false"}
                    onChange={() => setCorrectOptionId("false")} className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">False</span>
                </label>
              </div>
            </div>
          )}

          {/* Fill-blank / Code output answer */}
          {(questionType === "fill_blank" || questionType === "code_output") && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Correct Answer</label>
              <input type="text" value={correctText} onChange={(e) => setCorrectText(e.target.value)}
                placeholder="e.g. object" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
              <label className="block text-xs font-medium text-slate-600 mt-2 mb-1">Alternative Answers (comma-separated)</label>
              <input type="text" value={acceptableAnswers} onChange={(e) => setAcceptableAnswers(e.target.value)}
                placeholder="e.g. Object, OBJECT" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            </div>
          )}

          {/* Explanation + Bonus XP */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Explanation (optional)</label>
              <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)}
                placeholder="Shown after answering..." rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bonus XP (first-attempt correct)</label>
              <input type="number" value={bonusXp} onChange={(e) => setBonusXp(e.target.value)} min={0} max={100}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60 transition">
              {saving ? "Saving…" : editingId ? "Update Checkpoint" : "Save Checkpoint"}
            </button>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Checkpoint List */}
      {loading ? (
        <div className="flex items-center justify-center py-6"><div className="spinner spinner--inline" /></div>
      ) : checkpoints.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-8 text-center">
          <p className="text-sm text-slate-500">No checkpoints yet. Add one to make the video interactive.</p>
        </div>
      ) : checkpoints.length > 0 ? (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Time</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Type</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Question</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkpoints.map((cp) => (
                <tr key={cp._id} className={cp.isActive ? "" : "opacity-50"}>
                  <td className="px-3 py-2 font-mono text-xs">{formatTime(cp.questionTimestamp)}</td>
                  <td className="px-3 py-2 text-xs"><span className="rounded bg-slate-100 px-1.5 py-0.5">{TYPE_LABELS[cp.type]}</span></td>
                  <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{cp.question}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openEdit(cp)} className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition">Edit</button>
                      <button type="button" onClick={() => handleToggleActive(cp)} className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">{cp.isActive ? "Disable" : "Enable"}</button>
                      <button type="button" onClick={() => handleDelete(cp._id)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
