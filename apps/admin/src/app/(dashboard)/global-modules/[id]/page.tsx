"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { MODULE_STATUS, ROLE } from "@funt-platform/constants";

import { RichTextEditor } from "@/components/RichTextEditor";
import { useAppDialog, EntityDetailLoadingScreen, EntityDetailShell } from "@/components/ui";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { VideoUploadField } from "@/components/videos/VideoUploadField";
import { ChapterHostedMedia } from "@/components/chapters/ChapterHostedMedia";
import { makeUploadVideoFn } from "@/lib/uploadVideoToR2";
import { makeUploadImageFn } from "@/lib/uploadImageToR2";

interface VersionSnapshot {
  version: number;
  title: string;
  description: string;
  content: string;
  savedAt: string;
  savedBy?: string;
}

interface Chapter {
  id: string;
  title: string;
  description: string;
  content: string;
  youtubeUrl?: string;
  videoUrl?: string;
  resourceLinkUrl?: string;
  linkedAssignmentId?: string;
  linkedQuizId?: string;
  version: number;
  status: string;
  versionSnapshots?: VersionSnapshot[];
}

interface AssignmentOption {
  id: string;
  title: string;
}

interface QuizOption {
  _id: string;
  quizId?: string;
  title: string;
  type: string;
  questionCount?: number;
}

