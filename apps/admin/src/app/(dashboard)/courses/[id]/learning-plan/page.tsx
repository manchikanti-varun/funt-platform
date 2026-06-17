"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { COURSE_DELIVERY_MODE, MILESTONE_UNLOCK_TYPE, MILESTONE_COMPLETION_RULE } from "@funt-platform/constants";
import { EntityDetailLoadingScreen } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { useAppDialog } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MilestoneForm {
  milestoneId?: string;
  title: string;
  description: string;
  order: number;
  feeInPaise: number;
  unlockType: string;
  completionRule: string;
  unlockAfterDate: string;
  unlockAfterDays: string;
  paymentDueInDays: string;
  certificateEligible: boolean;
  active: boolean;
  chapterOrders: string; // comma-separated string for input
}

interface Milestone {
  milestoneId: string;
  title: string;
  description?: string;
  order: number;
  feeInPaise: number;
  unlockType: string;
  completionRule: string;
  unlockAfterDate?: string;
  unlockAfterDays?: number;
  paymentDueInDays?: number;
  certificateEligible: boolean;
  active: boolean;
  chapterOrders: number[];
}

interface LearningPlan {
  enabled: boolean;
  autoLockPreviousMilestones: boolean;
  milestones: Milestone[];
}

interface CourseInfo {
  id: string;
  courseId?: string;
  title: string;
  deliveryMode?: string;
  learningPlan?: LearningPlan;
  modules?: { order: number; title?: string }[];
}

// ─── Blank form ───────────────────────────────────────────────────────────────

function blankForm(order: number): MilestoneForm {
  return {
    title: "",
    description: "",
    order,
    feeInPaise: 0,
    unlockType: MILESTONE_UNLOCK_TYPE.PAYMENT_AFTER_COMPLETION,
    completionRule: MILESTONE_COMPLETION_RULE.COMPLETE_ALL_CHAPTERS,
    unlockAfterDate: "",
    unlockAfterDays: "",
    paymentDueInDays: "",
    certificateEligible: false,
    active: true,
    chapterOrders: "",
  };
}

function milestoneToForm(m: Milestone): MilestoneForm {
  return {
    milestoneId: m.milestoneId,
    title: m.title,
    description: m.description ?? "",
    order: m.order,
    feeInPaise: m.feeInPaise,
    unlockType: m.unlockType,
    completionRule: m.completionRule,
    unlockAfterDate: m.unlockAfterDate ? new Date(m.unlockAfterDate).toISOString().split("T")[0] : "",
    unlockAfterDays: m.unlockAfterDays != null ? String(m.unlockAfterDays) : "",
    paymentDueInDays: m.paymentDueInDays != null ? String(m.paymentDueInDays) : "",
    certificateEligible: m.certificateEligible,
    active: m.active,
    chapterOrders: (m.chapterOrders ?? []).join(", "),
  };
}

function formToPayload(f: MilestoneForm) {
  return {
    milestoneId: f.milestoneId || undefined,
    title: f.title.trim(),
    description: f.description.trim(),
    order: Number(f.order),
    feeInPaise: Math.max(0, Math.floor(Number(f.feeInPaise ?? 0))),
    unlockType: f.unlockType,
    completionRule: f.completionRule,
    unlockAfterDate: f.unlockAfterDate || undefined,
    unlockAfterDays: f.unlockAfterDays ? Number(f.unlockAfterDays) : undefined,
    paymentDueInDays: f.paymentDueInDays ? Number(f.paymentDueInDays) : undefined,
    certificateEligible: f.certificateEligible,
    active: f.active,
    chapterOrders: f.chapterOrders
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0),
  };
}

// ─── Unlock type labels ───────────────────────────────────────────────────────

const UNLOCK_TYPE_LABELS: Record<string, string> = {
  [MILESTONE_UNLOCK_TYPE.FREE]: "Free (auto-unlock on enrollment)",
  [MILESTONE_UNLOCK_TYPE.PAYMENT_AFTER_COMPLETION]: "Payment after previous milestone completion",
  [MILESTONE_UNLOCK_TYPE.DATE_BASED]: "Unlock on specific date",
  [MILESTONE_UNLOCK_TYPE.RELATIVE_DATE]: "Unlock after X days from enrollment",
};

