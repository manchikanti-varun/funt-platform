"use client";

import { useEffect, useState } from "react";
import {
  courseCardImageLinkLabel,
  courseCardImagePreviewSrc,
  isValidCourseCardImageLink,
} from "@/lib/courseCardImage";
import { api } from "@/lib/api";

interface CourseCardImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
  /** When true (default), image cannot be cleared and label shows required. */
  required?: boolean;
  /** Course ID or "new" — used as part of the R2 key path. */
  courseId?: string;
}

export function CourseCardImageField({ value, onChange, onError, required = true, courseId = "new" }: CourseCardImageFieldProps) {
  const [linkDraft, setLinkDraft] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [localError, setLocalError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = value.trim();
    if (!t || t.startsWith("data:image/")) {
      if (!t) setLinkDraft("");
      return;
    }
    setLinkDraft(t);
    setSourceLabel(courseCardImageLinkLabel(t));
  }, [value]);

  function reportError(message: string) {
    setLocalError(message);
    onError?.(message);
  }

  function clearError() {
    setLocalError("");
  }

  function applyLink() {
    clearError();
    const t = linkDraft.trim();
    if (!t) {
      reportError("Paste a Google Drive or image URL first.");
      return;
    }
    if (!isValidCourseCardImageLink(t)) {
      reportError("Link must start with http:// or https://");
      return;
    }
    onChange(t);
    setSourceLabel(courseCardImageLinkLabel(t));
  }

  function removeImage() {
    if (required) {
      reportError("Course card image is required.");
      return;
    }
    clearError();
    onChange("");
    setLinkDraft("");
    setSourceLabel("");
  }

  async function uploadToR2(file: File) {
    clearError();
    setUploading(true);
    try {
      const mimeType = file.type || "image/jpeg";

      // Step 1: presign
      const presignRes = await api<{
        uploadUrl: string;
        imageKey: string;
        publicUrl: string;
      }>("/api/admin/images/presign", {
        method: "POST",
        body: JSON.stringify({
          courseId: courseId || "course-card",
          moduleId: "card-image",
          mimeType,
        }),
      });

      if (!presignRes.success || !presignRes.data?.uploadUrl) {
        throw new Error(presignRes.message ?? "Failed to get upload URL");
      }

      const { uploadUrl, imageKey } = presignRes.data;

      // Step 2: PUT to R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error uploading image")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", mimeType);
        xhr.send(file);
      });

      // Step 3: confirm
      const confirmRes = await api<{ imageKey: string; publicUrl: string; size: number }>(
        "/api/admin/images/confirm",
        { method: "POST", body: JSON.stringify({ imageKey }) }
      );

      if (!confirmRes.success || !confirmRes.data?.publicUrl) {
        throw new Error(confirmRes.message ?? "Upload confirmation failed");
      }

      onChange(confirmRes.data.publicUrl);
      setSourceLabel(file.name);
      setLinkDraft("");
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  const previewSrc = courseCardImagePreviewSrc(value);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        Course card image{required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        type="file"
        required={required && !value.trim()}
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        disabled={uploading}
        className="block w-full max-w-md text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-700 disabled:opacity-50"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void uploadToR2(f);
          e.target.value = "";
        }}
      />
      {uploading && (
        <p className="mt-1.5 text-xs font-medium text-amber-700">⏳ Uploading image to storage…</p>
      )}
      <p className="mt-2 text-xs font-medium text-slate-600">Or paste a Google Drive / image link</p>
      <div className="mt-1.5 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-start">
        <input
          type="url"
          value={linkDraft}
          onChange={(e) => {
            setLinkDraft(e.target.value);
            clearError();
          }}
          placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
        <button
          type="button"
          onClick={applyLink}
          className="shrink-0 rounded-lg border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-100"
        >
          Use link
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Google Drive image must be shared as &quot;Anyone with the link&quot;. You can also use a direct https image URL.
      </p>
      {localError ? <p className="mt-1 text-xs font-medium text-red-700">{localError}</p> : null}
      {previewSrc ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="h-32 w-64 overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-200 via-slate-100 to-indigo-100">
            <img src={previewSrc} alt="Course card preview" className="h-full w-full object-cover" />
          </div>
          <div className="text-xs text-slate-600">
            {sourceLabel ? <p className="font-medium text-slate-800">{sourceLabel}</p> : null}
            {!required ? (
              <button type="button" className="mt-1 font-semibold text-rose-700 hover:underline" onClick={removeImage}>
                Remove image
              </button>
            ) : (
              <p className="mt-1 text-slate-500">Replace using upload or a new link above.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          {required ? "Upload an image or paste a link — required for student course cards." : "No course card image set."}
        </p>
      )}
    </div>
  );
}
