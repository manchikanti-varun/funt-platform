export type PersistedContentFormat = "prosemirror-json" | "html" | "markdown";

export interface PersistedDocument {
  id: string;
  workspaceId: string;
  title: string;
  contentFormat: PersistedContentFormat;
  contentJson?: Record<string, unknown>;
  contentHtml?: string;
  contentMarkdown?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  version: number;
}

export interface PersistedMediaReference {
  id: string;
  documentId: string;
  provider: string;
  providerAssetId: string;
  url: string;
  kind: "image" | "video" | "pdf" | "file" | "embed";
  width?: number;
  height?: number;
  caption?: string;
}

export interface DocumentAutosaveDraft {
  id: string;
  documentId: string;
  contentJson: Record<string, unknown>;
  savedAt: string;
  editorSessionId: string;
}
