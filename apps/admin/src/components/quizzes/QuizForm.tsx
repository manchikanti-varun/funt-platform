"use client";

import { useState } from "react";
import { makeUploadImageFn } from "@/lib/uploadImageToR2";

interface QuizOption {
  optionId: string;
  text: string;
  imageUrl?: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  questionId: string;
  type: string;
  text: string;
  imageUrl?: string;
  options: QuizOption[];
  explanation: string;
  marks: number;
  order: number;
}

interface QuizFormData {
  title: string;
  description: string;
  type: string;
  status: string;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionsPerAttempt: number;
  requiredForCertificate: boolean;
  questions: QuizQuestion[];
}

interface Props {
  initialData?: Partial<QuizFormData>;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}

function genId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function blankOption(): QuizOption {
  return { optionId: genId(), text: "", imageUrl: "", isCorrect: false };
}

function blankQuestion(order: number): QuizQuestion {
  return {
    questionId: genId(),
    type: "SINGLE_SELECT",
    text: "",
    imageUrl: "",
    options: [blankOption(), blankOption(), blankOption(), blankOption()],
    explanation: "",
    marks: 1,
    order,
  };
}

// ── Small upload button that replaces itself with a thumbnail on success ───────
function ImageUploadCell({
  value,
  onChange,
  uploadCtx,
}: {
  value: string;
  onChange: (url: string) => void;
  uploadCtx: { courseId: string; moduleId: string };
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const upload = makeUploadImageFn(uploadCtx);
      const { url } = await upload(file);
      onChange(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (value) {
    return (
      <div className="relative flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="preview" className="h-8 w-8 rounded object-cover border border-slate-200" />
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-red-500 hover:text-red-700 font-bold leading-none"
          title="Remove image"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <label className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
      {uploading ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          Uploading…
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
          </svg>
          Image
        </>
      )}
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={handleFile} />
    </label>
  );
}

export function QuizForm({ initialData, onSave, saving }: Props) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [type, setType] = useState(initialData?.type ?? "CHAPTER");
  const [status, setStatus] = useState(initialData?.status ?? "ACTIVE");
  const [passingScore, setPassingScore] = useState(initialData?.passingScore ?? 70);
  const [maxAttempts, setMaxAttempts] = useState(initialData?.maxAttempts ?? 0);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(initialData?.timeLimitMinutes ?? 0);
  const [shuffleQuestions, setShuffleQuestions] = useState(initialData?.shuffleQuestions ?? false);
  const [shuffleOptions, setShuffleOptions] = useState(initialData?.shuffleOptions ?? false);
  const [questionsPerAttempt, setQuestionsPerAttempt] = useState(initialData?.questionsPerAttempt ?? 0);
  const [requiredForCertificate, setRequiredForCertificate] = useState(initialData?.requiredForCertificate ?? false);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialData?.questions ?? [blankQuestion(0)]);

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion(prev.length)]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i })));
  }

  function updateQuestion(idx: number, updates: Partial<QuizQuestion>) {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  }

  function updateOption(qIdx: number, oIdx: number, updates: Partial<QuizOption>) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const newOptions = q.options.map((o, j) => {
        if (j !== oIdx) return updates.isCorrect ? { ...o, isCorrect: false } : o;
        return { ...o, ...updates };
      });
      return { ...q, options: newOptions };
    }));
  }

  function addOption(qIdx: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: [...q.options, blankOption()] };
    }));
  }

  function removeOption(qIdx: number, oIdx: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: q.options.filter((_, j) => j !== oIdx) };
    }));
  }

  function handleSubmit() {
    onSave({
      title, description, type, status, passingScore, maxAttempts,
      timeLimitMinutes, shuffleQuestions, shuffleOptions,
      questionsPerAttempt, requiredForCertificate, questions,
    });
  }

  return (
    <div className="space-y-6">
      {/* Basic settings */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Quiz Settings</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Chapter 1 Quiz" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="CHAPTER">Chapter Quiz</option>
              <option value="MILESTONE">Milestone Quiz</option>
              <option value="COURSE_FINAL">Course Final Quiz</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Optional description..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Passing Score (%)</label>
            <input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Attempts (0 = unlimited)</label>
            <input type="number" min={0} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Time Limit (minutes, 0 = none)</label>
            <input type="number" min={0} value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          {(type === "MILESTONE" || type === "COURSE_FINAL") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Questions Per Attempt (0 = all)</label>
              <input type="number" min={0} value={questionsPerAttempt} onChange={(e) => setQuestionsPerAttempt(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="rounded border-slate-300" />
            Shuffle Questions
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} className="rounded border-slate-300" />
            Shuffle Options
          </label>
          {type === "COURSE_FINAL" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiredForCertificate} onChange={(e) => setRequiredForCertificate(e.target.checked)} className="rounded border-slate-300" />
              Required for Certificate
            </label>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Questions ({questions.length})</h2>
          <button type="button" onClick={addQuestion} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
            + Add Question
          </button>
        </div>

        {questions.map((q, qIdx) => {
          const uploadCtx = { courseId: "quizzes", moduleId: q.questionId };
          return (
            <div key={q.questionId} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-slate-500">Q{qIdx + 1}</span>
                <button type="button" onClick={() => removeQuestion(qIdx)} className="text-xs font-semibold text-red-500 hover:text-red-700">Remove</button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Question Text *</label>
                <textarea value={q.text} onChange={(e) => updateQuestion(qIdx, { text: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Enter question..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Question Image (optional)</label>
                  <ImageUploadCell
                    value={q.imageUrl ?? ""}
                    onChange={(url) => updateQuestion(qIdx, { imageUrl: url })}
                    uploadCtx={uploadCtx}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Marks</label>
                  <input type="number" min={0} value={q.marks} onChange={(e) => updateQuestion(qIdx, { marks: Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Options (select correct answer)</label>
                {q.options.map((opt, oIdx) => (
                  <div key={opt.optionId} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct_${q.questionId}`}
                      checked={opt.isCorrect}
                      onChange={() => updateOption(qIdx, oIdx, { isCorrect: true })}
                      className="h-4 w-4 text-emerald-600 shrink-0"
                      title="Mark as correct"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOption(qIdx, oIdx, { text: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      placeholder={`Option ${oIdx + 1}`}
                    />
                    <ImageUploadCell
                      value={opt.imageUrl ?? ""}
                      onChange={(url) => updateOption(qIdx, oIdx, { imageUrl: url })}
                      uploadCtx={{ courseId: "quizzes", moduleId: `${q.questionId}_opt${oIdx}` }}
                    />
                    {q.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(qIdx, oIdx)} className="text-xs text-red-500 hover:text-red-700 shrink-0">&times;</button>
                    )}
                  </div>
                ))}
                {q.options.length < 10 && (
                  <button type="button" onClick={() => addOption(qIdx)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                    + Add Option
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Explanation (shown after submission)</label>
                <textarea value={q.explanation} onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Why this answer is correct..." />
              </div>
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Quiz"}
        </button>
      </div>
    </div>
  );
}
