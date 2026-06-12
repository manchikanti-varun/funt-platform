"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { COURSE_STATUS, SUBMISSION_TYPE, SKILL_TAG } from "@funt-platform/constants";
import { decodeEncodedRichText } from "@/lib/sanitizeHtml";

import { RichTextEditor } from "@/components/RichTextEditor";
import { useAppDialog, EntityDetailLoadingScreen, EntityDetailShell } from "@/components/ui";
import { VideoUploadField } from "@/components/videos/VideoUploadField";
import { makeUploadVideoFn } from "@/lib/uploadVideoToR2";

interface CourseModule {
  originalGlobalModuleId: string;
  title: string;
  description?: string;
  content?: string;
  youtubeUrl?: string;
  videoUrl?: string;
    resourceLinkUrl?: string;
  linkedAssignmentId?: string;
    linkedAssignmentTitleOverride?: string;
    linkedAssignmentInstructionsOverride?: string;
    linkedAssignmentSubmissionTypeOverride?: string;
    linkedAssignmentSkillTagsOverride?: string[];
  xpReward?: number;
  order: number;
}

interface Course {
  id: string;
  /** Human-readable course id when set (matches batch snapshots) */
  courseId?: string;
  title: string;
  description: string;
  durationText?: string;
  headerImageUrl?: string;
  isDemo?: boolean;
  ageGroup?: string;
  certification?: string;
  paymentNote?: string;
  learningOutcomes?: string[];
  overview?: string;
  pricingTiers?: { label: string; price: string; note?: string }[];
  modules: CourseModule[];
  version: number;
  status: string;
  /** null = inherit global setting, true/false = override */
  enableWatermark?: boolean | null;
}

import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { CourseCardImageField } from "@/components/courses/CourseCardImageField";

