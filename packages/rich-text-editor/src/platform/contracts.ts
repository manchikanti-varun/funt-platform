import type { Editor, Extension } from "@tiptap/core";

export type FeatureFlagKey =
  | "ai.assist"
  | "collaboration.realtime"
  | "comments.inline"
  | "media.advanced"
  | "tables.enterprise"
  | "blocks.education";

export interface FeatureFlags {
  isEnabled(key: FeatureFlagKey): boolean;
}

export interface EditorEventMap {
  "editor.ready": { editor: Editor };
  "editor.change": { html: string; json: unknown };
  "toolbar.command.executed": { commandId: string };
  "media.upload.started": { localId: string; fileName: string };
  "media.upload.progress": { localId: string; progress: number };
  "media.upload.completed": { localId: string; assetId: string; url: string };
  "media.upload.failed": { localId: string; error: string };
}

export type EventName = keyof EditorEventMap;

export interface EventBus {
  emit<K extends EventName>(event: K, payload: EditorEventMap[K]): void;
  on<K extends EventName>(event: K, listener: (payload: EditorEventMap[K]) => void): () => void;
}

export interface EditorPlugin {
  id: string;
  order?: number;
  extensions?: Extension[];
  onReady?: (editor: Editor) => void;
  onDestroy?: () => void;
}

export interface EditorThemeTokens {
  mode: "light" | "dark";
  radius: string;
  shadow: string;
  accent: string;
  background: string;
  foreground: string;
}

export interface EditorI18n {
  locale: string;
  t(key: string, fallback?: string): string;
}
