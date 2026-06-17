"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAutoSavedForm } from "@/lib/useAutoSavedForm";
import { SUBMISSION_TYPE } from "@funt-platform/constants";

import { RichTextEditor } from "@/components/RichTextEditor";
import { BackLink } from "@/components/ui/BackLink";
import { DraftRestoredBanner } from "@/components/ui/DraftRestoredBanner";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { SkillTagsField } from "@/components/admin/SkillTagsField";
import { ModeratorCheckboxes } from "@/components/admin/StaffPickerFields";

const SUBMISSION_TYPES = [SUBMISSION_TYPE.FILE, SUBMISSION_TYPE.TEXT, SUBMISSION_TYPE.LINK];

interface AssignmentDraft {
  title: string;
  instructions: string;
  submissionType: SUBMISSION_TYPE;
  skillTags: string[];
  type: "general" | "chapter";
  moderatorIds: string[];
}

const INITIAL_DRAFT: AssignmentDraft = {
  title: "",
  instructions: "",
  submissionType: SUBMISSION_TYPE.TEXT,
  skillTags: [],
  type: "chapter",
  moderatorIds: [],
};

export default function NewGlobalAssignmentPage() {
  const router = useRouter();
  const {
    value: form,
    setValue: setForm,
    hasRestoredDraft,
    draftSavedAt,
    discardDraft,
    clearDraft,
  } = useAutoSavedForm<AssignmentDraft>("global-assignments:new", INITIAL_DRAFT);
  const { title, instructions, submissionType, skillTags, type, moderatorIds } = form;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof AssignmentDraft>(field: K, value: AssignmentDraft[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const typeRef = useRef<"general" | "chapter">(type);
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const instructionsPlain = instructions?.replace(/<[^>]+>/g, "").trim() ?? "";
    if (!instructionsPlain) {
      setError("Instructions are required.");
      return;
    }
    if (skillTags.length === 0) {
      setError("Select at least one skill tag (or add a custom tag).");
      return;
    }
    setError("");
    setLoading(true);
    const assignmentType = typeRef.current;
    const res = await api<{ id: string }>("/api/global-assignments", {
      method: "POST",
      body: JSON.stringify({ title, instructions, submissionType, skillTags, type: assignmentType, moderatorIds }),
    });
    setLoading(false);
    if (res.success && res.data?.id) {
      clearDraft();
      router.push("/global-assignments");
      return;
    }
    setError(res.message ?? "Failed to create assignment.");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/global-assignments" />
      <div className="shrink-0 pb-4">
        <BackLink href="/global-assignments">Back to Assignments</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Global Assignment</h1>
          <p className="mt-1 text-sm text-slate-600">Create a new assignment template for courses and batches.</p>
        </div>

        <form onSubmit={submit} className="p-6 sm:p-8">
          <div className="w-full space-y-6">
            {hasRestoredDraft && draftSavedAt !== null && (
              <DraftRestoredBanner savedAt={draftSavedAt} onDiscard={discardDraft} />
            )}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type</label>
              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="type" checked={type === "chapter"} onChange={() => update("type", "chapter")} className="text-indigo-600" />
                  <span className="text-sm text-slate-700">Chapter</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="type" checked={type === "general"} onChange={() => update("type", "general")} className="text-indigo-600" />
                  <span className="text-sm text-slate-700">General</span>
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-500">Chapter = linked inside course chapters. General = standalone; you give access to students by username.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title</label>
              <input
                required
                value={title}
                onChange={(e) => update("title", e.target.value)}
                className="input"
                placeholder="Assignment title"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Instructions</label>
              <RichTextEditor value={instructions} onChange={(v) => update("instructions", v)} minHeight={240} />
              <p className="mt-1 text-xs text-slate-500">Use the toolbar for headers, bold, italic, lists, links, and more.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Submission Type</label>
              <select
                value={submissionType}
                onChange={(e) => update("submissionType", e.target.value as SUBMISSION_TYPE)}
                className="input"
              >
                {SUBMISSION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Skill tags</label>
              <SkillTagsField value={skillTags} onChange={(v) => update("skillTags", v)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Moderators</label>
              <p className="mb-2 text-xs text-slate-500">
                Other admins or super admins who can edit this assignment (your account is excluded).
              </p>
              <ModeratorCheckboxes selectedIds={moderatorIds} onChange={(v) => update("moderatorIds", v)} />
            </div>
            {error && <p className="alert--error">{error}</p>}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "Creating…" : "Create Assignment"}
              </button>
              <Link
                href="/global-assignments"
                className="btn-secondary"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
