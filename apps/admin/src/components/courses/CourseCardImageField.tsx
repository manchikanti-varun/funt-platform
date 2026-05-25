"use client";

import { useEffect, useState } from "react";
import { readImageFileAsDataUrl } from "@/lib/readImageFileAsDataUrl";
import {
  courseCardImageLinkLabel,
  courseCardImagePreviewSrc,
  isValidCourseCardImageLink,
} from "@/lib/courseCardImage";

interface CourseCardImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
}

export function CourseCardImageField({ value, onChange, onError }: CourseCardImageFieldProps) {
  const [linkDraft, setLinkDraft] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [localError, setLocalError] = useState("");

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
    clearError();
    onChange("");
    setLinkDraft("");
    setSourceLabel("");
  }

  const previewSrc = courseCardImagePreviewSrc(value);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Course card image (optional)</label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="block w-full max-w-md text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-700"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void readImageFileAsDataUrl(f)
            .then((url) => {
              clearError();
              onChange(url);
              setLinkDraft("");
              setSourceLabel(f.name);
            })
            .catch((err: unknown) => reportError(err instanceof Error ? err.message : "Invalid image"));
          e.target.value = "";
        }}
      />
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
          <img src={previewSrc} alt="Course card preview" className="h-24 w-48 rounded-lg border border-slate-200 object-cover" />
          <div className="text-xs text-slate-600">
            {sourceLabel ? <p className="font-medium text-slate-800">{sourceLabel}</p> : null}
            <button type="button" className="mt-1 font-semibold text-rose-700 hover:underline" onClick={removeImage}>
              Remove image
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No course card image set.</p>
      )}
    </div>
  );
}