export default function EditGlobalChapterPage() {
  const dialog = useAppDialog();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [resourceLinkUrl, setResourceLinkUrl] = useState("");
  const [linkedAssignmentId, setLinkedAssignmentId] = useState("");
  const [linkedQuizId, setLinkedQuizId] = useState("");
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [uploadsInProgress, setUploadsInProgress] = useState(0);

  // Upload helper for images
  const uploadImageFn = useRef(makeUploadImageFn({ courseId: "global", moduleId: id }));
  const uploadVideoFnRef = useRef(makeUploadVideoFn({ courseId: "global", moduleId: id }));

  // Tracked upload for the editor's uploadImage prop
  const trackedUploadImage = useRef(async (file: File) => {
    setUploadsInProgress((n) => n + 1);
    try {
      return await uploadImageFn.current(file);
    } finally {
      setUploadsInProgress((n) => Math.max(0, n - 1));
    }
  });

  // Auto-detect and re-upload base64 images AND videos (pasted from old chapters)
  const reuploadingRef = useRef(new Set<string>());
  const reuploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!content) return;
    const hasBase64Image = content.includes("data:image/");
    const hasBase64Video = content.includes("data:video/");
    if (!hasBase64Image && !hasBase64Video) return;

    if (reuploadTimerRef.current) clearTimeout(reuploadTimerRef.current);
    reuploadTimerRef.current = setTimeout(() => {
      const toUpload: { dataUrl: string; type: "image" | "video" }[] = [];

      const imgMarker = 'src="data:image/';
      let searchFrom = 0;
      while (true) {
        const start = content.indexOf(imgMarker, searchFrom);
        if (start === -1) break;
        const srcStart = start + 5;
        const srcEnd = content.indexOf('"', srcStart);
        if (srcEnd === -1) break;
        const dataUrl = content.slice(srcStart, srcEnd);
        const key = dataUrl.slice(0, 100);
        if (!reuploadingRef.current.has(key)) {
          toUpload.push({ dataUrl, type: "image" });
          reuploadingRef.current.add(key);
        }
        searchFrom = srcEnd + 1;
      }

      const vidMarker = 'src="data:video/';
      searchFrom = 0;
      while (true) {
        const start = content.indexOf(vidMarker, searchFrom);
        if (start === -1) break;
        const srcStart = start + 5;
        const srcEnd = content.indexOf('"', srcStart);
        if (srcEnd === -1) break;
        const dataUrl = content.slice(srcStart, srcEnd);
        const key = dataUrl.slice(0, 100);
        if (!reuploadingRef.current.has(key)) {
          toUpload.push({ dataUrl, type: "video" });
          reuploadingRef.current.add(key);
        }
        searchFrom = srcEnd + 1;
      }

      if (toUpload.length === 0) return;

      (async () => {
        for (const { dataUrl, type } of toUpload) {
          const key = dataUrl.slice(0, 100);
          setUploadsInProgress((n) => n + 1);
          try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();

            let replacementUrl: string;
            if (type === "image") {
              const ext = blob.type.split("/")[1]?.split(";")[0] ?? "png";
              const file = new File([blob], `pasted-image.${ext}`, { type: blob.type });
              const uploaded = await uploadImageFn.current(file);
              replacementUrl = uploaded.url;
            } else {
              const file = new File([blob], "pasted-video.mp4", { type: blob.type || "video/mp4" });
              const uploaded = await uploadVideoFnRef.current(file, () => {});
              replacementUrl = uploaded.storageUrl ?? uploaded.url;
            }

            setContent((prev) => {
              const idx = prev.indexOf(dataUrl);
              if (idx === -1) return prev;
              return prev.slice(0, idx) + replacementUrl + prev.slice(idx + dataUrl.length);
            });
          } catch (err) {
            console.error(`Failed to re-upload pasted base64 ${type}:`, err);
          } finally {
            reuploadingRef.current.delete(key);
            setUploadsInProgress((n) => Math.max(0, n - 1));
          }
        }
      })();
    }, 500);

    return () => {
      if (reuploadTimerRef.current) clearTimeout(reuploadTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  function applyChapterToForm(data: Chapter) {
    setChapter(data);
    setTitle(data.title);
    setContent(data.content ?? "");
    setYoutubeUrl(data.youtubeUrl ?? "");
    setVideoUrl(data.videoUrl ?? "");
    setResourceLinkUrl(data.resourceLinkUrl ?? "");
    setLinkedAssignmentId(data.linkedAssignmentId ?? "");
    setLinkedQuizId(data.linkedQuizId ?? "");
  }

  useEffect(() => {
    api<{ id: string; title: string }[]>("/api/global-assignments").then((r) => {
      if (r.success && Array.isArray(r.data)) setAssignments(r.data);
    });
    api<QuizOption[]>("/api/quizzes/for-linking?type=CHAPTER").then((r) => {
      if (r.success && Array.isArray(r.data)) setQuizOptions(r.data);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    api<Chapter>(`/api/global-chapters/${id}`).then((r) => {
      if (r.success && r.data) applyChapterToForm(r.data);
    });
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (uploadsInProgress > 0) {
      setError("Please wait for image uploads to finish before saving.");
      return;
    }
    // Block submit if content still contains any base64 images or videos
    if (content.includes("data:image/") || content.includes("data:video/")) {
      setError("Images/videos are still being uploaded to storage. Please wait a few seconds and try again.");
      return;
    }
    setLoading(true);
    // Only send fields that changed to avoid re-uploading large content unnecessarily
    const body: Record<string, string | undefined> = {
      title,
      description: title.trim(),
    };
    if (content !== (chapter?.content ?? "")) body.content = content;
    if ((youtubeUrl || "") !== (chapter?.youtubeUrl ?? "")) body.youtubeUrl = youtubeUrl || undefined;
    if ((videoUrl || "") !== (chapter?.videoUrl ?? "")) body.videoUrl = videoUrl || undefined;
    if ((resourceLinkUrl || "") !== (chapter?.resourceLinkUrl ?? "")) body.resourceLinkUrl = resourceLinkUrl || undefined;
    if ((linkedAssignmentId || "") !== (chapter?.linkedAssignmentId ?? "")) body.linkedAssignmentId = linkedAssignmentId || undefined;
    if ((linkedQuizId || "") !== (chapter?.linkedQuizId ?? "")) body.linkedQuizId = linkedQuizId || undefined;
    const res = await api(`/api/global-chapters/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.success) {
      router.push("/global-modules");
      return;
    }
    setError(res.message ?? "Failed to update.");
  }

  async function archive() {
    const ok = await dialog.confirm({
      title: "Archive chapter",
      message: "Archive this chapter?",
      confirmLabel: "Archive",
    });
    if (!ok) return;
    const res = await api(`/api/global-chapters/${id}/archive`, { method: "PATCH" });
    if (res.success) router.push("/global-modules");
    else setError(res.message ?? "Failed to archive chapter.");
  }

  async function unarchive() {
    const ok = await dialog.confirm({
      title: "Unarchive chapter",
      message: "Unarchive this chapter?",
      confirmLabel: "Unarchive",
    });
    if (!ok) return;
    const res = await api<Chapter>(`/api/global-chapters/${id}/unarchive`, { method: "PATCH" });
    if (res.success && res.data) {
      applyChapterToForm(res.data);
    } else if (!res.success) {
      setError(res.message ?? "Failed to unarchive chapter.");
    }
  }

  async function restoreVersionCopy(version: number) {
    const ok = await dialog.confirm({
      title: "Restore version",
      message: `Restore version ${version}? Current content will be saved as a version copy first.`,
      confirmLabel: "Restore",
    });
    if (!ok) return;
    setError("");
    setRestoringVersion(version);
    const res = await api<Chapter>(`/api/global-chapters/${id}/versions/restore`, {
      method: "POST",
      body: JSON.stringify({ version }),
    });
    setRestoringVersion(null);
    if (res.success && res.data) applyChapterToForm(res.data);
    else setError(res.message ?? "Failed to restore version.");
  }

  if (!chapter) {
    return <EntityDetailLoadingScreen label="Loading chapter…" />;
  }

  return (
    <>
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <EntityDetailShell
        backHref="/global-modules"
        backLabel="Back to Chapters"
        title={title || chapter.title}
        description="Update content, video links, and linked assignment."
        mode="edit"
        viewHref={`/global-modules/${id}/view`}
        editHref={`/global-modules/${id}`}
        badges={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              v{chapter.version}
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              Global source
            </span>
            <span
              className={
                chapter.status === MODULE_STATUS.ARCHIVED
                  ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  : "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              }
            >
              {chapter.status === MODULE_STATUS.ARCHIVED ? "Archived" : "Active"}
            </span>
          </>
        }
        headerAside={
          <div className="flex items-center gap-2">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472"}/api/global-modules/${id}/export-doc`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm hover:bg-indigo-50"
            >
              ↓ Download .doc
            </a>
            {chapter.status !== MODULE_STATUS.ARCHIVED ? (
              <button
                type="button"
                onClick={archive}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
              >
                Archive
              </button>
            ) : (
              <button
                type="button"
                onClick={unarchive}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm hover:bg-emerald-50"
              >
                Unarchive
              </button>
            )}
          </div>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="w-full space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Content</label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                minHeight={320}
                uploadVideo={makeUploadVideoFn({ courseId: "global", moduleId: id })}
                uploadImage={trackedUploadImage.current}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">YouTube URL</label>
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="input"
                />
              </div>
              {/* ── R2 Video Upload ── */}
              <div>
                <VideoUploadField
                  courseId="global"
                  moduleId={id}
                  lessonId={id}
                  value={videoUrl}
                  onChange={setVideoUrl}
                  onError={setError}
                  label="Chapter Video (upload MP4)"
                />
                {/* Allow pasting a legacy external URL when no R2 video is set */}
                {!videoUrl.startsWith("r2://") && (
                  <div className="mt-2">
                    <input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="input text-xs"
                      placeholder="Or paste an external video URL (e.g. Vimeo)"
                    />
                  </div>
                )}
                {/* Video preview */}
                {(videoUrl || youtubeUrl) && (
                  <div className="mt-3">
                    <ChapterHostedMedia youtubeUrl={youtubeUrl} videoUrl={videoUrl} />
                  </div>
                )}
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
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Linked Assignment</label>
                <select
                  value={linkedAssignmentId}
                  onChange={(e) => setLinkedAssignmentId(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">None — no assignment linked</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">Optional. Select an assignment or keep None.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Linked Quiz</label>
                <select
                  value={linkedQuizId}
                  onChange={(e) => setLinkedQuizId(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">None — no quiz linked</option>
                  {quizOptions.map((q) => (
                    <option key={q._id} value={q.quizId ?? q._id}>
                      {q.title} ({q.questionCount ?? 0} questions)
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Optional. Link a chapter quiz — students must pass it to complete this chapter.{" "}
                  <a href="/quizzes/new" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline">
                    Create a new quiz →
                  </a>
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {(uploadsInProgress > 0 || content.includes("data:image/") || content.includes("data:video/")) && (
              <p className="text-sm text-amber-700">
                ⏳ {uploadsInProgress > 0
                  ? `Uploading ${uploadsInProgress} file${uploadsInProgress > 1 ? "s" : ""} to storage… please wait before saving.`
                  : "Detecting embedded media and preparing upload… please wait."}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || uploadsInProgress > 0 || content.includes("data:image/") || content.includes("data:video/")}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? "Saving…" : (uploadsInProgress > 0 || content.includes("data:image/") || content.includes("data:video/")) ? "Waiting for uploads…" : "Save"}
              </button>
              <Link
                href="/global-modules"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </Link>
            </div>
            {chapter.versionSnapshots && chapter.versionSnapshots.length > 0 && (
              <div className="mt-10 border-t border-slate-200 pt-8">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
                  Version copies
                </h3>
                <p className="mb-4 text-sm text-slate-500">
                  Previous versions saved when you update the chapter. Restore to make that version the current
                  content.
                </p>
                <ul className="space-y-2">
                  {[...chapter.versionSnapshots].reverse().map((snap) => (
                    <li
                      key={`${snap.version}-${snap.savedAt}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3"
                    >
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
      </EntityDetailShell>
    </>
  );
}
