"use client";

import { useEffect, useRef } from "react";
import { RichTextEditor as RichTextEditorCore, type RichTextEditorApi } from "@funt-platform/rich-text-editor";

const EDITOR_BASE = "rounded-xl overflow-hidden border border-slate-200 bg-white";

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  placeholder?: string;
  className?: string;
  enableSlashCommands?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  minHeight = 120,
  placeholder,
  className = "",
  enableSlashCommands = false
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<RichTextEditorApi | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastEmittedHtmlRef = useRef(value ?? "");
  const isApplyingExternalRef = useRef(false);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) {
      return;
    }
    const editor = new RichTextEditorCore({
      content: value || "",
      placeholder,
      toolbarMode: "top",
      enableSlashCommands
    });
    editor.init(mount);
    unsubRef.current = editor.onChange(({ html }) => {
      if (isApplyingExternalRef.current) {
        return;
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    if (isApplyingExternalRef.current) {
      return;
    }
    if (value === lastEmittedHtmlRef.current) {
      return;
    }
    isApplyingExternalRef.current = true;
    editor.setContent(value || "");
    lastEmittedHtmlRef.current = value || "";
    isApplyingExternalRef.current = false;
  }, [value]);

  return (
    <div className={`${EDITOR_BASE} ${className}`.trim()}>
      <div ref={rootRef} />
      <style jsx>{`
        div :global(.rte-prosemirror) {
          min-height: ${Math.max(minHeight - 40, 80)}px;
        }
      `}</style>
    </div>
  );
}
