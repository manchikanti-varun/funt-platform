"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { COURSE_STATUS, SUBMISSION_TYPE, SKILL_TAG } from "@funt-platform/constants";

import { RichTextEditor } from "@/components/RichTextEditor";

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
  order: number;
}

interface Course {
  id: string;
  title: string;
  description: string;
  modules: CourseModule[];
  version: number;
  status: string;
}

import { BackLink } from "@/components/ui/BackLink";

export default function EditCoursePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [moduleEdit, setModuleEdit] = useState<Partial<CourseModule>>({});
  const [savingModule, setSavingModule] = useState(false);
  const [globalAssignmentPreview, setGlobalAssignmentPreview] = useState<{ title: string; instructions: string; submissionType?: string; skillTags?: string[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Course>(`/api/courses/${id}`).then((r) => {
      if (r.success && r.data) {
        setCourse(r.data);
        setTitle(r.data.title);
        setDescription(r.data.description ?? "");
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
    setError("");
    setLoading(true);
    const res = await api(`/api/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, description }),
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
      const res = await api<Course>(`/api/courses/${id}/modules/${editingIndex}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: moduleEdit.title,
          description: moduleEdit.description,
          content: moduleEdit.content,
          youtubeUrl: moduleEdit.youtubeUrl || undefined,
          videoUrl: moduleEdit.videoUrl || undefined,
          resourceLinkUrl: moduleEdit.resourceLinkUrl || undefined,
          linkedAssignmentId: moduleEdit.linkedAssignmentId || undefined,
          linkedAssignmentTitleOverride: moduleEdit.linkedAssignmentTitleOverride || undefined,
          linkedAssignmentInstructionsOverride: moduleEdit.linkedAssignmentInstructionsOverride || undefined,
          linkedAssignmentSubmissionTypeOverride: moduleEdit.linkedAssignmentSubmissionTypeOverride || undefined,
          linkedAssignmentSkillTagsOverride: Array.isArray(moduleEdit.linkedAssignmentSkillTagsOverride) ? moduleEdit.linkedAssignmentSkillTagsOverride : undefined,
        }),
      });
      if (res.success && res.data) {
        setCourse(res.data);
        cancelEditModule();
      } else {
        setError(res.message ?? "Failed to update module.");
      }
    } catch {
      setError("Failed to update module.");
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
      const res = await api(`/api/courses/${id}/reorder`, { method: "PATCH", body: JSON.stringify({ orderedModuleIndices: indices }) });
      if (res.success && res.data) setCourse(res.data as Course);
    }
    if (direction === "down" && clickedIndex < sorted.length - 1) {
      const indices = sorted.map((_, i) => i);
      [indices[clickedIndex], indices[clickedIndex + 1]] = [indices[clickedIndex + 1], indices[clickedIndex]];
      const res = await api(`/api/courses/${id}/reorder`, { method: "PATCH", body: JSON.stringify({ orderedModuleIndices: indices }) });
      if (res.success && res.data) setCourse(res.data as Course);
    }
  }

  async function archive() {
    if (!confirm("Archive this course? It will no longer be available for new batches.")) return;
    const res = await api(`/api/courses/${id}/archive`, { method: "PATCH" });
    if (res.success) router.push("/courses");
    else setError(res.message ?? "Failed to archive.");
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading course…</p>
      </div>
    );
  }

  const sortedModules = [...(course.modules ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-6">
        <BackLink href="/courses">Back to Courses</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Edit Course</h2>
              <p className="mt-1 text-sm text-slate-600">Update title, description, reorder modules, or edit a module copy (content, video, etc.) for this course only.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">v{course.version}</span>
              <span
                className={
                  course.status === COURSE_STATUS.ARCHIVED
                    ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                    : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                }
              >
                {course.status === COURSE_STATUS.ARCHIVED ? "Archived" : "Active"}
              </span>
              {course.status !== COURSE_STATUS.ARCHIVED && (
                <button
                  type="button"
                  onClick={archive}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Archive
                </button>
              )}
              <Link
                href={`/courses/${id}/duplicate`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicate
              </Link>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-6">
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
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Modules in this course</h3>
            <p className="mt-1 text-sm text-slate-600">These are copies of global modules for this course. You can edit the module copy (title, content, video, etc.) here, or reorder with Up/Down.</p>
            <ul className="mt-3 space-y-2">
              {sortedModules.map((m, i) => (
                <li key={m.originalGlobalModuleId} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 shrink-0 text-sm font-medium text-slate-500">{i + 1}.</span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 truncate">{m.title}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditModule(m, i)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-300 bg-teal-50 text-teal-700 transition hover:bg-teal-100"
                        title="Edit module"
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
                      <h4 className="text-sm font-semibold text-slate-800">Edit module for this course</h4>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
                        <input
                          value={moduleEdit.title ?? ""}
                          onChange={(e) => setModuleEdit((p) => ({ ...p, title: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
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
                          <label className="mb-1 block text-xs font-medium text-slate-600">Video URL</label>
                          <input
                            value={moduleEdit.videoUrl ?? ""}
                            onChange={(e) => setModuleEdit((p) => ({ ...p, videoUrl: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">Resource link (optional)</label>
                          <input
                            value={moduleEdit.resourceLinkUrl ?? ""}
                            onChange={(e) => setModuleEdit((p) => ({ ...p, resourceLinkUrl: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="e.g. Google Drive, slides, docs, or any other URL"
                          />
                          <p className="mt-1 text-xs text-slate-500">Share Drive folders, slides, or other resources. Students see this as a link in the module.</p>
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
                          {savingModule ? "Saving…" : "Save module"}
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
      </div>
    </div>
  );
}