export default function EditCoursePage() {
  const dialog = useAppDialog();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationText, setDurationText] = useState("");
  const [headerImageDraft, setHeaderImageDraft] = useState("");
  const [headerImageDirty, setHeaderImageDirty] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [ageGroup, setAgeGroup] = useState("");
  const [certification, setCertification] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [learningOutcomes, setLearningOutcomes] = useState("");
  const [overview, setOverview] = useState("");
  const [pricingTiers, setPricingTiers] = useState<{ label: string; price: string; note: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [moduleEdit, setModuleEdit] = useState<Partial<CourseModule>>({});
  const [savingModule, setSavingModule] = useState(false);
  const [globalAssignmentPreview, setGlobalAssignmentPreview] = useState<{ title: string; instructions: string; submissionType?: string; skillTags?: string[] } | null>(null);
  /** null = inherit global, true = force on, false = force off */
  const [enableWatermark, setEnableWatermark] = useState<boolean | null | "inherit">("inherit");

  const roleGuard = <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/courses" />;

  useEffect(() => {
    if (!id) return;
    api<Course>(`/api/courses/${id}`).then((r) => {
      if (r.success && r.data) {
        setCourse(r.data);
        setTitle(r.data.title);
        setDescription(decodeEncodedRichText(r.data.description ?? ""));
        setDurationText((r.data.durationText ?? "").trim());
        setHeaderImageDraft((r.data.headerImageUrl ?? "").trim());
        setHeaderImageDirty(false);
        setIsDemo(!!r.data.isDemo);
        setAgeGroup((r.data.ageGroup ?? "").trim());
        setCertification((r.data.certification ?? "").trim());
        setPaymentNote((r.data.paymentNote ?? "").trim());
        setLearningOutcomes((r.data.learningOutcomes ?? []).join("\n"));
        setOverview(decodeEncodedRichText(r.data.overview ?? ""));
        setPricingTiers((r.data.pricingTiers ?? []).map((t) => ({ label: t.label, price: t.price, note: t.note ?? "" })));
        const wm = r.data.enableWatermark;
        setEnableWatermark(wm === true ? true : wm === false ? false : "inherit");
      }
    });
  }, [id]);

  // When editing a module with a linked assignment, fetch global assignment so we can show it when overrides are empty
  const linkedId = moduleEdit.linkedAssignmentId?.trim();
  useEffect(() => {
    if (!linkedId || editingIndex === null) {
      setGlobalAssignmentPreview(null);
      return;
    }
    let cancelled = false;
    api<{ title: string; instructions?: string; submissionType?: string; skillTags?: string[] }>(`/api/global-assignments/${linkedId}`)
      .then((r) => {
        if (cancelled || !r.success || !r.data) return;
        setGlobalAssignmentPreview({
          title: r.data.title ?? "",
          instructions: r.data.instructions ?? "",
          submissionType: r.data.submissionType,
          skillTags: Array.isArray(r.data.skillTags) ? r.data.skillTags : undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setGlobalAssignmentPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedId, editingIndex]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const imageValue = (headerImageDirty ? headerImageDraft : (course?.headerImageUrl ?? "")).trim();
    if (!imageValue) {
      setError("Course card image is required.");
      return;
    }
    setError("");
    setLoading(true);
    const body: Record<string, unknown> = {
      title,
      description: decodeEncodedRichText(description),
      durationText: durationText.trim(),
      isDemo,
      headerImageUrl: imageValue,
      ageGroup: ageGroup.trim(),
      certification: certification.trim(),
      paymentNote: paymentNote.trim(),
      learningOutcomes: learningOutcomes.split("\n").map((l) => l.trim()).filter(Boolean),
      overview: overview.trim(),
      pricingTiers: pricingTiers.filter((t) => t.label.trim() && t.price.trim()),
      enableWatermark: enableWatermark === "inherit" ? null : enableWatermark,
    };
    const res = await api(`/api/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.success) router.push("/courses");
    else setError(res.message ?? "Failed to update.");
  }

  function startEditModule(m: CourseModule, index: number) {
    setModuleEdit({
      title: m.title,
      description: m.description ?? "",
      content: m.content ?? "",
      xpReward: m.xpReward ?? 40,
      youtubeUrl: m.youtubeUrl ?? "",
      videoUrl: m.videoUrl ?? "",
      resourceLinkUrl: m.resourceLinkUrl ?? "",
      linkedAssignmentId: m.linkedAssignmentId ?? "",
      linkedAssignmentTitleOverride: m.linkedAssignmentTitleOverride ?? "",
      linkedAssignmentInstructionsOverride: m.linkedAssignmentInstructionsOverride ?? "",
      linkedAssignmentSubmissionTypeOverride: m.linkedAssignmentSubmissionTypeOverride ?? "",
      linkedAssignmentSkillTagsOverride: Array.isArray(m.linkedAssignmentSkillTagsOverride) ? m.linkedAssignmentSkillTagsOverride : undefined,
    });
    setEditingIndex(index);
  }

  function cancelEditModule() {
    setEditingIndex(null);
    setModuleEdit({});
    setGlobalAssignmentPreview(null);
  }

  async function saveModuleSnapshot() {
    if (editingIndex == null || course == null) return;
    setSavingModule(true);
    setError("");
    try {
      const res = await api<Course>(`/api/courses/${id}/chapters/${editingIndex}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: moduleEdit.title,
          description: moduleEdit.description,
          content: decodeEncodedRichText(moduleEdit.content),
          youtubeUrl: moduleEdit.youtubeUrl || undefined,
          videoUrl: moduleEdit.videoUrl || undefined,
          resourceLinkUrl: moduleEdit.resourceLinkUrl || undefined,
          linkedAssignmentId: moduleEdit.linkedAssignmentId || undefined,
          linkedAssignmentTitleOverride: moduleEdit.linkedAssignmentTitleOverride || undefined,
          linkedAssignmentInstructionsOverride: decodeEncodedRichText(moduleEdit.linkedAssignmentInstructionsOverride) || undefined,
          linkedAssignmentSubmissionTypeOverride: moduleEdit.linkedAssignmentSubmissionTypeOverride || undefined,
          linkedAssignmentSkillTagsOverride: Array.isArray(moduleEdit.linkedAssignmentSkillTagsOverride) ? moduleEdit.linkedAssignmentSkillTagsOverride : undefined,
          xpReward: moduleEdit.xpReward != null ? Math.floor(Number(moduleEdit.xpReward)) : undefined,
        }),
      });
      if (res.success && res.data) {
        setCourse(res.data);
        cancelEditModule();
      } else {
        setError(res.message ?? "Failed to update chapter.");
      }
    } catch {
      setError("Failed to update chapter.");
    } finally {
      setSavingModule(false);
    }
  }

  async function reorder(clickedIndex: number, direction: "up" | "down") {
    if (!course?.modules?.length) return;
    const sorted = [...course.modules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (direction === "up" && clickedIndex > 0) {
      const indices = sorted.map((_, i) => i);
      [indices[clickedIndex - 1], indices[clickedIndex]] = [indices[clickedIndex], indices[clickedIndex - 1]];
      const res = await api(`/api/courses/${id}/reorder-chapters`, { method: "PATCH", body: JSON.stringify({ orderedModuleIndices: indices }) });
      if (res.success && res.data) setCourse(res.data as Course);
    }
    if (direction === "down" && clickedIndex < sorted.length - 1) {
      const indices = sorted.map((_, i) => i);
      [indices[clickedIndex], indices[clickedIndex + 1]] = [indices[clickedIndex + 1], indices[clickedIndex]];
      const res = await api(`/api/courses/${id}/reorder-chapters`, { method: "PATCH", body: JSON.stringify({ orderedModuleIndices: indices }) });
      if (res.success && res.data) setCourse(res.data as Course);
    }
  }

  async function archive() {
    const ok = await dialog.confirm({
      title: "Archive course",
      message: "Archive this course? It will no longer be available for new batches.",
      confirmLabel: "Archive",
    });
    if (!ok) return;
    const res = await api(`/api/courses/${id}/archive`, { method: "PATCH" });
    if (res.success) router.push("/courses");
    else setError(res.message ?? "Failed to archive.");
  }

  async function unarchive() {
    const ok = await dialog.confirm({
      title: "Unarchive course",
      message: "Unarchive this course?",
      confirmLabel: "Unarchive",
    });
    if (!ok) return;
    const res = await api<Course>(`/api/courses/${id}/unarchive`, { method: "PATCH" });
    if (res.success && res.data) setCourse(res.data as Course);
    else if (!res.success) setError(res.message ?? "Failed to unarchive.");
  }

  async function toggleLaunchingSoon() {
    const isCurrentlyLaunching = course?.status === COURSE_STATUS.LAUNCHING_SOON;
    const action = isCurrentlyLaunching ? "unarchive" : "set-launching-soon";
    const ok = await dialog.confirm({
      title: isCurrentlyLaunching ? "Make course active" : "Mark as Launching Soon",
      message: isCurrentlyLaunching
        ? "Move this course back to Active status?"
        : "Mark this course as 'Launching Soon'? It will appear on the upcoming courses page but won't be available for enrollment.",
      confirmLabel: isCurrentlyLaunching ? "Make Active" : "Set Launching Soon",
    });
    if (!ok) return;
    const res = await api<Course>(`/api/courses/${id}/${action}`, { method: "PATCH" });
    if (res.success && res.data) setCourse(res.data as Course);
    else if (!res.success) setError(res.message ?? "Failed to update status.");
  }

  if (!course) {
    return (
      <>
        {roleGuard}
        <EntityDetailLoadingScreen label="Loading course…" />
      </>
    );
  }

  const sortedModules = [...(course.modules ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <>
      {roleGuard}
      <EntityDetailShell
        backHref="/courses"
        backLabel="Back to Courses"
        title={title}
        description="Update title, description, reorder chapters, or edit a chapter copy for this course only."
        mode="edit"
        viewHref={`/courses/${id}/view`}
        editHref={`/courses/${id}`}
        badges={
          <>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">v{course.version}</span>
            <span
              className={
                course.status === COURSE_STATUS.ARCHIVED
                  ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
              }
            >
              {course.status === COURSE_STATUS.ARCHIVED ? "Archived" : course.status === COURSE_STATUS.LAUNCHING_SOON ? "Launching Soon" : "Active"}
            </span>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Snapshot context</span>
          </>
        }
        headerAside={
          <>
            {course.status !== COURSE_STATUS.ARCHIVED && course.status !== COURSE_STATUS.LAUNCHING_SOON && (
              <button
                type="button"
                onClick={toggleLaunchingSoon}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                Mark Launching Soon
              </button>
            )}
            {course.status === COURSE_STATUS.LAUNCHING_SOON && (
              <button
                type="button"
                onClick={toggleLaunchingSoon}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Make Active
              </button>
            )}
            {course.status !== COURSE_STATUS.ARCHIVED ? (
              <button
                type="button"
                onClick={archive}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Archive
              </button>
            ) : (
              <button
                type="button"
                onClick={unarchive}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Unarchive
              </button>
            )}
            <Link href={`/courses/${id}/duplicate`} className="btn-duplicate">
              <DuplicateIcon />
              Duplicate
            </Link>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
            <RichTextEditor value={description} onChange={setDescription} minHeight={200} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Duration</label>
            <input
              value={durationText}
              onChange={(e) => setDurationText(e.target.value)}
              className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="e.g. 45 days, 3 months, 12 weeks"
            />
            <p className="mt-1 text-xs text-slate-500">Used in certificates for this course.</p>
          </div>
          <CourseCardImageField
            value={headerImageDirty ? headerImageDraft : (course?.headerImageUrl ?? "").trim()}
            onChange={(v) => {
              setHeaderImageDraft(v);
              setHeaderImageDirty(true);
            }}
            onError={setError}
          />
          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-800">
                <span className="font-semibold">Demo course</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-600">
                  Free for all students once added to a batch (₹0, auto-enrolled, no invoice). Not visible until it is in a batch.
                </span>
              </span>
            </label>
          </div>
          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-indigo-700">Marketing & Catalog Details</h3>
            <p className="mb-4 text-sm text-slate-600">These fields appear on the explore/catalog pages and the marketing website.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Age Group</label>
                <input value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input" placeholder="e.g. Age 10+" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Certification</label>
                <input value={certification} onChange={(e) => setCertification(e.target.value)} className="input" placeholder="e.g. Certification upon completion" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">Payment Note</label>
                <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="input" placeholder="e.g. EMI available" />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">What You Learn (one per line)</label>
              <textarea value={learningOutcomes} onChange={(e) => setLearningOutcomes(e.target.value)} rows={5} className="input" placeholder={"Strong foundation in Electronics\nUnderstanding Sensors and Actuators\nCircuit Building and Prototyping Skills"} />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Course Overview (detailed description)</label>
              <RichTextEditor value={overview} onChange={setOverview} minHeight={160} />
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Pricing Tiers</label>
              {pricingTiers.map((tier, idx) => (
                <div key={idx} className="mb-2 flex items-start gap-2">
                  <input value={tier.label} onChange={(e) => { const t = [...pricingTiers]; t[idx] = { ...t[idx], label: e.target.value }; setPricingTiers(t); }} className="input flex-1" placeholder="Tier name (e.g. Get kit + 32 hours)" />
                  <input value={tier.price} onChange={(e) => { const t = [...pricingTiers]; t[idx] = { ...t[idx], price: e.target.value }; setPricingTiers(t); }} className="input w-32" placeholder="INR 7,000" />
                  <input value={tier.note} onChange={(e) => { const t = [...pricingTiers]; t[idx] = { ...t[idx], note: e.target.value }; setPricingTiers(t); }} className="input flex-1" placeholder="Note (optional)" />
                  <button type="button" onClick={() => setPricingTiers(pricingTiers.filter((_, i) => i !== idx))} className="mt-2 text-sm text-red-600 hover:text-red-800">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setPricingTiers([...pricingTiers, { label: "", price: "", note: "" }])} className="text-sm font-medium text-teal-700 hover:text-teal-900">+ Add pricing tier</button>
            </div>
          </div>
          {/* ── Security settings ── */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-700">Security</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="mb-3 text-xs text-slate-500">
                Watermark setting for this course. Choose <strong>Inherit</strong> to follow the global config, or override for this course only.
              </p>
              <div className="flex flex-wrap gap-3">
                {(["inherit", true, false] as const).map((val) => (
                  <label key={String(val)} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${enableWatermark === val ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                    <input
                      type="radio"
                      name="enableWatermark"
                      value={String(val)}
                      checked={enableWatermark === val}
                      onChange={() => setEnableWatermark(val)}
                      className="sr-only"
                    />
                    {val === "inherit" ? "Inherit global setting" : val === true ? "Watermark ON (override)" : "Watermark OFF (override)"}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Chapters in this course</h3>
            <p className="mt-1 text-sm text-slate-600">These are copies of global chapters for this course. You can edit the chapter copy (title, content, video, etc.) here, or reorder with Up/Down.</p>
            <ul className="mt-3 space-y-2">
              {sortedModules.map((m, i) => (
                <li key={m.originalGlobalModuleId} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 shrink-0 text-sm font-medium text-slate-500">{i + 1}.</span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 truncate">{m.title}</span>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                      {Math.max(0, Math.floor(Number(m.xpReward ?? 40)))} XP
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditModule(m, i)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-300 bg-teal-50 text-teal-700 transition hover:bg-teal-100"
                        title="Edit chapter"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => reorder(i, "up")}
                        disabled={i === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Move up"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => reorder(i, "down")}
                        disabled={i === sortedModules.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Move down"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {editingIndex === i && (
                    <div className="border-t border-slate-200 bg-white p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-slate-800">Edit chapter for this course</h4>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
                        <input
                          value={moduleEdit.title ?? ""}
                          onChange={(e) => setModuleEdit((p) => ({ ...p, title: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">XP on chapter completion</label>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          step={1}
                          value={moduleEdit.xpReward ?? 40}
                          onChange={(e) => setModuleEdit((p) => ({ ...p, xpReward: Math.floor(Number(e.target.value)) || 0 }))}
                          className="w-full max-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-slate-500">Awarded when the learner finishes this chapter in a batch. New batches copy values from this course snapshot.</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                        <input
                          value={moduleEdit.description ?? ""}
                          onChange={(e) => setModuleEdit((p) => ({ ...p, description: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Content (rich text)</label>
                        <RichTextEditor
                          value={moduleEdit.content ?? ""}
                          onChange={(v) => setModuleEdit((p) => ({ ...p, content: v }))}
                          minHeight={120}
                          uploadVideo={makeUploadVideoFn({
                            courseId: course.courseId ?? id,
                            moduleId: sortedModules[editingIndex ?? 0]?.originalGlobalModuleId ?? String(editingIndex ?? 0),
                          })}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">YouTube URL</label>
                          <input
                            value={moduleEdit.youtubeUrl ?? ""}
                            onChange={(e) => setModuleEdit((p) => ({ ...p, youtubeUrl: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          {/* ── R2 Video Upload ── */}
                          <VideoUploadField
                            courseId={course.courseId ?? id}
                            moduleId={course.modules[editingIndex]?.originalGlobalModuleId ?? String(editingIndex)}
                            lessonId={course.modules[editingIndex]?.originalGlobalModuleId ?? String(editingIndex)}
                            value={moduleEdit.videoUrl ?? ""}
                            onChange={(key) => setModuleEdit((p) => ({ ...p, videoUrl: key }))}
                            onError={setError}
                            label="Chapter Video (upload MP4)"
                            disabled={savingModule}
                          />
                          {/* Allow pasting a legacy external URL when no R2 video is set */}
                          {!(moduleEdit.videoUrl ?? "").startsWith("r2://") && (
                            <input
                              value={moduleEdit.videoUrl ?? ""}
                              onChange={(e) => setModuleEdit((p) => ({ ...p, videoUrl: e.target.value }))}
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                              placeholder="Or paste an external video URL (e.g. Vimeo)"
                            />
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">Resource link (optional)</label>
                          <input
                            value={moduleEdit.resourceLinkUrl ?? ""}
                            onChange={(e) => setModuleEdit((p) => ({ ...p, resourceLinkUrl: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="e.g. Google Drive, slides, docs, or any other URL"
                          />
                          <p className="mt-1 text-xs text-slate-500">Share Drive folders, slides, or other resources. Students see this as a link in the chapter.</p>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Linked assignment ID (optional)</label>
                        <input
                          value={moduleEdit.linkedAssignmentId ?? ""}
                          onChange={(e) => setModuleEdit((p) => ({ ...p, linkedAssignmentId: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Global assignment ID"
                        />
                      </div>
                      <div className="border-t border-slate-200 pt-4">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Assignment in this course</h5>
                        <p className="mb-3 text-xs text-slate-500">Edit below; content is pre-filled from the global assignment so you can make small changes and save. Changes here do not modify the global assignment.</p>
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Assignment title</label>
                            <input
                              value={
                                (moduleEdit.linkedAssignmentTitleOverride ?? "").trim() !== ""
                                  ? (moduleEdit.linkedAssignmentTitleOverride ?? "")
                                  : (globalAssignmentPreview?.title ?? "")
                              }
                              onChange={(e) => setModuleEdit((p) => ({ ...p, linkedAssignmentTitleOverride: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Filled from global when linked"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Assignment instructions</label>
                            <RichTextEditor
                              value={
                                (moduleEdit.linkedAssignmentInstructionsOverride ?? "").trim() !== ""
                                  ? (moduleEdit.linkedAssignmentInstructionsOverride ?? "")
                                  : (globalAssignmentPreview?.instructions ?? "")
                              }
                              onChange={(v) => setModuleEdit((p) => ({ ...p, linkedAssignmentInstructionsOverride: v }))}
                              minHeight={100}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Submission type</label>
                            <select
                              value={
                                (moduleEdit.linkedAssignmentSubmissionTypeOverride ?? "").trim() !== ""
                                  ? (moduleEdit.linkedAssignmentSubmissionTypeOverride ?? "")
                                  : (globalAssignmentPreview?.submissionType ?? "")
                              }
                              onChange={(e) => setModuleEdit((p) => ({ ...p, linkedAssignmentSubmissionTypeOverride: e.target.value || undefined }))}
                              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="">Use global</option>
                              {Object.values(SUBMISSION_TYPE).map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Skill tags</label>
                            <div className="flex flex-wrap gap-2">
                              {(Object.values(SKILL_TAG) as string[]).map((tag) => {
                                const effectiveTags = (moduleEdit.linkedAssignmentSkillTagsOverride ?? []).length > 0
                                  ? (moduleEdit.linkedAssignmentSkillTagsOverride ?? [])
                                  : (globalAssignmentPreview?.skillTags ?? []);
                                const checked = effectiveTags.includes(tag);
                                return (
                                  <label key={tag} className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const next = checked
                                          ? effectiveTags.filter((t) => t !== tag)
                                          : [...effectiveTags, tag];
                                        setModuleEdit((p) => ({ ...p, linkedAssignmentSkillTagsOverride: next }));
                                      }}
                                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span className="text-slate-700">{tag}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">Leave all unchecked to use global assignment’s skill tags.</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveModuleSnapshot}
                          disabled={savingModule}
                          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                        >
                          {savingModule ? "Saving…" : "Save chapter"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditModule}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </EntityDetailShell>
    </>
  );
}
