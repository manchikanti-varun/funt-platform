"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

import { RichTextEditor } from "@/components/RichTextEditor";
import { BackLink } from "@/components/ui/BackLink";

interface AssignmentOption {
  id: string;
  title: string;
}

export default function NewGlobalModulePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [resourceLinkUrl, setResourceLinkUrl] = useState("");
  const [linkedAssignmentId, setLinkedAssignmentId] = useState("");
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ id: string; title: string }[]>("/api/global-assignments").then((r) => {
      if (r.success && Array.isArray(r.data)) setAssignments(r.data);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() && !content.trim() && !youtubeUrl.trim() && !videoUrl.trim() && !resourceLinkUrl.trim() && !linkedAssignmentId.trim()) {
      setError("At least one of content, YouTube URL, video URL, resource link, or assignment must be provided.");
      return;
    }
    setLoading(true);
    const autoDescription =
      content.replace(/<[^>]+>/g, "").trim().slice(0, 160) || title.trim();
    const res = await api<{ id: string }>("/api/global-modules", {
      method: "POST",
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
    if (res.success && res.data?.id) {
      router.push("/global-modules");
      return;
    }
    setError(res.message ?? "Failed to create module.");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4">
        <BackLink href="/global-modules">Back to Modules</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Global Module</h1>
          <p className="mt-1 text-sm text-slate-500">Create a module with content, video, and optional assignment.</p>
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
            placeholder="Module title"
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
              placeholder="https://..."
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
              placeholder="https://..."
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
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? "Creating…" : "Create Module"}
              </button>
              <Link
                href="/global-modules"
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
