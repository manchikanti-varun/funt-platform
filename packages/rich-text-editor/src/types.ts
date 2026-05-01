import type { JSONContent } from "@tiptap/core";

export type RichTextContent = string | JSONContent;

export type ToolbarMode = "top" | "floating";

export interface SlashCommandItem {
  id: string;
  label: string;
  description?: string;
  run: () => void;
}

export interface RichTextEditorOptions {
  content?: RichTextContent;
  placeholder?: string;
  toolbarMode?: ToolbarMode;
  enableSlashCommands?: boolean;
  sanitizeOnGet?: boolean;
  uploadImage?: (file: File) => Promise<{ url: string; alt?: string }>;
}

export interface RichTextEditorApi {
  init(element: HTMLElement): void;
  getHTML(): string;
  getJSON(): JSONContent;
  setContent(content: RichTextContent): void;
  onChange(callback: (payload: { html: string; json: JSONContent }) => void): () => void;
  destroy(): void;
}
