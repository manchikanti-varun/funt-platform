"use client";

import { useEffect, useRef } from "react";
import { RichTextEditor as RichTextEditorCore, type RichTextEditorApi } from "@funt-platform/rich-text-editor";

const EDITOR_BASE =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-teal-400 focus-within:shadow-md focus-within:shadow-teal-100/60";

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
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<RichTextEditorApi | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastEmittedHtmlRef = useRef(value ?? "");
  const isApplyingExternalRef = useRef(false);
  // Keep uploadVideo stable via ref so the editor doesn't need to be recreated
  const uploadVideoRef = useRef(uploadVideo);
  useEffect(() => { uploadVideoRef.current = uploadVideo; }, [uploadVideo]);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const editor = new RichTextEditorCore({
      content: value || "",
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
    });
    editor.init(mount);

    unsubRef.current = editor.onChange(({ html }) => {
      if (isApplyingExternalRef.current) return;
      lastEmittedHtmlRef.current = html;
      onChange(html);
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
  }, []);

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
