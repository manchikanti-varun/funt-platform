"use client";

/**
 * VideoUploadField — direct browser-to-R2 upload via presigned PUT URLs.
 *
 * Upload sequence (Railway never touches video bytes):
 *   1. POST /api/admin/videos/presign  → { uploadUrl, videoKey }
 *   2. XHR PUT {uploadUrl}             → direct to R2, real progress events
 *   3. POST /api/admin/videos/confirm  → { videoKey, size }
 *   4. onChange(videoKey)              → parent saves "r2://..." into chapter
 *
 * Props:
 *   courseId   — used to build the R2 object key path
 *   moduleId   — used to build the R2 object key path
 *   lessonId   — optional, defaults to moduleId on the backend
 *   value      — current videoKey in state ("r2://..." or "")
 *   onChange   — called with the new videoKey on successful upload,
 *                or with "" when the user removes the video
 *   onError    — optional error message callback
 *   label      — field label (default: "Chapter Video")
 *   disabled   — locks the field while the parent form is saving
 */

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";

interface VideoUploadFieldProps {
  courseId: string;
  moduleId: string;
  lessonId?: string;
  value: string;
  onChange: (videoKey: string) => void;
  onError?: (msg: string) => void;
  label?: string;
  disabled?: boolean;
}

const ALLOWED_TYPES = new Set(["video/mp4"]);

/** Format bytes as a human-readable string, e.g. "1.4 GB". */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

type UploadPhase = "presign" | "upload" | "confirm";

export function VideoUploadField({
  courseId,
  moduleId,
  lessonId,
  value,
  onChange,
  onError,
  label = "Chapter Video",
  disabled = false,
}: VideoUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("presign");
  const [progress, setProgress] = useState(0);
  const [fileSize, setFileSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const hasVideo = value.startsWith("r2://");

  function reportError(msg: string) {
    onError?.(msg);
  }

  /** Cancel an in-flight XHR PUT (e.g. user navigates away). */
  function cancelUpload() {
    xhrRef.current?.abort();
  }

  const upload = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.has(file.type)) {
        reportError("Only MP4 video files are supported.");
        return;
      }
      if (!courseId.trim() || !moduleId.trim()) {
        reportError("Save the chapter first — courseId and moduleId are required.");
        return;
      }

      setUploading(true);
      setProgress(0);
      setFileSize(file.size);
      onError?.("");

      try {
        // ── Step 1: get a presigned PUT URL from Railway ─────────────────────
        setPhase("presign");
        const presignRes = await api<{
          uploadUrl: string;
          videoKey: string;
          expiresInSeconds: number;
        }>("/api/admin/videos/presign", {
          method: "POST",
          body: JSON.stringify({
            courseId,
            moduleId,
            lessonId: lessonId ?? moduleId,
            mimeType: file.type,
          }),
        });

        if (!presignRes.success || !presignRes.data?.uploadUrl) {
          throw new Error(presignRes.message ?? "Failed to get upload URL");
        }

        const { uploadUrl, videoKey } = presignRes.data;

        // ── Step 2: PUT file directly to R2 ─────────────────────────────────
        setPhase("upload");
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          // Real upload progress — bytes going to R2, not Railway
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });

          xhr.addEventListener("load", () => {
            xhrRef.current = null;
            // R2 returns 200 on a successful presigned PUT
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(
                new Error(
                  `R2 upload failed (HTTP ${xhr.status}). ` +
                  "Check that the presigned URL has not expired and retry."
                )
              );
            }
          });

          xhr.addEventListener("error", () => {
            xhrRef.current = null;
            reject(new Error("Network error while uploading to R2"));
          });

          xhr.addEventListener("abort", () => {
            xhrRef.current = null;
            reject(new Error("Upload cancelled"));
          });

          xhr.open("PUT", uploadUrl);
          // R2 presigned URL encodes Content-Type — the request header must match
          xhr.setRequestHeader("Content-Type", "video/mp4");
          xhr.send(file);
        });

        // ── Step 3: confirm with Railway that the object exists in R2 ────────
        setPhase("confirm");
        const confirmRes = await api<{ videoKey: string; size: number }>(
          "/api/admin/videos/confirm",
          {
            method: "POST",
            body: JSON.stringify({ videoKey }),
          }
        );

        if (!confirmRes.success || !confirmRes.data?.videoKey) {
          throw new Error(confirmRes.message ?? "Upload confirmation failed");
        }

        // ── Done ─────────────────────────────────────────────────────────────
        onChange(confirmRes.data.videoKey);
      } catch (err) {
        reportError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setProgress(0);
        setPhase("presign");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courseId, moduleId, lessonId, onChange, onError]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = ""; // allow re-selecting the same file
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  function handleClear() {
    if (uploading) cancelUpload();
    onChange("");
    onError?.("");
  }

  // Human-readable phase label shown under the spinner
  const phaseLabel: Record<UploadPhase, string> = {
    presign: "Preparing upload…",
    upload: `Uploading to R2… ${progress}% of ${formatBytes(fileSize)}`,
    confirm: "Verifying…",
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">{label}</label>

      {hasVideo ? (
        /* ── Video is already uploaded ── */
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          {/* Play icon */}
          <svg
            className="h-5 w-5 shrink-0 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-emerald-800">
            {value}
          </span>
          {!disabled && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── Drop zone ── */
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={uploading || disabled ? -1 : 0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          aria-label="Upload video"
          className={[
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition outline-none",
            "focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
            dragOver
              ? "border-teal-400 bg-teal-50"
              : "border-slate-300 bg-slate-50/50 hover:border-teal-300 hover:bg-teal-50/30",
            uploading || disabled ? "cursor-not-allowed opacity-70" : "",
          ].join(" ")}
        >
          {uploading ? (
            /* ── Upload in progress ── */
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" aria-hidden />
              <p className="text-sm font-medium text-slate-700">{phaseLabel[phase]}</p>
              {phase === "upload" && (
                <>
                  {/* Progress bar only during the actual R2 PUT */}
                  <div
                    className="w-full max-w-xs overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-2 rounded-full bg-teal-500 transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Upload goes directly to R2 — Railway is not involved
                  </p>
                </>
              )}
            </>
          ) : (
            /* ── Idle state ── */
            <>
              <svg
                className="h-10 w-10 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-semibold text-slate-700">
                Drag &amp; drop an MP4 here, or click to select
              </p>
              <p className="text-xs text-slate-500">
                MP4 only · uploads directly to R2 (no server memory used)
              </p>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4"
        className="sr-only"
        onChange={handleFileChange}
        disabled={uploading || disabled}
        aria-hidden
      />
    </div>
  );
}
