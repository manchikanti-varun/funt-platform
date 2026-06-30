"use client";

import { useState } from "react";

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

export function QuizForm({ initialData, onSave, saving }: Props) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [type, setType] = useState(initialData?.type ?? "CHAPTER");
  const [status, setStatus] = useState(initialData?.status ?? "DRAFT");
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
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
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

        {questions.map((q, qIdx) => (
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Image URL (optional)</label>
                <input type="text" value={q.imageUrl ?? ""} onChange={(e) => updateQuestion(qIdx, { imageUrl: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
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
                    className="h-4 w-4 text-emerald-600"
                    title="Mark as correct"
                  />
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(qIdx, oIdx, { text: e.target.value })}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    placeholder={`Option ${oIdx + 1}`}
                  />
                  <input
                    type="text"
                    value={opt.imageUrl ?? ""}
                    onChange={(e) => updateOption(qIdx, oIdx, { imageUrl: e.target.value })}
                    className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    placeholder="Image URL"
                  />
                  {q.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(qIdx, oIdx)} className="text-xs text-red-500 hover:text-red-700">✕</button>
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
        ))}
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
