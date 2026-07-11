"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAutoSavedForm } from "@/lib/useAutoSavedForm";
import { ROLE } from "@funt-platform/constants";

import { RichTextEditor } from "@/components/RichTextEditor";
import { BackLink } from "@/components/ui/BackLink";
import { DraftRestoredBanner } from "@/components/ui/DraftRestoredBanner";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { VideoUploadField } from "@/components/videos/VideoUploadField";
import { makeUploadVideoFn } from "@/lib/uploadVideoToR2";
import { makeUploadImageFn } from "@/lib/uploadImageToR2";

interface AssignmentOption {
  id: string;
  title: string;
}

interface ChapterDraft {
  title: string;
  content: string;
  youtubeUrl: string;
  videoUrl: string;
  resourceLinkUrl: string;
  linkedAssignmentId: string;
}

const INITIAL_DRAFT: ChapterDraft = {
  title: "",
  content: "",
  youtubeUrl: "",
  videoUrl: "",
  resourceLinkUrl: "",
  linkedAssignmentId: "",
};

export default function NewGlobalChapterPage() {
  const router = useRouter();
  // Stable temp ID used as R2 key prefix before the chapter has a real MongoDB ID.
  // Generated once on mount — stays consistent if the user uploads then navigates back.
  const tempModuleId = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `temp-${Date.now()}`
  );
  const {
    value: form,
    setValue: setForm,
    hasRestoredDraft,
    draftSavedAt,
    discardDraft,
    clearDraft,
  } = useAutoSavedForm<ChapterDraft>("global-modules:new", INITIAL_DRAFT);
  const { title, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId } = form;
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadsInProgress, setUploadsInProgress] = useState(0);

  function update<K extends keyof ChapterDraft>(field: K, value: ChapterDraft[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Wrap uploadImage to track in-progress uploads
  const uploadImageFn = useRef(makeUploadImageFn({ courseId: "global", moduleId: tempModuleId.current }));
  const trackedUploadImage = useRef(async (file: File) => {
    setUploadsInProgress((n) => n + 1);
    try {
      const result = await uploadImageFn.current(file);
      return result;
    } finally {
      setUploadsInProgress((n) => Math.max(0, n - 1));
    }
  });

  // Auto-detect and re-upload base64 images (e.g. pasted from old chapters)
  const reuploadingRef = useRef(new Set<string>());
  useEffect(() => {
    if (!content) return;
    // Find all base64 image src in the content
    const base64Regex = /src="(data:image\/[^"]+)"/g;
    let match: RegExpExecArray | null;
    const base64Sources: string[] = [];
    while ((match = base64Regex.exec(content)) !== null) {
      const src = match[1];
      if (!reuploadingRef.current.has(src)) {
        base64Sources.push(src);
      }
    }
    if (base64Sources.length === 0) return;

    // Upload each base64 image to R2 and replace in content
    for (const dataUrl of base64Sources) {
      reuploadingRef.current.add(dataUrl);
      setUploadsInProgress((n) => n + 1);

      // Convert data URL to File
      (async () => {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const ext = blob.type.split("/")[1]?.split(";")[0] ?? "png";
          const file = new File([blob], `pasted-image.${ext}`, { type: blob.type });
          const uploaded = await uploadImageFn.current(file);
          // Replace the base64 src with the R2 URL in content
          setForm((prev) => ({
            ...prev,
            content: prev.content.split(dataUrl).join(uploaded.url),
          }));
        } catch (err) {
          console.error("Failed to re-upload pasted base64 image:", err);
        } finally {
          reuploadingRef.current.delete(dataUrl);
          setUploadsInProgress((n) => Math.max(0, n - 1));
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    api<{ id: string; title: string }[]>("/api/global-assignments").then((r) => {
      if (r.success && Array.isArray(r.data)) setAssignments(r.data);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (uploadsInProgress > 0) {
      setError("Please wait for image uploads to finish before saving.");
      return;
    }
    // Check if content still has base64 images (upload may have failed)
    if (content.includes("data:image/") && content.length > 500_000) {
      setError("Some images are still uploading or failed to upload. Wait a moment and try again, or remove large images.");
      return;
    }
    if (!title.trim() && !content.trim() && !youtubeUrl.trim() && !videoUrl.trim() && !resourceLinkUrl.trim() && !linkedAssignmentId.trim()) {
      setError("At least one of content, YouTube URL, video URL, resource link, or assignment must be provided.");
      return;
    }
    setLoading(true);
    const res = await api<{ id: string }>("/api/global-chapters", {
      method: "POST",
        body: JSON.stringify({
        title,
        description: title.trim(),
        content,
        youtubeUrl: youtubeUrl || undefined,
        videoUrl: videoUrl || undefined,
        resourceLinkUrl: resourceLinkUrl || undefined,
        linkedAssignmentId: linkedAssignmentId || undefined,
      }),
    });
    setLoading(false);
    if (res.success && res.data?.id) {
      clearDraft();
      router.push("/global-modules");
      return;
    }
    setError(res.message ?? "Failed to create chapter.");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <div className="shrink-0 pb-4">
        <BackLink href="/global-modules">Back to Chapters</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Global Chapter</h1>
          <p className="mt-1 text-sm text-slate-500">Create a chapter with content, video, and optional assignment.</p>
        </div>

        <form onSubmit={submit} className="p-6 sm:p-8">
          <div className="w-full space-y-4">
            {hasRestoredDraft && draftSavedAt !== null && (
              <DraftRestoredBanner savedAt={draftSavedAt} onDiscard={discardDraft} />
            )}
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Title
          </label>
          <input
            required
            value={title}
            onChange={(e) => update("title", e.target.value)}
            className="input"
            placeholder="Chapter title"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Content
          </label>
          <RichTextEditor
            value={content}
            onChange={(v) => update("content", v)}
            minHeight={320}
            uploadVideo={makeUploadVideoFn({ courseId: "global", moduleId: tempModuleId.current })}
            uploadImage={trackedUploadImage.current}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              YouTube URL
            </label>
            <input
              value={youtubeUrl}
              onChange={(e) => update("youtubeUrl", e.target.value)}
              className="input"
              placeholder="https://..."
            />
          </div>
          <div>
            <VideoUploadField
              label="Chapter Video (upload MP4)"
              value={videoUrl}
              onChange={(v) => update("videoUrl", v)}
              courseId="global"
              moduleId={tempModuleId.current}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Resource link (optional)
            </label>
            <input
              value={resourceLinkUrl}
              onChange={(e) => update("resourceLinkUrl", e.target.value)}
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
              onChange={(e) => update("linkedAssignmentId", e.target.value)}
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
            {uploadsInProgress > 0 && (
              <p className="text-sm text-amber-700">
                ⏳ Uploading {uploadsInProgress} image{uploadsInProgress > 1 ? "s" : ""} to storage… please wait before saving.
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || uploadsInProgress > 0}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? "Creating…" : uploadsInProgress > 0 ? "Waiting for uploads…" : "Create Chapter"}
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
