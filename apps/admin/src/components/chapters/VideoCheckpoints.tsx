"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  Play,
  Plus,
  Download,
  Upload,
  Copy,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  Code2,
  ListChecks,
  ToggleLeft as TFIcon,
  TextCursorInput,
  Zap,
} from "lucide-react";

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

const TYPE_ICONS: Record<CheckpointType, React.ReactNode> = {
  mcq: <ListChecks className="h-3.5 w-3.5" />,
  true_false: <TFIcon className="h-3.5 w-3.5" />,
  multi_select: <ListChecks className="h-3.5 w-3.5" />,
  fill_blank: <TextCursorInput className="h-3.5 w-3.5" />,
  code_output: <Code2 className="h-3.5 w-3.5" />,
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
    try { parsed = JSON.parse(importJson); } catch { setError("Invalid JSON."); return; }
    const items = Array.isArray(parsed) ? parsed : parsed.checkpoints;
    if (!Array.isArray(items) || items.length === 0) { setError("Expected an array of checkpoints."); return; }
    setImporting(true);
    const res = await api(`/api/checkpoints/module/${moduleId}/bulk-import`, {
      method: "POST", body: JSON.stringify({ checkpoints: items }),
    });
    if (res.success) { setShowImport(false); setImportJson(""); void fetchCheckpoints(); }
    else setError(res.message ?? "Import failed.");
    setImporting(false);
  }

  // ─── Duplicate ────────────────────────────────────────────────────────────

  async function handleDuplicate() {
    const sourceId = prompt("Enter the source module ID to copy checkpoints from:");
    if (!sourceId?.trim()) return;
    const res = await api(`/api/checkpoints/module/${moduleId}/duplicate`, {
      method: "POST", body: JSON.stringify({ sourceModuleId: sourceId.trim() }),
    });
    if (res.success) void fetchCheckpoints();
    else alert(res.message ?? "Duplicate failed.");
  }

  // ─── Preview Mode ─────────────────────────────────────────────────────────

  function startPreview() {
    setPreviewMode(true);
    setPreviewCheckpoint(null);
    setPreviewResult(null);
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
    if (previewVideoRef.current) { previewVideoRef.current.currentTime = rt; previewVideoRef.current.play(); }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!videoPreviewUrl) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Play className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Interactive Checkpoints</p>
            <p className="text-xs text-slate-500">Upload an MP4 video to enable interactive checkpoints.</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Preview Mode Overlay ─────────────────────────────────────────────────

  if (previewMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-indigo-600" />
            <p className="text-sm font-semibold text-indigo-800">Preview Mode</p>
            <span className="text-xs text-indigo-600">Experience checkpoints as a student would</span>
          </div>
          <button type="button" onClick={() => setPreviewMode(false)}
            className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition">
            Exit Preview
          </button>
        </div>
        <div className="relative">
          <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black shadow-md">
            <video ref={previewVideoRef} src={videoPreviewUrl} controls playsInline preload="metadata"
              className="h-full w-full" onTimeUpdate={handlePreviewTimeUpdate} />
          </div>
          {previewCheckpoint && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
              <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {!previewResult && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
                        {TYPE_ICONS[previewCheckpoint.type]}
                      </div>
                      <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                        {TYPE_LABELS[previewCheckpoint.type]}
                      </span>
                      <span className="ml-auto text-xs font-mono text-slate-400">{formatTime(previewCheckpoint.questionTimestamp)}</span>
                    </div>
                    {previewCheckpoint.codeSnippet && (
                      <pre className="mb-3 rounded-lg bg-slate-900 p-3 text-xs text-green-300 overflow-x-auto font-mono"><code>{previewCheckpoint.codeSnippet}</code></pre>
                    )}
                    <p className="text-base font-semibold text-slate-900 mb-4">{previewCheckpoint.question}</p>
                    {(previewCheckpoint.type === "mcq" || previewCheckpoint.type === "true_false") && (
                      <div className="space-y-2 mb-4">
                        {previewCheckpoint.options.map((opt) => (
                          <label key={opt.optionId} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${previewAnswer === opt.optionId ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                            <input type="radio" name="preview-answer" value={opt.optionId} checked={previewAnswer === opt.optionId} onChange={() => setPreviewAnswer(opt.optionId)} className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm">{opt.text}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {previewCheckpoint.type === "multi_select" && (
                      <div className="space-y-2 mb-4">
                        {previewCheckpoint.options.map((opt) => (
                          <label key={opt.optionId} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${previewMultiAnswers.includes(opt.optionId) ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                            <input type="checkbox" checked={previewMultiAnswers.includes(opt.optionId)} onChange={(e) => { if (e.target.checked) setPreviewMultiAnswers([...previewMultiAnswers, opt.optionId]); else setPreviewMultiAnswers(previewMultiAnswers.filter((id) => id !== opt.optionId)); }} className="h-4 w-4 text-indigo-600 rounded" />
                            <span className="text-sm">{opt.text}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {(previewCheckpoint.type === "fill_blank" || previewCheckpoint.type === "code_output") && (
                      <input type="text" value={previewTextAnswer} onChange={(e) => setPreviewTextAnswer(e.target.value)} placeholder="Type your answer..."
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm mb-4 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
                    )}
                    <button type="button" onClick={handlePreviewSubmit}
                      className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition">
                      Submit Answer
                    </button>
                  </>
                )}
                {previewResult === "correct" && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      <p className="text-lg font-bold text-emerald-700">Correct!</p>
                    </div>
                    {previewCheckpoint.explanation && <p className="text-sm text-slate-600 mb-4 pl-11">{previewCheckpoint.explanation}</p>}
                    <button type="button" onClick={handlePreviewContinue} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition">Continue</button>
                  </>
                )}
                {previewResult === "incorrect" && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <XCircle className="h-8 w-8 text-red-500" />
                      <p className="text-lg font-bold text-red-700">Not quite</p>
                    </div>
                    {previewCheckpoint.explanation && <p className="text-sm text-slate-600 mb-4 pl-11">{previewCheckpoint.explanation}</p>}
                    <button type="button" onClick={handlePreviewReview} className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 transition">Review Again</button>
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
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
            <Timer className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Interactive Checkpoints</p>
            <p className="text-xs text-slate-500">{checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {checkpoints.length > 0 && (
            <>
              <button type="button" onClick={startPreview} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">
                <Play className="h-3.5 w-3.5" /> Preview
              </button>
              <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </>
          )}
          <button type="button" onClick={() => setShowImport(!showImport)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <button type="button" onClick={handleDuplicate} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          {!showForm && (
            <button type="button" onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>

      {/* Bulk Import Panel */}
      {showImport && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-slate-500" />
            <p className="text-xs font-semibold text-slate-700">Bulk Import — paste JSON array</p>
          </div>
          <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} rows={5}
            placeholder='[{"questionTimestamp": 510, "reviewTimestamp": 405, "question": "...", "type": "mcq", "options": [...], "correctOptionId": "b"}]'
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none" />
          {error && showImport && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleBulkImport} disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition">
              {importing ? "Importing..." : "Import Checkpoints"}
            </button>
            <button type="button" onClick={() => { setShowImport(false); setError(""); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              {editingId ? "Edit Checkpoint" : "New Checkpoint"} — Use video player to pick timestamps
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* Video player */}
            <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-black shadow-inner">
              <video ref={videoRef} src={videoPreviewUrl} controls controlsList="nodownload noremoteplayback"
                disablePictureInPicture playsInline preload="metadata" className="h-full w-full" />
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Question appears at</label>
                <div className="flex gap-2">
                  <input type="text" value={questionTimestamp} onChange={(e) => setQuestionTimestamp(e.target.value)}
                    placeholder="MM:SS" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none font-mono" />
                  <button type="button" onClick={useCurrentTimeForQuestion}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">
                    <Clock className="h-3.5 w-3.5" /> Use Current
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Review starts at</label>
                <div className="flex gap-2">
                  <input type="text" value={reviewTimestamp} onChange={(e) => setReviewTimestamp(e.target.value)}
                    placeholder="MM:SS" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none font-mono" />
                  <button type="button" onClick={useCurrentTimeForReview}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">
                    <Clock className="h-3.5 w-3.5" /> Use Current
                  </button>
                </div>
              </div>
            </div>

            {/* Question Type */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Question Type</label>
              <select value={questionType} onChange={(e) => setQuestionType(e.target.value as CheckpointType)}
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none bg-white">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Question text */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Question</label>
              <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is JWT mainly used for?" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            </div>

            {/* Code snippet */}
            {questionType === "code_output" && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Code Snippet</label>
                <textarea value={codeSnippet} onChange={(e) => setCodeSnippet(e.target.value)} rows={4}
                  placeholder="console.log(typeof null);" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono bg-slate-50 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none" />
                <input type="text" value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}
                  placeholder="Language (e.g. javascript)" className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
              </div>
            )}

            {/* MCQ / Multi-select options */}
            {(questionType === "mcq" || questionType === "multi_select") && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Options — {questionType === "multi_select" ? "check all correct" : "select the correct one"}
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
                          onChange={(e) => { if (e.target.checked) setCorrectOptionIds([...correctOptionIds, opt.optionId]); else setCorrectOptionIds(correctOptionIds.filter((id) => id !== opt.optionId)); }}
                          className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500" />
                      )}
                      <span className="text-xs font-bold text-slate-400 w-5 text-center">{opt.optionId.toUpperCase()}</span>
                      <input type="text" value={opt.text} onChange={(e) => { const u = [...options]; u[i] = { ...u[i], text: e.target.value }; setOptions(u); }}
                        placeholder={`Option ${opt.optionId.toUpperCase()}`}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* True/False */}
            {questionType === "true_false" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Correct Answer</label>
                <div className="flex gap-4">
                  {[{ id: "true", label: "True" }, { id: "false", label: "False" }].map((o) => (
                    <label key={o.id} className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 cursor-pointer transition ${correctOptionId === o.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <input type="radio" name="tfAnswer" value={o.id} checked={correctOptionId === o.id} onChange={() => setCorrectOptionId(o.id)} className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-medium">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Fill-blank / Code output answer */}
            {(questionType === "fill_blank" || questionType === "code_output") && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Correct Answer</label>
                <input type="text" value={correctText} onChange={(e) => setCorrectText(e.target.value)}
                  placeholder="e.g. object" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
                <label className="block text-xs font-medium text-slate-600">Alternative Answers (comma-separated)</label>
                <input type="text" value={acceptableAnswers} onChange={(e) => setAcceptableAnswers(e.target.value)}
                  placeholder="e.g. Object, OBJECT" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
              </div>
            )}

            {/* Explanation + Bonus XP */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Explanation (optional)</label>
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Shown after answering..." rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none" />
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                  <Zap className="h-3 w-3 text-amber-500" /> Bonus XP
                </label>
                <input type="number" value={bonusXp} onChange={(e) => setBonusXp(e.target.value)} min={0} max={100}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
                <p className="mt-1 text-[10px] text-slate-400">Awarded on first-attempt correct</p>
              </div>
            </div>

            {/* Error */}
            {error && !showImport && <p className="text-xs font-medium text-red-600">{error}</p>}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60 transition">
                {saving ? "Saving..." : editingId ? "Update Checkpoint" : "Save Checkpoint"}
              </button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkpoint List */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><div className="spinner spinner--inline" /></div>
      ) : checkpoints.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-10 text-center">
          <Timer className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No checkpoints yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add one to make the video interactive for students.</p>
        </div>
      ) : checkpoints.length > 0 ? (
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Question</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkpoints.map((cp) => (
                <tr key={cp._id} className={`transition-colors hover:bg-slate-50/50 ${cp.isActive ? "" : "opacity-40"}`}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-slate-700 bg-slate-100 rounded-md px-2 py-0.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {formatTime(cp.questionTimestamp)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md px-2 py-0.5">
                      {TYPE_ICONS[cp.type]}
                      {TYPE_LABELS[cp.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-sm max-w-[250px] truncate">{cp.question}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <button type="button" onClick={() => openEdit(cp)} title="Edit"
                        className="rounded-md p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleToggleActive(cp)} title={cp.isActive ? "Disable" : "Enable"}
                        className="rounded-md p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition">
                        {cp.isActive ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                      <button type="button" onClick={() => handleDelete(cp._id)} title="Delete"
                        className="rounded-md p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
