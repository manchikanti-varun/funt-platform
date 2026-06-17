"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { sanitizeHtml, RICH_TEXT_VIEW_CLASS } from "@/lib/sanitizeHtml";
import { COURSE_STATUS } from "@funt-platform/constants";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { courseCardImagePreviewSrc } from "@/lib/courseCardImage";
import { KeyRound, Copy, Download, X } from "lucide-react";
import {
  EntityActionsPanel,
  EntityDetailLoadingScreen,
  EntityDetailSection,
  EntityDetailShell,
} from "@/components/ui";

interface CourseModule {
  title: string;
  order: number;
  originalGlobalModuleId?: string;
  xpReward?: number;
}

interface Course {
  id: string;
  courseId?: string;
  title: string;
  description: string;
  durationText?: string;
  headerImageUrl?: string;
  deliveryMode?: string;
  learningPlan?: {
    enabled: boolean;
    autoLockPreviousMilestones: boolean;
    milestones: Array<{
      milestoneId: string;
      title: string;
      order: number;
      feeInPaise: number;
      unlockType: string;
      completionRule: string;
      chapterOrders: number[];
      certificateEligible: boolean;
      active: boolean;
    }>;
  };
  modules: CourseModule[];
  version: number;
  status: string;
}

export default function ViewCoursePage() {
  const params = useParams();
  const id = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  // Milestone license key generation state
  const [generatingMilestoneId, setGeneratingMilestoneId] = useState<string | null>(null);
  const [milestoneKeyCount, setMilestoneKeyCount] = useState(1);
  const [milestoneKeys, setMilestoneKeys] = useState<{ milestoneId: string; keys: string[] } | null>(null);
  const [milestoneKeyError, setMilestoneKeyError] = useState("");
  const [milestoneKeyLoading, setMilestoneKeyLoading] = useState(false);
  const [copiedKeyIndex, setCopiedKeyIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Course>(`/api/courses/${id}`).then((r) => {
      if (r.success && r.data) setCourse(r.data);
    });
  }, [id]);

  async function generateMilestoneKey(milestoneId: string) {
    if (!course) return;
    setMilestoneKeyError("");
    setMilestoneKeyLoading(true);
    setMilestoneKeys(null);
    setCopiedKeyIndex(null);
    setCopiedAll(false);

    const count = Math.min(100, Math.max(1, milestoneKeyCount));
    // Need batchId — find any batch that uses this course
    const batchRes = await api<Array<{ id: string; name: string; courseSnapshots?: Array<{ courseId?: string }> }>>("/api/batches");
    const batches = batchRes.success && Array.isArray(batchRes.data) ? batchRes.data : [];
    const courseCanonicalId = course.courseId ?? id;
    const matchedBatch = batches.find((b) =>
      (b.courseSnapshots ?? []).some((s) => s.courseId === courseCanonicalId)
    );

    if (!matchedBatch) {
      setMilestoneKeyError("No batch includes this course. Create a batch with this course first.");
      setMilestoneKeyLoading(false);
      return;
    }

    const res = await api<{ keys: string[] }>(`/api/admin/milestones/${milestoneId}/generate-key`, {
      method: "POST",
      body: JSON.stringify({ courseId: courseCanonicalId, batchId: matchedBatch.id, count }),
    });

    setMilestoneKeyLoading(false);
    if (res.success && res.data?.keys?.length) {
      setMilestoneKeys({ milestoneId, keys: res.data.keys });
    } else {
      setMilestoneKeyError(res.message ?? "Failed to generate license key.");
    }
  }

  function copyKey(key: string, index: number) {
    void navigator.clipboard.writeText(key);
    setCopiedKeyIndex(index);
    setTimeout(() => setCopiedKeyIndex((i) => (i === index ? null : i)), 2000);
  }

  function copyAllMilestoneKeys() {
    if (!milestoneKeys) return;
    void navigator.clipboard.writeText(milestoneKeys.keys.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  function downloadMilestoneKeys() {
    if (!milestoneKeys) return;
    const blob = new Blob([milestoneKeys.keys.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milestone-license-keys-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!course) {
    return <EntityDetailLoadingScreen label="Loading course…" />;
  }

  const sortedModules = [...(course.modules ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sanitizedDescription = sanitizeHtml(course.description ?? "");
  const cardImageSrc = courseCardImagePreviewSrc(course.headerImageUrl);

  return (
    <EntityDetailShell
      backHref="/courses"
      backLabel="Back to Courses"
      title={course.title}
      description="View only. License keys and cohort access are managed from each batch."
      mode="view"
      viewHref={`/courses/${id}/view`}
      editHref={`/courses/${id}`}
      badges={
        <>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            v{course.version}
          </span>
          {course.deliveryMode === "LEARNING_PLAN" && (
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              Learning Plan
            </span>
          )}
          <span
            className={
              course.status === COURSE_STATUS.ARCHIVED
                ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
            }
          >
            {course.status === COURSE_STATUS.ARCHIVED ? "Archived" : "Active"}
          </span>
        </>
      }
    >
      <EntityActionsPanel>
        <Link href={`/courses/${id}/duplicate`} className="btn-duplicate">
          <DuplicateIcon />
          Duplicate
        </Link>
      </EntityActionsPanel>

      {cardImageSrc ? (
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-200 via-slate-100 to-indigo-100">
          <div className="relative h-32 w-full">
            <img src={cardImageSrc} alt={`${course.title} card`} className="h-full w-full object-cover" />
          </div>
        </div>
      ) : null}
      <EntityDetailSection title="Description">
        <div
          className={`text-slate-700 ${RICH_TEXT_VIEW_CLASS}`}
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      </EntityDetailSection>
      <EntityDetailSection title="Duration">
        <p className="text-sm font-medium text-slate-800">{(course.durationText ?? "").trim() || "Not set"}</p>
      </EntityDetailSection>
      <EntityDetailSection title={`Chapters (${sortedModules.length})`}>
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
          {sortedModules.map((m, i) => (
            <li key={i}>
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-800">
                <span className="w-6 font-medium text-slate-500">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  {Math.max(0, Math.floor(Number(m.xpReward ?? 40)))} XP
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  Snapshot
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          These are course snapshots. Switch to Edit to change chapter copies for this course, not Global Chapters.
        </p>
      </EntityDetailSection>

      {/* Learning Plan milestones */}
      {course.deliveryMode === "LEARNING_PLAN" && course.learningPlan?.enabled && (
        <EntityDetailSection title={`Learning Plan — Milestones (${course.learningPlan.milestones.filter((m) => m.active).length})`}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-800">
                Total: ₹{(course.learningPlan.milestones.filter((m) => m.active).reduce((s, m) => s + m.feeInPaise, 0) / 100).toLocaleString("en-IN")}
              </span>
              {course.learningPlan.autoLockPreviousMilestones && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Auto-lock previous</span>
              )}
            </div>
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
              {[...course.learningPlan.milestones].filter((m) => m.active).sort((a, b) => a.order - b.order).map((m, i) => (
                <li key={m.milestoneId} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {m.chapterOrders.length} chapter{m.chapterOrders.length !== 1 ? "s" : ""} · {m.unlockType.replace(/_/g, " ").toLowerCase()} · {m.completionRule.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {m.feeInPaise > 0 ? `₹${(m.feeInPaise / 100).toLocaleString("en-IN")}` : "Free"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (generatingMilestoneId === m.milestoneId) {
                          setGeneratingMilestoneId(null);
                          setMilestoneKeys(null);
                          setMilestoneKeyError("");
                        } else {
                          setGeneratingMilestoneId(m.milestoneId);
                          setMilestoneKeys(null);
                          setMilestoneKeyError("");
                          setMilestoneKeyCount(1);
                        }
                      }}
                      title="Generate license key"
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                        generatingMilestoneId === m.milestoneId
                          ? "border-violet-400 bg-violet-100 text-violet-800"
                          : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                      }`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      License Key
                    </button>
                    {m.certificateEligible && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Cert</span>
                    )}
                  </div>
                  {/* License Key Generation Panel */}
                  {generatingMilestoneId === m.milestoneId && (
                    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-800">Generate Milestone License Key</h4>
                        <button
                          type="button"
                          onClick={() => { setGeneratingMilestoneId(null); setMilestoneKeys(null); setMilestoneKeyError(""); }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Key bypasses payment/progression and directly unlocks this milestone for the student who redeems it.
                      </p>
                      {!milestoneKeys && (
                        <div className="mt-3 flex items-end gap-3">
                          <label className="block text-sm">
                            <span className="text-xs font-medium text-slate-600">Quantity</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={milestoneKeyCount}
                              onChange={(e) => setMilestoneKeyCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                              className="mt-1 block w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => generateMilestoneKey(m.milestoneId)}
                            disabled={milestoneKeyLoading}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {milestoneKeyLoading ? "Generating…" : "Generate"}
                          </button>
                        </div>
                      )}
                      {milestoneKeyError && (
                        <p className="mt-2 text-sm font-medium text-red-700">{milestoneKeyError}</p>
                      )}
                      {milestoneKeys && milestoneKeys.milestoneId === m.milestoneId && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-medium text-slate-700">
                            {milestoneKeys.keys.length} key{milestoneKeys.keys.length !== 1 ? "s" : ""} generated
                          </p>
                          <ul className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                            {milestoneKeys.keys.map((key, ki) => (
                              <li key={key} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
                                <code className="min-w-0 flex-1 break-all font-mono text-xs font-medium text-slate-900">{key}</code>
                                <button
                                  type="button"
                                  onClick={() => copyKey(key, ki)}
                                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                >
                                  <Copy className="h-3 w-3" />
                                  {copiedKeyIndex === ki ? "Copied" : "Copy"}
                                </button>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={copyAllMilestoneKeys}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {copiedAll ? "Copied" : "Copy all"}
                            </button>
                            <button
                              type="button"
                              onClick={downloadMilestoneKeys}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3">
            <Link
              href={`/courses/${id}/learning-plan`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition"
            >
              Edit Learning Plan
            </Link>
          </div>
        </EntityDetailSection>
      )}
    </EntityDetailShell>
  );
}
