# @funt-platform/rich-text-editor

Production-ready, framework-agnostic rich text editor built on Tiptap (ProseMirror).

## Features

- Bold, italic, underline, strike
- H1/H2/H3 headings
- Bullet + ordered lists
- Links (add/update/remove)
- Blockquote, code block, horizontal rule
- Image insertion with local preview and backend upload hook
- Optional slash-command menu (`/` at start of line)
- Undo/redo history
- HTML + JSON outputs
- HTML sanitization with DOMPurify

## Folder structure

```txt
packages/rich-text-editor/
  package.json
  tsconfig.json
  README.md
  src/
    editor.ts
    index.ts
    slashCommands.ts
    styles.css
    types.ts
  examples/
    basic/
      index.html
      main.ts
      styles.css
```

## Installation

From the monorepo root:

```bash
npm install
npm run build --workspace=@funt-platform/rich-text-editor
```

For external projects (standalone):

```bash
npm install @tiptap/core @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-image @tiptap/pm dompurify
```

## API

```ts
init(element: HTMLElement): void
getHTML(): string
getJSON(): object
setContent(content: string | object): void
onChange(callback): () => void
destroy(): void
```

## Example usage (simple HTML + TypeScript)

```ts
import { RichTextEditor } from "@funt-platform/rich-text-editor";
import "@funt-platform/rich-text-editor/styles.css";

const mount = document.getElementById("editor");
if (!mount) throw new Error("Missing #editor element");

const editor = new RichTextEditor({
  toolbarMode: "top",
  enableSlashCommands: true,
  uploadImage: async (file) => {
    // replace with your own backend endpoint
    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/uploads/images", { method: "POST", body });
    if (!response.ok) throw new Error("Upload failed");
    const data = (await response.json()) as { url: string };
    return { url: data.url, alt: file.name };
  }
});

editor.init(mount);

editor.onChange(({ html, json }) => {
  console.log("HTML", html);
  console.log("JSON", json);
});
```

## Security

- `getHTML()` sanitizes output by default with DOMPurify.
- Script/style/iframe tags and common event-handler attributes are blocked.
- Keep server-side sanitization enabled as defense-in-depth before persistence.