const COMPLETION_RULE_LABELS: Record<string, string> = {
  [MILESTONE_COMPLETION_RULE.COMPLETE_ALL_CHAPTERS]: "Complete all chapters",
  [MILESTONE_COMPLETION_RULE.COMPLETE_80_PERCENT]: "Complete 80% of chapters",
  [MILESTONE_COMPLETION_RULE.COMPLETE_ASSIGNMENT]: "Complete assignment",
  [MILESTONE_COMPLETION_RULE.MANUAL_APPROVAL]: "Admin manual approval",
};

// ─── Milestone form panel ─────────────────────────────────────────────────────

function MilestoneFormPanel({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  modules,
  isEdit,
  assignedByOthers,
}: {
  form: MilestoneForm;
  onChange: (f: MilestoneForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  modules: { order: number; title?: string }[];
  isEdit: boolean;
  assignedByOthers: Set<number>;
}) {
  const [chapterSearch, setChapterSearch] = useState("");

  function set<K extends keyof MilestoneForm>(key: K, value: MilestoneForm[K]) {
    onChange({ ...form, [key]: value });
  }

  const filteredModules = chapterSearch.trim()
    ? modules.filter((m) => (m.title ?? `Chapter ${m.order + 1}`).toLowerCase().includes(chapterSearch.toLowerCase()))
    : modules;

  const showDateField = form.unlockType === MILESTONE_UNLOCK_TYPE.DATE_BASED;
  const showRelativeDays = form.unlockType === MILESTONE_UNLOCK_TYPE.RELATIVE_DATE;
  const showFee = form.unlockType === MILESTONE_UNLOCK_TYPE.PAYMENT_AFTER_COMPLETION;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-indigo-800">
        {isEdit ? "Edit Milestone" : "New Milestone"}
      </h3>

      {error && (
        <div className="alert--error">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="input w-full"
            placeholder="e.g. Month 1 — Fundamentals"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-700">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="input w-full"
            placeholder="Brief overview of what students learn in this milestone"
          />
        </div>

        {/* Unlock type */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Unlock Type</label>
          <select
            value={form.unlockType}
            onChange={(e) => set("unlockType", e.target.value)}
            className="input w-full"
          >
            {Object.entries(UNLOCK_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Fee — only shown for payment unlock */}
        {showFee && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Fee (₹)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.feeInPaise / 100}
              onChange={(e) => set("feeInPaise", Math.round(parseFloat(e.target.value || "0") * 100))}
              className="input w-full"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-slate-500">Enter in rupees. Leave 0 for free payment milestone.</p>
          </div>
        )}

        {/* Payment due in days */}
        {showFee && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Due (days)</label>
            <input
              type="number"
              min={1}
              value={form.paymentDueInDays}
              onChange={(e) => set("paymentDueInDays", e.target.value)}
              className="input w-full"
              placeholder="e.g. 10"
            />
            <p className="mt-1 text-xs text-slate-500">Days after eligibility before payment is overdue.</p>
          </div>
        )}

        {/* Date unlock */}
        {showDateField && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Unlock On Date</label>
            <input
              type="date"
              value={form.unlockAfterDate}
              onChange={(e) => set("unlockAfterDate", e.target.value)}
              className="input w-full"
            />
          </div>
        )}

        {/* Relative days */}
        {showRelativeDays && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Unlock After (days from enrollment)</label>
            <input
              type="number"
              min={1}
              value={form.unlockAfterDays}
              onChange={(e) => set("unlockAfterDays", e.target.value)}
              className="input w-full"
              placeholder="e.g. 30"
            />
          </div>
        )}

        {/* Completion rule */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Completion Rule</label>
          <select
            value={form.completionRule}
            onChange={(e) => set("completionRule", e.target.value)}
            className="input w-full"
          >
            {Object.entries(COMPLETION_RULE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chapter assignments — checkboxes with search */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">
          Assign Chapters
        </label>
        {modules.length > 0 && (
          <>
            <input
              type="text"
              placeholder="Search chapters..."
              value={chapterSearch}
              onChange={(e) => setChapterSearch(e.target.value)}
              className="input mb-2 w-full max-w-sm"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1">
              {filteredModules.map((m) => {
                const isAssigned = form.chapterOrders
                  .split(",")
                  .map((s) => parseInt(s.trim(), 10))
                  .includes(m.order);
                const takenByOther = assignedByOthers.has(m.order);
                return (
                  <label
                    key={m.order}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${takenByOther ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={takenByOther}
                      onChange={() => {
                        if (takenByOther) return;
                        const orders = form.chapterOrders
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const orderStr = String(m.order);
                        if (isAssigned) {
                          set("chapterOrders", orders.filter((o) => o !== orderStr).join(", "));
                        } else {
                          set("chapterOrders", [...orders, orderStr].join(", "));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-800">
                      {m.title ?? `Chapter ${m.order + 1}`}
                    </span>
                    {takenByOther && <span className="text-[10px] text-slate-400 ml-auto">Assigned to another milestone</span>}
                  </label>
                );
              })}
            </div>
          </>
        )}
        {/* Selected chapters display with reordering */}
        {form.chapterOrders.trim() && (
          <div className="mt-2">
            <p className="text-xs font-medium text-slate-600 mb-1">Selected ({form.chapterOrders.split(",").filter((s) => s.trim()).length})</p>
            <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
              {form.chapterOrders.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)).map((order, idx, arr) => {
                const mod = modules.find((m) => m.order === order);
                return (
                  <li key={order} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 border border-slate-100">
                    <span className="flex-1 text-sm text-slate-800">{mod?.title ?? `Chapter ${order + 1}`}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (idx === 0) return;
                        const newArr = [...arr];
                        [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
                        set("chapterOrders", newArr.join(", "));
                      }}
                      disabled={idx === 0}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (idx === arr.length - 1) return;
                        const newArr = [...arr];
                        [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
                        set("chapterOrders", newArr.join(", "));
                      }}
                      disabled={idx === arr.length - 1}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newArr = arr.filter((_, i) => i !== idx);
                        set("chapterOrders", newArr.join(", "));
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-red-200 bg-white text-red-500 hover:bg-red-50"
                      title="Remove"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.certificateEligible}
            onChange={(e) => set("certificateEligible", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Issue milestone certificate on completion</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Active</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.title.trim()}
          className="btn-primary text-sm"
        >
          {saving ? "Saving…" : isEdit ? "Update Milestone" : "Add Milestone"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LearningPlanPage() {
  const dialog = useAppDialog();
  const params = useParams();
  const id = params.id as string;

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Plan-level toggles
  const [enabled, setEnabled] = useState(false);
  const [autoLock, setAutoLock] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState("");

  // Milestone list (sorted by order)
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Inline form state
  const [editingId, setEditingId] = useState<string | null>(null); // milestoneId or "new"
  const [form, setForm] = useState<MilestoneForm>(blankForm(0));
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const modules = course?.modules ?? [];

  // ── Load course ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<CourseInfo>(`/api/courses/${id}`);
    if (r.success && r.data) {
      const c = r.data;
      setCourse(c);
      const lp = c.learningPlan;
      setEnabled(!!(lp?.enabled));
      setAutoLock(!!(lp?.autoLockPreviousMilestones));
      const sorted = [...(lp?.milestones ?? [])].sort((a, b) => a.order - b.order);
      setMilestones(sorted);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Save plan-level settings ───────────────────────────────────────────────
  async function savePlanSettings() {
    setPlanSaving(true);
    setPlanError("");
    const r = await api(`/api/courses/${id}/learning-plan`, {
      method: "PUT",
      body: JSON.stringify({
        enabled,
        autoLockPreviousMilestones: autoLock,
        milestones: milestones.map((m) => ({
          milestoneId: m.milestoneId,
          title: m.title,
          description: m.description,
          order: m.order,
          feeInPaise: m.feeInPaise,
          unlockType: m.unlockType,
          completionRule: m.completionRule,
          unlockAfterDate: m.unlockAfterDate,
          unlockAfterDays: m.unlockAfterDays,
          paymentDueInDays: m.paymentDueInDays,
          certificateEligible: m.certificateEligible,
          active: m.active,
          chapterOrders: m.chapterOrders,
        })),
      }),
    });
    setPlanSaving(false);
    if (!r.success) {
      setPlanError(r.message ?? "Failed to save.");
    } else {
      await load();
    }
  }

  // ── Add new milestone ──────────────────────────────────────────────────────
  function startNew() {
    const nextOrder = milestones.length > 0 ? Math.max(...milestones.map((m) => m.order)) + 1 : 0;
    setForm(blankForm(nextOrder));
    setFormError("");
    setEditingId("new");
  }

  // ── Edit existing ──────────────────────────────────────────────────────────
  function startEdit(m: Milestone) {
    setForm(milestoneToForm(m));
    setFormError("");
    setEditingId(m.milestoneId);
  }

  function cancelForm() {
    setEditingId(null);
    setForm(blankForm(0));
    setFormError("");
  }

  // ── Save milestone (upsert) ────────────────────────────────────────────────
  async function saveMilestone() {
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    setFormSaving(true);
    setFormError("");
    const payload = formToPayload(form);
    const r = await api<Milestone>(`/api/courses/${id}/learning-plan/milestones`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setFormSaving(false);
    if (!r.success) {
      setFormError(r.message ?? "Failed to save milestone.");
    } else {
      cancelForm();
      await load();
    }
  }

  // ── Delete milestone ───────────────────────────────────────────────────────
  async function deleteMilestone(m: Milestone) {
    const ok = await dialog.confirm({
      title: "Delete Milestone",
      message: `Delete "${m.title}"? This cannot be undone if students have progress on it.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const r = await api(`/api/courses/${id}/learning-plan/milestones/${m.milestoneId}`, {
      method: "DELETE",
    });
    if (!r.success) {
      setPlanError(r.message ?? "Failed to delete milestone.");
    } else {
      await load();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <RequireRoles roles={[...STAFF_ROLES]} fallbackHref={`/courses/${id}`} />
        <EntityDetailLoadingScreen label="Loading learning plan…" />
      </>
    );
  }

  const isLearningPlan = course?.deliveryMode === COURSE_DELIVERY_MODE.LEARNING_PLAN || enabled;

  return (
    <>
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref={`/courses/${id}`} />

      <div className="flex h-full min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="shrink-0 space-y-3 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/courses/${id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Course
            </Link>
            <span className="text-slate-400">·</span>
            <span className="text-sm text-slate-500">{course?.title}</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
          {/* Card header */}
          <header className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Learning Plan</h1>
                  {isLearningPlan ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      Not enabled
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Configure milestone-based progressive access for this course. Students unlock each milestone step by step.
                </p>
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-8 space-y-8">

            {/* ── Plan settings ────────────────────────────────────────── */}
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">
                Plan Settings
              </h2>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-800">
                    <span className="font-semibold">Enable Learning Plan</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      When enabled, students must unlock milestones progressively instead of getting full course access on enrollment.
                    </span>
                  </span>
                </label>

                {enabled && (
                  <label className="flex cursor-pointer items-start gap-3 pl-7">
                    <input
                      type="checkbox"
                      checked={autoLock}
                      onChange={(e) => setAutoLock(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-800">
                      <span className="font-semibold">Auto-lock previous milestones</span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        Once a student unlocks a new milestone, previous milestone chapters become inaccessible. Defaults to off (students keep access to all unlocked milestones).
                      </span>
                    </span>
                  </label>
                )}

                {planError && (
                  <div className="alert--error">
                    {planError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={savePlanSettings}
                    disabled={planSaving}
                    className="btn-primary text-sm"
                  >
                    {planSaving ? "Saving…" : "Save Settings"}
                  </button>
                </div>
              </div>
            </section>

            {/* ── Milestones ────────────────────────────────────────────── */}
            {enabled && (
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Milestones ({milestones.length})
                  </h2>
                  {editingId !== "new" && (
                    <button
                      type="button"
                      onClick={startNew}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      + Add Milestone
                    </button>
                  )}
                </div>

                {/* New milestone form */}
                {editingId === "new" && (
                  <div className="mb-4">
                    <MilestoneFormPanel
                      form={form}
                      onChange={setForm}
                      onSave={saveMilestone}
                      onCancel={cancelForm}
                      saving={formSaving}
                      error={formError}
                      modules={modules}
                      isEdit={false}
                      assignedByOthers={new Set(milestones.flatMap((ms) => ms.chapterOrders))}
                    />
                  </div>
                )}

                {milestones.length === 0 && editingId !== "new" && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center">
                    <p className="text-sm text-slate-500">No milestones yet. Add the first one to get started.</p>
                    <button
                      type="button"
                      onClick={startNew}
                      className="btn-primary mt-3 text-sm"
                    >
                      Add First Milestone
                    </button>
                  </div>
                )}

                <ul className="space-y-3">
                  {milestones.map((m, idx) => (
                    <li key={m.milestoneId}>
                      {editingId === m.milestoneId ? (
                        <MilestoneFormPanel
                          form={form}
                          onChange={setForm}
                          onSave={saveMilestone}
                          onCancel={cancelForm}
                          saving={formSaving}
                          error={formError}
                          modules={modules}
                          isEdit={true}
                          assignedByOthers={new Set(milestones.filter((ms) => ms.milestoneId !== m.milestoneId).flatMap((ms) => ms.chapterOrders))}
                        />
                      ) : (
                        <MilestoneCard
                          milestone={m}
                          index={idx}
                          modules={modules}
                          onEdit={() => startEdit(m)}
                          onDelete={() => deleteMilestone(m)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Chapter assignment overview ──────────────────────────── */}
            {enabled && milestones.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
                  Chapter Assignment Overview
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left">Chapter</th>
                        <th className="px-4 py-3 text-left">Assigned Milestone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modules.map((m) => {
                        const assigned = milestones.find((ms) =>
                          ms.chapterOrders.includes(m.order)
                        );
                        return (
                          <tr key={m.order} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {m.order}: {m.title ?? `Chapter ${m.order}`}
                            </td>
                            <td className="px-4 py-2.5">
                              {assigned ? (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  {assigned.title}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Unassigned (freely accessible)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Delivery mode info ───────────────────────────────────── */}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  index,
  modules,
  onEdit,
  onDelete,
}: {
  milestone: Milestone;
  index: number;
  modules: { order: number; title?: string }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const feeRupees = milestone.feeInPaise / 100;
  const assignedModules = modules.filter((m) => milestone.chapterOrders.includes(m.order));

  return (
    <div className={`rounded-xl border ${milestone.active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60"} overflow-hidden`}>
      {/* Row */}
      <div className="flex items-start gap-4 px-4 py-4">
        {/* Order badge */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
          {index + 1}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{milestone.title}</span>
            {!milestone.active && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">Inactive</span>
            )}
            {milestone.certificateEligible && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">🏅 Certificate</span>
            )}
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              {UNLOCK_TYPE_LABELS[milestone.unlockType] ?? milestone.unlockType}
            </span>
            {feeRupees > 0 && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                ₹{feeRupees.toLocaleString("en-IN")}
              </span>
            )}
          </div>
          {milestone.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{milestone.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{milestone.chapterOrders.length} chapter{milestone.chapterOrders.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{COMPLETION_RULE_LABELS[milestone.completionRule] ?? milestone.completionRule}</span>
            {milestone.paymentDueInDays && (
              <>
                <span>·</span>
                <span>Due in {milestone.paymentDueInDays}d</span>
              </>
            )}
            {milestone.unlockAfterDays && (
              <>
                <span>·</span>
                <span>Unlocks after {milestone.unlockAfterDays}d</span>
              </>
            )}
          </div>
          {assignedModules.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {assignedModules.map((m) => (
                <span key={m.order} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                  {m.order}: {m.title ?? `Ch ${m.order}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
            title="Edit milestone"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition"
            title="Delete milestone"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
