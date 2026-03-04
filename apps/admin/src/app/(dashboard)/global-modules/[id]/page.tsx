"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { MODULE_STATUS } from "@funt-platform/constants";

import { RichTextEditor } from "@/components/RichTextEditor";
import { BackLink } from "@/components/ui/BackLink";

interface VersionSnapshot {
  version: number;
  title: string;
  description: string;
  content: string;
  savedAt: string;
  savedBy?: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  content: string;
  youtubeUrl?: string;
  videoUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
  version: number;
  status: string;
  versionSnapshots?: VersionSnapshot[];
}

interface AssignmentOption {
  id: string;
  title: string;
}

export default function EditGlobalModulePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [module, setModule] = useState<Module | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [resourceLinkUrl, setResourceLinkUrl] = useState("");
  const [linkedAssignmentId, setLinkedAssignmentId] = useState("");
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [error, setError] = useState("");

  function applyModuleToForm(data: Module) {
    setModule(data);
    setTitle(data.title);
    setContent(data.content ?? "");
    setYoutubeUrl(data.youtubeUrl ?? "");
    setVideoUrl(data.videoUrl ?? "");
    setResourceLinkUrl(data.resourceLinkUrl ?? "");
    setLinkedAssignmentId(data.linkedAssignmentId ?? "");
  }

  useEffect(() => {
    api<{ id: string; title: string }[]>("/api/global-assignments").then((r) => {
      if (r.success && Array.isArray(r.data)) setAssignments(r.data);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    api<Module>(`/api/global-modules/${id}`).then((r) => {
      if (r.success && r.data) applyModuleToForm(r.data);
    });
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const autoDescription =
      content.replace(/<[^>]+>/g, "").trim().slice(0, 160) || title.trim();
    const res = await api(`/api/global-modules/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title,
        description: autoDescription,
        content,
        youtubeUrl: youtubeUrl || undefined,
        videoUrl: videoUrl || undefined,
        resourceLinkUrl: resourceLinkUrl || undefined,
        linkedAssignmentId: linkedAssignmentId || undefined,
      }),
    });
    setLoading(false);
    if (res.success) {
      router.push("/global-modules");
      return;
    }
    setError(res.message ?? "Failed to update.");
  }

  async function archive() {
    if (!confirm("Archive this module?")) return;
    const res = await api(`/api/global-modules/${id}/archive`, { method: "PATCH" });
    if (res.success) router.push("/global-modules");
    else setError(res.message ?? "Failed to archive.");
  }

  async function restoreVersionCopy(version: number) {
    if (!confirm(`Restore version ${version}? Current content will be saved as a version copy first.`)) return;
    setError("");
    setRestoringVersion(version);
    const res = await api<Module>(`/api/global-modules/${id}/versions/restore`, {
      method: "POST",
      body: JSON.stringify({ version }),
    });
    setRestoringVersion(null);
    if (res.success && res.data) applyModuleToForm(res.data);
    else setError(res.message ?? "Failed to restore version.");
  }

  if (!module) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-4">
        <BackLink href="/global-modules">Back to Modules</BackLink>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">v{module.version}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${module.status === MODULE_STATUS.ARCHIVED ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700"}`}>{module.status === MODULE_STATUS.ARCHIVED ? "Archived" : "Active"}</span>
          {module.status !== MODULE_STATUS.ARCHIVED && (
            <button type="button" onClick={archive} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50">Archive</button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Module</h1>
          <p className="mt-1 text-sm text-slate-500">Update content, video links, and linked assignment.</p>
        </div>

        <form onSubmit={submit} className="p-6 sm:p-8">
          <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Title
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Content
          </label>
          <RichTextEditor value={content} onChange={setContent} minHeight={320} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              YouTube URL
            </label>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Video URL (uploaded/hosted video)
            </label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Resource link (optional)
            </label>
            <input
              value={resourceLinkUrl}
              onChange={(e) => setResourceLinkUrl(e.target.value)}
              className="input"
              placeholder="e.g. Google Drive, slides, docs, or any other URL"
            />
            <p className="mt-1 text-xs text-slate-500">Share Drive folders, slides, or other resources.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Linked Assignment
            </label>
            <select
              value={linkedAssignmentId}
              onChange={(e) => setLinkedAssignmentId(e.target.value)}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">None — no assignment linked</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Optional. Select an assignment or keep None.</p>
          </div>
        </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">{loading ? "Saving…" : "Save"}</button>
              <Link href="/global-modules" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">Cancel</Link>
            </div>

            {module.versionSnapshots && module.versionSnapshots.length > 0 && (
              <div className="mt-10 border-t border-slate-200 pt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Version copies</h3>
                <p className="text-sm text-slate-500 mb-4">Previous versions saved when you update the module. Restore to make that version the current content.</p>
                <ul className="space-y-2">
                  {[...module.versionSnapshots].reverse().map((snap) => (
                    <li key={`${snap.version}-${snap.savedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">Version {snap.version}</span>
                      <span className="text-xs text-slate-500">{new Date(snap.savedAt).toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => restoreVersionCopy(snap.version)}
                        disabled={restoringVersion !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100 disabled:opacity-60"
                      >
                        {restoringVersion === snap.version ? "Restoring…" : "Restore"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
