import type { JSONContent } from "@tiptap/core";

export type RichTextContent = string | JSONContent;

export type ToolbarMode = "top" | "floating";

export interface SlashCommandItem {
  id: string;
  label: string;
  description?: string;
  group?: string;
  keywords?: string[];
  icon?: string;
  run: () => void;
}

export interface EditorStats {
  words: number;
  characters: number;
  readingTimeMinutes: number;
  selectedWords: number;
}

export interface RichTextEditorOptions {
  content?: RichTextContent;
  placeholder?: string;
  toolbarMode?: ToolbarMode;
  enableSlashCommands?: boolean;
  sanitizeOnGet?: boolean;
  maxHeight?: number;
  contentMinHeight?: number;
  /** Called when user clicks "Upload Video" in the toolbar. Upload the file and return a playable URL. */
  uploadVideo?: (file: File, onProgress: (pct: number) => void) => Promise<{ url: string }>;
  uploadImage?: (file: File) => Promise<{ url: string; alt?: string }>;
}

export interface RichTextEditorApi {
  init(element: HTMLElement): void;
  getHTML(): string;
  getJSON(): JSONContent;
  setContent(content: RichTextContent): void;
  onChange(callback: (payload: { html: string; json: JSONContent }) => void): () => void;
  getStats(): EditorStats;
  destroy(): void;
}
