"use client";

import { useState } from "react";
import { ROLE } from "@funt-platform/constants";

const CATEGORIES = [
  { value: "platform-overview", label: "Platform Overview" },
  { value: "authentication", label: "Authentication" },
  { value: "courses", label: "Courses" },
  { value: "batches", label: "Batches" },
  { value: "students", label: "Students" },
  { value: "trainers", label: "Trainers" },
  { value: "parents", label: "Parents" },
  { value: "payments", label: "Payments" },
  { value: "license-keys", label: "License Keys" },
  { value: "learning-plans", label: "Learning Plans" },
  { value: "assignments", label: "Assignments" },
  { value: "attendance", label: "Attendance" },
  { value: "certificates", label: "Certificates" },
  { value: "shop", label: "Shop" },
  { value: "gamification", label: "Gamification" },
  { value: "tickets", label: "Tickets" },
  { value: "leave-management", label: "Leave Management" },
  { value: "analytics", label: "Analytics" },
  { value: "import-export", label: "Import/Export" },
  { value: "content-protection", label: "Content Protection" },
];

const ARTICLE_TYPES = [
  { value: "GUIDE", label: "Guide" },
  { value: "FAQ", label: "FAQ" },
  { value: "TROUBLESHOOTING", label: "Troubleshooting" },
  { value: "RELEASE_NOTE", label: "Release Note" },
  { value: "ONBOARDING", label: "Onboarding" },
];

const ALL_ROLES = [
  { value: ROLE.SUPER_ADMIN, label: "Super Admin" },
  { value: ROLE.ADMIN, label: "Admin" },
  { value: ROLE.SUB_ADMIN, label: "Sub Admin" },
  { value: ROLE.TRAINER, label: "Trainer" },
  { value: ROLE.SUPPORT_AGENT, label: "Support Agent" },
  { value: ROLE.STUDENT, label: "Student" },
  { value: ROLE.PARENT, label: "Parent" },
  { value: ROLE.FRANCHISE_ADMIN, label: "Franchise Admin" },
];

interface ArticleFormProps {
  initialData?: {
    title?: string;
    category?: string;
    subcategory?: string;
    type?: string;
    roles?: string[];
    content?: string;
    summary?: string;
    tags?: string[];
    order?: number;
    onboardingStep?: number;
    onboardingRole?: string;
    isPublished?: boolean;
  };
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}

export function KnowledgeArticleForm({ initialData, onSubmit, saving }: ArticleFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "platform-overview");
  const [subcategory, setSubcategory] = useState(initialData?.subcategory ?? "");
  const [type, setType] = useState(initialData?.type ?? "GUIDE");
  const [roles, setRoles] = useState<string[]>(initialData?.roles ?? [ROLE.STUDENT]);
  const [content, setContent] = useState(initialData?.content ?? "");
  const [summary, setSummary] = useState(initialData?.summary ?? "");
  const [tagsInput, setTagsInput] = useState((initialData?.tags ?? []).join(", "));
  const [order, setOrder] = useState(initialData?.order ?? 0);
  const [onboardingStep, setOnboardingStep] = useState(initialData?.onboardingStep ?? 1);
  const [onboardingRole, setOnboardingRole] = useState(initialData?.onboardingRole ?? ROLE.STUDENT);
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? true);

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const data: Record<string, unknown> = {
      title,
      category,
      subcategory: subcategory || undefined,
      type,
      roles,
      content,
      summary: summary || undefined,
      tags,
      order,
      isPublished,
    };
    if (type === "ONBOARDING") {
      data.onboardingStep = onboardingStep;
      data.onboardingRole = onboardingRole;
    }
    onSubmit(data);
  }

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className={labelClass}>Title *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} className={inputClass} placeholder="e.g. How to Create a Batch" />
      </div>

      {/* Summary */}
      <div>
        <label className={labelClass}>Summary</label>
        <input type="text" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} className={inputClass} placeholder="Brief description (max 500 chars)" />
      </div>

      {/* Category & Type Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Category *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Subcategory</label>
          <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={inputClass} placeholder="Optional subcategory" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Type *</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {ARTICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Display Order</label>
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={inputClass} min={0} />
        </div>
      </div>

      {/* Onboarding Fields */}
      {type === "ONBOARDING" && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Onboarding Role</label>
            <select value={onboardingRole} onChange={(e) => setOnboardingRole(e.target.value)} className={inputClass}>
              {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Onboarding Step</label>
            <input type="number" value={onboardingStep} onChange={(e) => setOnboardingStep(Number(e.target.value))} min={1} className={inputClass} />
          </div>
        </div>
      )}

      {/* Role Visibility */}
      <div>
        <label className={labelClass}>Visible to Roles *</label>
        <p className="mb-2 text-xs text-slate-500">Select which roles can see this article.</p>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleRole(r.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                roles.includes(r.value)
                  ? "border-indigo-300 bg-indigo-100 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {roles.length === 0 && (
          <p className="mt-1 text-xs text-red-500">At least one role must be selected.</p>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className={labelClass}>Tags</label>
        <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} placeholder="Comma-separated tags (e.g. attendance, batch, schedule)" />
      </div>

      {/* Content */}
      <div>
        <label className={labelClass}>Content * (HTML supported)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={16}
          className={`${inputClass} font-mono text-xs`}
          placeholder="Write the article content here. HTML tags are supported for formatting."
        />
      </div>

      {/* Published Toggle */}
      <div className="flex items-center gap-3">
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="peer sr-only" />
          <div className="peer h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full" />
        </label>
        <span className="text-sm font-medium text-slate-700">{isPublished ? "Published" : "Draft"}</span>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
        <button
          type="submit"
          disabled={saving || !title.trim() || !content.trim() || roles.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : initialData ? "Update Article" : "Create Article"}
        </button>
      </div>
    </form>
  );
}
