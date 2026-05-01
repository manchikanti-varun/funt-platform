"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ASSIGNMENT_STATUS, SUBMISSION_TYPE } from "@funt-platform/constants";

import { RichTextEditor } from "@/components/RichTextEditor";
import { BackLink } from "@/components/ui/BackLink";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { SkillTagsField } from "@/components/admin/SkillTagsField";
import { ModeratorCheckboxes } from "@/components/admin/StaffPickerFields";

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  submissionType: string;
  skillTags: string[];
  status: string;
  type?: string;
  moderatorIds?: string[];
}

export default function EditGlobalAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submissionType, setSubmissionType] = useState<string>(SUBMISSION_TYPE.TEXT);
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [type, setType] = useState<"general" | "module">("module");
  const [moderatorIds, setModeratorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState("");

  const typeRef = useRef<"general" | "module">(type);
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  useEffect(() => {
    if (!id) return;
    api<Assignment>(`/api/global-assignments/${id}`).then((r) => {
      if (r.success && r.data) {
        setAssignment(r.data);
        setTitle(r.data.title);
        setInstructions(r.data.instructions ?? "");
        setSubmissionType(r.data.submissionType ?? SUBMISSION_TYPE.TEXT);
        setSkillTags(Array.isArray(r.data.skillTags) ? r.data.skillTags : []);
        setType((r.data.type === "general" ? "general" : "module") as "general" | "module");
        setModeratorIds(Array.isArray(r.data.moderatorIds) ? r.data.moderatorIds : []);
      }
    });
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (skillTags.length === 0) {
      setError("Select at least one skill tag (or add a custom tag).");
      return;
    }
    setLoading(true);
    const assignmentType = typeRef.current;
    const res = await api(`/api/global-assignments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, instructions, submissionType, skillTags, type: assignmentType, moderatorIds }),
    });
    setLoading(false);
    if (res.success) {
      router.push("/global-assignments");
      return;
    }
    setError(res.message ?? "Failed to update.");
  }

  async function archive() {
    if (!confirm("Archive this assignment?")) return;
    const res = await api(`/api/global-assignments/${id}/archive`, { method: "PATCH" });
    if (res.success) router.push("/global-assignments");
    else setError(res.message ?? "Failed to archive.");
  }

  async function duplicate() {
    setError("");
    setDuplicating(true);
    const res = await api<{ id: string }>(`/api/global-assignments/${id}/duplicate`, { method: "POST" });
    setDuplicating(false);
    if (res.success && res.data?.id) {
      router.push(`/global-assignments/${res.data.id}`);
      return;
    }
    setError(res.message ?? "Failed to duplicate.");
  }

  if (!assignment) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/global-assignments" />
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-4">
        <BackLink href="/global-assignments">Back to Assignments</BackLink>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              assignment.status === ASSIGNMENT_STATUS.ARCHIVED ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {assignment.status === ASSIGNMENT_STATUS.ARCHIVED ? "Archived" : "Active"}
          </span>
          {assignment.status !== ASSIGNMENT_STATUS.ARCHIVED && (
            <>
              {assignment.type === "general" && (
                <Link
                  href={`/global-assignments/${id}/settings`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm transition hover:bg-amber-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
              )}
              {assignment.type === "general" && (
                <Link
                  href={`/global-assignments/${id}/submissions`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
                >
                  Submissions
                </Link>
              )}
              <button type="button" onClick={duplicate} disabled={duplicating} className="btn-duplicate">
                {duplicating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
                ) : (
                  <DuplicateIcon />
                )}
                Duplicate
              </button>
              <button
                type="button"
                onClick={archive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50"
              >
                Archive
              </button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Assignment</h1>
          <p className="mt-1 text-sm text-slate-600">Update title, instructions, type, and skill tags.</p>
          <div className="mt-2 inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
            Global source
          </div>
        </div>

        <form onSubmit={submit} className="p-6 sm:p-8">
          <div className="w-full space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type</label>
              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="type" checked={type === "module"} onChange={() => setType("module")} className="text-teal-600" />
                  <span className="text-sm text-slate-700">Module</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="type" checked={type === "general"} onChange={() => setType("general")} className="text-teal-600" />
                  <span className="text-sm text-slate-700">General</span>
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Instructions</label>
              <RichTextEditor value={instructions} onChange={setInstructions} minHeight={240} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Submission Type</label>
              <select
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {Object.values(SUBMISSION_TYPE).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Skill tags</label>
              <SkillTagsField value={skillTags} onChange={setSkillTags} />
            </div>
            <div className="border-t border-slate-200 pt-6">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Moderators</label>
              <p className="mb-2 text-xs text-slate-500">
                Other admins or super admins who can edit this assignment (your account is excluded).
              </p>
              <ModeratorCheckboxes selectedIds={moderatorIds} onChange={setModeratorIds} />
            </div>
            {type === "general" && (
              <p className="border-t border-slate-200 pt-4 text-sm text-slate-500">
                To manage who can see and submit this assignment, use <Link href={`/global-assignments/${id}/settings`} className="font-medium text-teal-600 hover:underline">Settings → Student access</Link>.
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save"}
              </button>
              <Link
                href="/global-assignments"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
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
