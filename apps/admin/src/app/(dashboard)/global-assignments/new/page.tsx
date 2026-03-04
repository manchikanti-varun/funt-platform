"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { SUBMISSION_TYPE, SKILL_TAG } from "@funt-platform/constants";

const STORAGE_KEY = "new_global_assignment_type";

function getStoredType(): "general" | "module" {
  if (typeof window === "undefined") return "module";
  const v = window.sessionStorage.getItem(STORAGE_KEY);
  return v === "general" ? "general" : "module";
}

import { RichTextEditor } from "@/components/RichTextEditor";
import { BackLink } from "@/components/ui/BackLink";

const SUBMISSION_TYPES = [SUBMISSION_TYPE.FILE, SUBMISSION_TYPE.TEXT, SUBMISSION_TYPE.LINK];
const SKILL_TAGS_LIST = Object.values(SKILL_TAG);

export default function NewGlobalAssignmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submissionType, setSubmissionType] = useState(SUBMISSION_TYPE.TEXT);
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [type, setTypeState] = useState<"general" | "module">(getStoredType);
  const [moderatorIdsText, setModeratorIdsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setType = useCallback((value: "general" | "module") => {
    setTypeState(value);
    if (typeof window !== "undefined") window.sessionStorage.setItem(STORAGE_KEY, value);
  }, []);

  const typeRef = useRef<"general" | "module">(type);
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  function toggleSkill(tag: string) {
    setSkillTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const instructionsPlain = instructions?.replace(/<[^>]+>/g, "").trim() ?? "";
    if (!instructionsPlain) {
      setError("Instructions are required.");
      return;
    }
    setError("");
    setLoading(true);
    const moderatorIds = moderatorIdsText.split(",").map((s) => s.trim()).filter(Boolean);
    const assignmentType = typeRef.current;
    const res = await api<{ id: string }>("/api/global-assignments", {
      method: "POST",
      body: JSON.stringify({ title, instructions, submissionType, skillTags, type: assignmentType, moderatorIds }),
    });
    setLoading(false);
    if (res.success && res.data?.id) {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
      router.push("/global-assignments");
      return;
    }
    setError(res.message ?? "Failed to create assignment.");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4">
        <BackLink href="/global-assignments" onClick={() => typeof window !== "undefined" && window.sessionStorage.removeItem(STORAGE_KEY)}>
          Back to Assignments
        </BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Global Assignment</h1>
          <p className="mt-1 text-sm text-slate-600">Create a new assignment template for courses and batches.</p>
        </div>

        <form onSubmit={submit} className="p-6 sm:p-8">
          <div className="mx-auto max-w-2xl space-y-6">
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
              <p className="mt-1 text-xs text-slate-500">Module = linked inside course modules. General = standalone; you give access to students by FUNT ID.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Assignment title"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Instructions</label>
              <RichTextEditor value={instructions} onChange={setInstructions} minHeight={240} />
              <p className="mt-1 text-xs text-slate-500">Use the toolbar for headers, bold, italic, lists, links, and more.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Submission Type</label>
              <select
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value as typeof submissionType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {SUBMISSION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Skill Tags</label>
              <div className="flex flex-wrap gap-2">
                {SKILL_TAGS_LIST.map((tag) => (
                  <label
                    key={tag}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-teal-400 hover:bg-teal-50/50"
                  >
                    <input type="checkbox" checked={skillTags.includes(tag)} onChange={() => toggleSkill(tag)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    {tag}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Moderators (FUNT IDs)</label>
              <p className="mb-2 text-xs text-slate-500">Other admins or trainers who can edit this assignment. Comma-separated FUNT IDs.</p>
              <input
                type="text"
                value={moderatorIdsText}
                onChange={(e) => setModeratorIdsText(e.target.value)}
                placeholder="e.g. id1, id2"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? "Creating…" : "Create Assignment"}
              </button>
              <Link
                href="/global-assignments"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => typeof window !== "undefined" && window.sessionStorage.removeItem(STORAGE_KEY)}
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
