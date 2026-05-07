# @funt-platform/rich-text-editor

Enterprise LMS content-authoring platform built on TipTap/ProseMirror.

## Current architecture

This package now has two layers:

1. `RichTextEditor` (existing API): immediate backward compatibility for current Admin/LMS screens.
2. Enterprise platform primitives: plugin registry, toolbar registry, media-provider abstraction, collaboration/storage contracts, and an editor config builder (`createEnterpriseEditorConfig`).

## Core design goals

- Premium UX foundation (smooth typing, stable selection, keyboard-first command model)
- Provider-agnostic media architecture (Google Drive now, S3/Cloudinary/Supabase later)
- Plugin-first extension model for LMS-specific educational blocks
- Collaboration-ready contracts (Y.js/WebSocket integration layer)
- Structured persistence with ProseMirror JSON as source-of-truth

## Package structure

```txt
src/
  editor.ts                       # Backward-compatible editor implementation
  editorBuilder.ts                # Enterprise editor composition entrypoint
  platform/
    contracts.ts                  # Event bus, feature flags, plugin contracts, theme/i18n
    eventBus.ts                   # In-memory event bus implementation
    registry.ts                   # Plugin + toolbar registries
    defaultToolbarCommands.ts     # Seed command set for ribbon/command-palette UIs
  media/
    provider.ts                   # Provider contracts + registry
    googleDrive.ts                # Google Drive provider implementation
    googleDriveUtils.ts           # URL/fileId/preview/thumbnail utility helpers
  blocks/
    types.ts                      # LMS educational block contracts
  collaboration/
    types.ts                      # Presence/comments/version contracts
  storage/
    types.ts                      # Document/media/draft persistence contracts
```

## Media provider architecture

```ts
interface MediaProvider {
  id: string;
  upload(input: { file: File; signal?: AbortSignal; onProgress?: (p: number) => void }): Promise<MediaAsset>;
  delete(assetId: string): Promise<void>;
  getPreview(url: string): string;
  validate(file: File): { ok: boolean; reason?: string };
}
```

Implemented now:

- `GoogleDriveProvider`
- `extractGoogleDriveFileId()`
- `toGoogleDrivePreviewUrl()`
- `toGoogleDriveThumbnailUrl()`

Migration path:

- Build `S3Provider` / `CloudinaryProvider` / `SupabaseStorageProvider` implementing the same interface.
- Keep UI + editor commands unchanged; only swap provider registration at bootstrap.

## Plugin + toolbar system

- `PluginRegistry` for extension-level plugins and lifecycle hooks.
- `ToolbarRegistry` for grouped, searchable, keyboard-hinted command metadata.
- `createDefaultToolbarCommands(editor)` as baseline for floating toolbar, bubble menu, ribbon, and command palette.

## Collaboration architecture (contracts)

- Presence: user cursors, names, colors
- Comments: anchored threads
- Version snapshots: timeline checkpoints
- Config contract for Y.js + websocket room negotiation

Implementation recommendation:

- `y-prosemirror` + `y-websocket` (or custom ws transport with awareness channel)
- Server authoritative persistence snapshots every N operations + periodic checkpoints
- Client optimistic UX with conflict-free CRDT merge

## Storage architecture recommendation

Use **ProseMirror JSON** as primary document format.

- Primary: `contentJson` (`prosemirror-json`)
- Derived caches: sanitized HTML (read-optimized), optional markdown export
- Persist media refs in dedicated table for lifecycle management and analytics

Tradeoffs:

- HTML only: easy render, weak structure and migrations
- PM JSON: best for editor fidelity, collaboration, and schema evolution
- Markdown hybrid: good interoperability, weaker custom block expressiveness
- Block JSON only: easy custom blocks, but loses mature rich-text semantics without heavy custom engine

## Database schema blueprint (suggested)

- `documents`: id, workspaceId, title, contentJson, version, publishedAt, audit columns
- `document_drafts`: documentId, editorSessionId, contentJson, savedAt
- `document_versions`: documentId, versionLabel, contentJson, createdBy, createdAt
- `media_references`: documentId, provider, providerAssetId, url, kind, dimensions, caption
- `comments`: documentId, anchorFrom, anchorTo, resolved, createdBy, createdAt
- `comment_messages`: commentId, body, createdBy, createdAt
- `collaboration_presence` (ephemeral/cache): documentId, userId, cursor range, heartbeatAt

## API and integration blueprint

- `POST /documents` create draft
- `GET /documents/:id` fetch document + latest snapshot
- `PATCH /documents/:id/content` persist PM JSON
- `POST /documents/:id/media` provider upload proxy + validation
- `POST /documents/:id/versions` manual checkpoint
- `POST /documents/:id/comments`
- `WS /collab/:documentId` Y.js updates + awareness

## Example enterprise bootstrap

```ts
import { createEnterpriseEditorConfig, DefaultMediaProviderRegistry, GoogleDriveProvider } from "@funt-platform/rich-text-editor";

const mediaProviders = new DefaultMediaProviderRegistry();
mediaProviders.register(new GoogleDriveProvider(googleDriveClient));

const enterprise = createEnterpriseEditorConfig({
  mediaProviders,
  featureFlags: {
    isEnabled(key) {
      return key !== "ai.assist";
    },
  },
});

// pass enterprise.extensions into TipTap Editor init
// use enterprise.context.toolbarRegistry for toolbar/command palette UI
```

## Implementation phases

1. MVP+ (now): provider abstraction, command/toolbar registry, PM JSON contracts
2. Authoring blocks: educational NodeViews (`Callout`, `QuizPlaceholder`, `Assignment`, `ResourceList`)
3. Premium UX: bubble/floating/ribbon toolbars, drag handles, media overlays
4. Collaboration: Y.js + comments + version history UI
5. Enterprise scale: analytics, plugin marketplace model, cross-app theming and feature flags

## Security baseline

- Client-side sanitization for rendering convenience
- Server-side sanitization required before persistence/publish
- MIME/type/size validation before upload
- Secure iframe allowlist for embeds (YouTube/Vimeo/Loom/Drive)
- CSP-compatible rendering for media and embed blocks
