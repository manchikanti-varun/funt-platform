"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditor as RichTextEditorCore, type RichTextEditorApi } from "@funt-platform/rich-text-editor";
import { api } from "@/lib/api";

const EDITOR_BASE =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-indigo-400 focus-within:shadow-md focus-within:shadow-indigo-100/60";

/**
 * Replace r2:// video URLs in HTML with presigned playback URLs for editor display.
 * Returns a map of presignedUrl → r2Key for reverse mapping on change.
 */
async function resolveR2VideoUrls(html: string): Promise<{ resolved: string; urlMap: Map<string, string> }> {
  const r2Regex = /r2:\/\/[^"'<>\s]+/gi;
  const keys = [...new Set([...html.matchAll(r2Regex)].map((m) => m[0]))];
  const urlMap = new Map<string, string>(); // presignedUrl → r2Key
  if (keys.length === 0) return { resolved: html, urlMap };

  let result = html;
  for (const r2Key of keys) {
    try {
      const res = await api<{ previewUrl: string }>(`/api/admin/videos/preview?key=${encodeURIComponent(r2Key)}`);
      if (res.success && res.data?.previewUrl) {
        result = result.replaceAll(r2Key, res.data.previewUrl);
        urlMap.set(res.data.previewUrl, r2Key);
      }
    } catch {
      // Keep r2:// if preview fails
    }
  }
  return { resolved: result, urlMap };
}

/** Restore r2:// keys from presigned URLs in emitted HTML. */
function restoreR2Keys(html: string, urlMap: Map<string, string>): string {
  let result = html;
  for (const [presigned, r2Key] of urlMap) {
    result = result.replaceAll(presigned, r2Key);
  }
  return result;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  maxHeight?: number;
  placeholder?: string;
  className?: string;
  enableSlashCommands?: boolean;
  /**
   * When provided, a "Upload Video" button appears in the toolbar.
   * - `url`        — playable URL for in-editor preview (blob:, presigned, etc.)
   * - `storageUrl` — optional; the value stored in the HTML (e.g. "r2://...").
   *                  Falls back to `url` when omitted.
   */
  uploadVideo?: (file: File, onProgress: (pct: number) => void) => Promise<{ url: string; storageUrl?: string }>;
  /**
   * When provided, images inserted via file upload will be uploaded to R2
   * and the base64 placeholder replaced with the permanent URL.
   */
  uploadImage?: (file: File) => Promise<{ url: string; alt?: string }>;
}

export function RichTextEditor({
  value,
  onChange,
  minHeight = 120,
  maxHeight = 720,
  placeholder,
  className = "",
  enableSlashCommands = true,
  uploadVideo,
  uploadImage,
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<RichTextEditorApi | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastEmittedHtmlRef = useRef(value ?? "");
  const isApplyingExternalRef = useRef(false);
  const [resolvedContent, setResolvedContent] = useState<string | null>(null);
  const urlMapRef = useRef<Map<string, string>>(new Map());
  // Keep uploadVideo stable via ref so the editor doesn't need to be recreated
  const uploadVideoRef = useRef(uploadVideo);
  useEffect(() => { uploadVideoRef.current = uploadVideo; }, [uploadVideo]);
  // Keep uploadImage stable via ref so the editor doesn't need to be recreated
  const uploadImageRef = useRef(uploadImage);
  useEffect(() => { uploadImageRef.current = uploadImage; }, [uploadImage]);

  // Resolve r2:// video URLs on initial load
  useEffect(() => {
    const content = value || "";
    if (content.includes("r2://")) {
      resolveR2VideoUrls(content).then(({ resolved, urlMap }) => {
        urlMapRef.current = urlMap;
        setResolvedContent(resolved);
      });
    } else {
      setResolvedContent(content);
    }
  // Only on first mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resolvedContent === null) return; // Wait for resolution
    const mount = rootRef.current;
    if (!mount) return;

    const editor = new RichTextEditorCore({
      content: resolvedContent || "",
      placeholder,
      toolbarMode: "top",
      enableSlashCommands,
      maxHeight,
      contentMinHeight: Math.max(minHeight + 40, 180),
      // Proxy through the ref so the latest callback is always used
      ...(uploadVideo !== undefined
        ? {
            uploadVideo: (file: File, onProgress: (pct: number) => void) =>
              uploadVideoRef.current!(file, onProgress),
          }
        : {}),
      ...(uploadImage !== undefined
        ? {
            uploadImage: (file: File) =>
              uploadImageRef.current!(file),
          }
        : {}),
    });
    editor.init(mount);

    unsubRef.current = editor.onChange(({ html }) => {
      if (isApplyingExternalRef.current) return;
      // Restore r2:// keys that were replaced with presigned URLs for display
      const restored = urlMapRef.current.size > 0 ? restoreR2Keys(html, urlMapRef.current) : html;
      lastEmittedHtmlRef.current = restored;
      onChange(restored);
    });
    editorRef.current = editor;

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      editor.destroy();
      editorRef.current = null;
    };
  // uploadVideo intentionally excluded — handled via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedContent]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (isApplyingExternalRef.current) return;
    if (value === lastEmittedHtmlRef.current) return;
    isApplyingExternalRef.current = true;
    editor.setContent(value || "");
    lastEmittedHtmlRef.current = value || "";
    isApplyingExternalRef.current = false;
  }, [value]);

  return (
    <div className={`${EDITOR_BASE} ${className}`.trim()}>
      <div ref={rootRef} />
      <style jsx>{`
        div :global(.rte-toolbar) {
          padding: 12px;
          background: linear-gradient(to bottom, #f8fafc, #ffffff);
        }

        div :global(.rte-content) {
          padding: 16px 18px 22px;
        }

        div :global(.rte-prosemirror) {
          min-height: ${Math.max(minHeight - 40, 80)}px;
          padding: 4px 2px;
        }

        div :global(.rte-prosemirror p),
        div :global(.rte-prosemirror ul),
        div :global(.rte-prosemirror ol),
        div :global(.rte-prosemirror blockquote),
        div :global(.rte-prosemirror pre) {
          margin-left: 2px;
          margin-right: 2px;
        }

        div :global(.rte-prosemirror.is-editor-empty:first-child::before) {
          color: #94a3b8;
        }

        div :global(.rte-upload-progress) {
          color: #0d9488;
          font-style: italic;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
