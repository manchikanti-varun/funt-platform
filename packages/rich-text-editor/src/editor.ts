import { Editor, Extension, JSONContent, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import DOMPurify from "dompurify";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { sinkListItem, liftListItem } from "@tiptap/pm/schema-list";
import {
  createIcons,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Quote,
  Code2,
  Minus,
  Plus,
  Trash2,
  ImagePlus,
  Video,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronsRight,
  ChevronsLeft,
  Undo2,
  Redo2
} from "lucide";
import { SlashCommandsExtension } from "./slashCommands.js";
import type { RichTextContent, RichTextEditorApi, RichTextEditorOptions, SlashCommandItem } from "./types.js";

const TOOLBAR_ACTIONS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strike",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  bulletList: "bulletList",
  orderedList: "orderedList",
  link: "link",
  blockquote: "blockquote",
  codeBlock: "codeBlock",
  divider: "divider",
  image: "image",
  video: "video",
  alignLeft: "alignLeft",
  alignCenter: "alignCenter",
  alignRight: "alignRight",
  alignJustify: "alignJustify",
  indent: "indent",
  outdent: "outdent",
  undo: "undo",
  redo: "redo"
} as const;

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
const ICONS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikethrough",
  h1: "heading-1",
  h2: "heading-2",
  h3: "heading-3",
  bulletList: "list",
  orderedList: "list-ordered",
  link: "link-2",
  blockquote: "quote",
  codeBlock: "code-2",
  divider: "minus",
  image: "image-plus",
  video: "video",
  alignLeft: "align-left",
  alignCenter: "align-center",
  alignRight: "align-right",
  alignJustify: "align-justify",
  indent: "chevrons-right",
  outdent: "chevrons-left",
  undo: "undo-2",
  redo: "redo-2"
} as const;
const FONT_OPTIONS = [
  { label: "Sans", value: "" },
  { label: "Serif", value: "Georgia, Cambria, 'Times New Roman', Times, serif" },
  { label: "Mono", value: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace" },
  { label: "Inter", value: "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Poppins", value: "Poppins, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Montserrat", value: "Montserrat, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Lato", value: "Lato, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Nunito", value: "Nunito, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Roboto Slab", value: "'Roboto Slab', Rockwell, 'Times New Roman', serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, 'Times New Roman', serif" },
  { label: "Playfair", value: "'Playfair Display', Georgia, 'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Source Code", value: "'Source Code Pro', Menlo, Monaco, Consolas, monospace" },
  { label: "Display", value: "'Trebuchet MS', 'Gill Sans', 'Segoe UI', sans-serif" },
  { label: "System UI", value: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }
] as const;

type VideoAlign = "left" | "center" | "right";
type MediaKind = "image" | "video";

function normalizeVideoAlign(value: unknown): VideoAlign {
  return value === "left" || value === "right" ? value : "center";
}

type MediaRenderKind = "video" | "embed";

function normalizeVideoWidthPct(value: unknown): number {
  const num = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(num)) return 80;
  return Math.min(100, Math.max(20, Math.round(num)));
}

function inferRenderKind(src: string): MediaRenderKind {
  const value = src.trim().toLowerCase();
  if (!value) return "video";
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(value)) return "video";
  if (value.includes("youtube.com") || value.includes("youtu.be") || value.includes("vimeo.com")) return "embed";
  // Default to embed for non-file URLs to maximize playability.
  return "embed";
}

function toEmbeddableVideoUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host.includes("youtu.be")) {
    const id = path.split("/").filter(Boolean)[0];
    if (!id) return raw;
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host.includes("youtube.com")) {
    const parts = path.split("/").filter(Boolean);
    const watchId = url.searchParams.get("v");
    const embedId = parts[0] === "embed" ? parts[1] : "";
    const shortsId = parts[0] === "shorts" ? parts[1] : "";
    const id = watchId || embedId || shortsId;
    if (!id) return raw;
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host.includes("vimeo.com")) {
    const id = path.split("/").filter(Boolean).pop();
    if (!id) return raw;
    return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
  }
  return raw;
}

function videoClassName(align: VideoAlign, existingClass?: string): string {
  const classes = [existingClass, "rte-video", `rte-video-align-${align}`]
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter((cls, idx, arr) => arr.indexOf(cls) === idx);
  return classes.join(" ");
}

function imageClassName(align: VideoAlign, existingClass?: string): string {
  const classes = [existingClass, "rte-image", `rte-image-align-${align}`]
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter((cls, idx, arr) => arr.indexOf(cls) === idx);
  return classes.join(" ");
}

const CustomImage = Image.extend({
  addAttributes() {
    const parentAttrs = typeof this.parent === "function" ? this.parent() : {};
    return {
      ...parentAttrs,
      widthPct: {
        default: 80,
        parseHTML: (element: Element) => normalizeVideoWidthPct(element.getAttribute("data-width")),
      },
      align: {
        default: "center",
        parseHTML: (element: Element) => normalizeVideoAlign(element.getAttribute("data-align")),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const widthPct = normalizeVideoWidthPct(HTMLAttributes.widthPct);
    const align = normalizeVideoAlign(HTMLAttributes.align);
    const mergedClass = imageClassName(
      align,
      typeof HTMLAttributes.class === "string" ? HTMLAttributes.class : ""
    );
    return [
      "img",
      mergeAttributes(
        { "data-width": String(widthPct), "data-align": align, class: mergedClass, style: `width:${widthPct}%;` },
        HTMLAttributes
      ),
    ];
  },
});

const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      renderKind: {
        default: "video",
        parseHTML: (element) => {
          const fromAttr = element.getAttribute("data-render-kind");
          return fromAttr === "embed" ? "embed" : "video";
        },
      },
      widthPct: {
        default: 80,
        parseHTML: (element) => normalizeVideoWidthPct(element.getAttribute("data-width"))
      },
      align: {
        default: "center",
        parseHTML: (element) => normalizeVideoAlign(element.getAttribute("data-align"))
      }
    };
  },
  parseHTML() {
    return [
      { tag: "video[src]" },
      { tag: "iframe[data-rte-video='true'][src]" },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const widthPct = normalizeVideoWidthPct(HTMLAttributes.widthPct);
    const align = normalizeVideoAlign(HTMLAttributes.align);
    const renderKind = HTMLAttributes.renderKind === "embed" ? "embed" : "video";
    const mergedClass = videoClassName(align, typeof HTMLAttributes.class === "string" ? HTMLAttributes.class : "");
    if (renderKind === "embed") {
      const embedSrc = toEmbeddableVideoUrl(String(HTMLAttributes.src ?? ""));
      const { src: _ignoredSrc, controls: _ignoredControls, ...restAttrs } = HTMLAttributes as Record<string, unknown>;
      return [
        "iframe",
        mergeAttributes(
          restAttrs,
          {
            src: embedSrc,
            "data-rte-video": "true",
            "data-render-kind": "embed",
            "data-width": String(widthPct),
            "data-align": align,
            class: `${mergedClass} rte-video-embed`,
            style: `width:${widthPct}%;aspect-ratio:16/9;`,
            frameborder: "0",
            allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
            allowfullscreen: "true",
            loading: "lazy",
            referrerpolicy: "strict-origin-when-cross-origin",
            title: "Embedded video",
          }
        ),
      ];
    }
    return [
      "video",
      mergeAttributes(
        {
          controls: "true",
          "data-render-kind": "video",
          "data-width": String(widthPct),
          "data-align": align,
          class: mergedClass,
          style: `width:${widthPct}%;`,
        },
        HTMLAttributes
      ),
    ];
  }
});

export class RichTextEditor implements RichTextEditorApi {
  private editor: Editor | null = null;
  private root: HTMLElement | null = null;
  private toolbar!: HTMLElement;
  private contentArea!: HTMLElement;
  private slashMenu!: HTMLElement;
  private resizeOverlay: HTMLDivElement | null = null;
  private mediaEditBar: HTMLDivElement | null = null;
  private fontSelect: HTMLSelectElement | null = null;
  private changeCallbacks = new Set<(payload: { html: string; json: JSONContent }) => void>();
  private options: Required<Omit<RichTextEditorOptions, "content" | "uploadImage">> &
    Pick<RichTextEditorOptions, "content" | "uploadImage">;

  constructor(options: RichTextEditorOptions = {}) {
    this.options = {
      content: options.content ?? EMPTY_DOC,
      placeholder: options.placeholder ?? "Write something...",
      toolbarMode: options.toolbarMode ?? "top",
      enableSlashCommands: options.enableSlashCommands ?? false,
      sanitizeOnGet: options.sanitizeOnGet ?? true,
      uploadImage: options.uploadImage
    };
  }

  init(element: HTMLElement): void {
    if (this.editor) {
      this.destroy();
    }
    this.root = element;
    this.root.innerHTML = "";
    this.root.classList.add("rte-shell");

    this.toolbar = this.createToolbar();
    this.contentArea = document.createElement("div");
    this.contentArea.className = "rte-content";
    this.resizeOverlay = document.createElement("div");
    this.resizeOverlay.className = "rte-media-resize-overlay hidden";
    this.resizeOverlay.innerHTML = `
      <button type="button" class="rte-media-handle" data-dir="nw" aria-label="Resize top left"></button>
      <button type="button" class="rte-media-handle" data-dir="n" aria-label="Resize top"></button>
      <button type="button" class="rte-media-handle" data-dir="ne" aria-label="Resize top right"></button>
      <button type="button" class="rte-media-handle" data-dir="e" aria-label="Resize right"></button>
      <button type="button" class="rte-media-handle" data-dir="se" aria-label="Resize bottom right"></button>
      <button type="button" class="rte-media-handle" data-dir="s" aria-label="Resize bottom"></button>
      <button type="button" class="rte-media-handle" data-dir="sw" aria-label="Resize bottom left"></button>
      <button type="button" class="rte-media-handle" data-dir="w" aria-label="Resize left"></button>
    `;
    this.mediaEditBar = document.createElement("div");
    this.mediaEditBar.className = "rte-media-editbar hidden";
    this.mediaEditBar.innerHTML = `
      <button type="button" class="rte-media-edit-btn" data-media-action="shrink" title="Shrink media">
        ${this.iconMarkup("minus")}
      </button>
      <input type="range" class="rte-media-edit-range" min="20" max="100" step="1" value="80" aria-label="Media width slider" />
      <button type="button" class="rte-media-edit-btn" data-media-action="grow" title="Grow media">
        ${this.iconMarkup("plus")}
      </button>
      <button type="button" class="rte-media-edit-btn" data-media-action="align-left" title="Align media left">
        ${this.iconMarkup("align-left")}
      </button>
      <button type="button" class="rte-media-edit-btn" data-media-action="align-center" title="Align media center">
        ${this.iconMarkup("align-center")}
      </button>
      <button type="button" class="rte-media-edit-btn" data-media-action="align-right" title="Align media right">
        ${this.iconMarkup("align-right")}
      </button>
      <button type="button" class="rte-media-edit-btn danger" data-media-action="remove" title="Remove media">
        ${this.iconMarkup("trash-2")}
      </button>
    `;
    this.slashMenu = document.createElement("div");
    this.slashMenu.className = "rte-slash-menu hidden";

    this.contentArea.appendChild(this.resizeOverlay);
    this.contentArea.appendChild(this.mediaEditBar);
    this.root.append(this.toolbar, this.contentArea, this.slashMenu);
    this.hydrateToolbarIcons();
    this.bindResizeHandles();
    this.bindMediaEditBar();

    const self = this;
    const TabBehaviorExtension = Extension.create({
      name: "tabBehavior",
      addKeyboardShortcuts() {
        return {
          Tab: () => self.handleTabPress(false),
          "Shift-Tab": () => self.handleTabPress(true),
        };
      },
    });

    this.editor = new Editor({
      element: this.contentArea,
      content: this.options.content,
      extensions: [
        TabBehaviorExtension,
        StarterKit.configure({
          heading: { levels: [1, 2, 3] }
        }),
        TextStyle,
        FontFamily.configure({ types: ["textStyle"] }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        CustomImage.configure({ allowBase64: true }),
        VideoNode,
        ...(this.options.enableSlashCommands
          ? [SlashCommandsExtension.configure({ onStateChange: this.renderSlashMenu })]
          : [])
      ],
      editorProps: {
        attributes: {
          class: "rte-prosemirror",
          "data-placeholder": this.options.placeholder
        },
      },
      onUpdate: ({ editor }) => {
        this.updateToolbarState();
        const payload = {
          html: this.getUnsafeHTML(),
          json: editor.getJSON()
        };
        this.changeCallbacks.forEach((callback) => callback(payload));
      },
      onSelectionUpdate: () => this.updateToolbarState()
    });

    this.toolbar.classList.toggle("floating", this.options.toolbarMode === "floating");
    this.updateToolbarState();
    this.contentArea.addEventListener("scroll", this.updateResizeOverlayPosition, { passive: true });
    this.contentArea.addEventListener("mousedown", this.handleContentMouseDown);
    this.contentArea.addEventListener("keydown", this.handleEditorKeyDown, true);
    this.root.ownerDocument.addEventListener("keydown", this.handleDocumentKeyDown, true);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.updateResizeOverlayPosition);
    }
  }

  getHTML(): string {
    const html = this.getUnsafeHTML();
    if (!this.options.sanitizeOnGet) {
      return html;
    }
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style", "iframe"],
      FORBID_ATTR: ["onerror", "onload", "onclick"]
    });
  }

  private getUnsafeHTML(): string {
    if (!this.editor) {
      return "";
    }
    return this.editor.getHTML();
  }

  getJSON(): JSONContent {
    return this.editor?.getJSON() ?? EMPTY_DOC;
  }

  setContent(content: RichTextContent): void {
    this.editor?.commands.setContent(content, true);
  }

  onChange(callback: (payload: { html: string; json: JSONContent }) => void): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  destroy(): void {
    this.editor?.destroy();
    this.editor = null;
    this.changeCallbacks.clear();
    this.contentArea?.removeEventListener("scroll", this.updateResizeOverlayPosition);
    this.contentArea?.removeEventListener("mousedown", this.handleContentMouseDown);
    this.contentArea?.removeEventListener("keydown", this.handleEditorKeyDown, true);
    this.root?.ownerDocument.removeEventListener("keydown", this.handleDocumentKeyDown, true);
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.updateResizeOverlayPosition);
    }
    if (this.root) {
      this.root.innerHTML = "";
    }
    this.root = null;
    this.resizeOverlay = null;
  }

  private bindResizeHandles(): void {
    if (!this.resizeOverlay) return;
    const handles = this.resizeOverlay.querySelectorAll<HTMLButtonElement>(".rte-media-handle");
    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const dir = handle.dataset.dir ?? "";
        this.startResizeDrag(event.clientX, event.clientY, dir);
      });
    });
  }

  private bindMediaEditBar(): void {
    if (!this.mediaEditBar) return;
    const range = this.mediaEditBar.querySelector<HTMLInputElement>(".rte-media-edit-range");
    range?.addEventListener("input", () => {
      const widthPct = normalizeVideoWidthPct(range.value);
      this.setSelectedMediaAttrs({ widthPct }, { silentWhenNoSelection: true });
    });
    this.mediaEditBar.querySelectorAll<HTMLButtonElement>(".rte-media-edit-btn").forEach((btn) => {
      btn.addEventListener("mousedown", (event) => event.preventDefault());
      btn.addEventListener("click", () => {
        const action = btn.dataset.mediaAction ?? "";
        if (action === "shrink") this.bumpSelectedMediaWidth(-5);
        if (action === "grow") this.bumpSelectedMediaWidth(5);
        if (action === "align-left") this.setSelectedMediaAttrs({ align: "left" }, { silentWhenNoSelection: true });
        if (action === "align-center") this.setSelectedMediaAttrs({ align: "center" }, { silentWhenNoSelection: true });
        if (action === "align-right") this.setSelectedMediaAttrs({ align: "right" }, { silentWhenNoSelection: true });
        if (action === "remove") this.removeSelectedMedia();
      });
    });
  }

  private bumpSelectedMediaWidth(delta: number): void {
    const selected = this.getSelectedMediaNode();
    if (!selected) return;
    const current = normalizeVideoWidthPct(selected.node.attrs.widthPct);
    this.setSelectedMediaAttrs({ widthPct: current + delta }, { silentWhenNoSelection: true });
  }

  private removeSelectedMedia(): void {
    if (!this.editor) return;
    const selected = this.getSelectedMediaNode();
    if (!selected) return;
    this.editor.commands.command(({ tr }) => {
      tr.delete(selected.pos, selected.pos + 1);
      return true;
    });
    this.updateResizeOverlayPosition();
  }

  private handleContentMouseDown = (event: MouseEvent): void => {
    if (!this.editor || !this.contentArea) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const mediaEl = target.closest("img, video, iframe");
    if (!(mediaEl instanceof HTMLElement) || !this.contentArea.contains(mediaEl)) return;
    const pos = this.editor.view.posAtDOM(mediaEl, 0);
    this.editor.chain().focus().setNodeSelection(pos).run();
    this.updateResizeOverlayPosition();
  };

  private handleEditorKeyDown = (event: KeyboardEvent): void => {
    if (!this.editor || !this.isTabKey(event)) return;
    event.preventDefault();
    this.handleTabPress(event.shiftKey);
  };

  private handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.editor || !this.contentArea || !this.isTabKey(event)) return;
    const target = event.target;
    const isInsideEditorTarget = !!target && target instanceof globalThis.Node && this.contentArea.contains(target);
    const hasEditorFocus = this.editor.isFocused || this.editor.view.hasFocus();
    const hasEditorSelection = this.hasActiveSelectionInsideEditor();
    if (!isInsideEditorTarget && !hasEditorFocus && !hasEditorSelection) return;
    event.preventDefault();
    this.handleTabPress(event.shiftKey);
  };

  private isTabKey(event: KeyboardEvent): boolean {
    return event.key === "Tab" || event.code === "Tab" || event.keyCode === 9;
  }

  private hasActiveSelectionInsideEditor(): boolean {
    if (!this.contentArea || typeof window === "undefined") return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const anchor = selection.anchorNode;
    const focus = selection.focusNode;
    const anchorInside = !!anchor && this.contentArea.contains(anchor);
    const focusInside = !!focus && this.contentArea.contains(focus);
    return anchorInside || focusInside;
  }

  private handleTabPress(shiftKey: boolean): boolean {
    if (!this.editor) return false;
    const { from, to } = this.editor.state.selection;
    const hasRangeSelection = from !== to;
    const hasListItemsInSelection = this.selectionContainsListItems();

    if (this.editor.isActive("bulletList") || this.editor.isActive("orderedList") || hasListItemsInSelection) {
      this.adjustSelectedListItemsIndent(shiftKey ? "outdent" : "indent");
      return true;
    }

    if (hasRangeSelection) {
      if (!shiftKey) this.indentSelectedTextBlocks();
      return true;
    }

    if (!shiftKey) {
      this.editor.chain().focus().insertContent("\u00A0\u00A0\u00A0\u00A0").run();
    }
    return true;
  }

  private indentSelectedTextBlocks(): void {
    if (!this.editor) return;
    const { state, view } = this.editor;
    const { from, to } = state.selection;
    if (from === to) return;

    const blockStarts: number[] = [];
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock) {
        blockStarts.push(pos + 1);
      }
      return true;
    });
    if (blockStarts.length === 0) return;

    const tr = state.tr;
    const indent = "\u00A0\u00A0\u00A0\u00A0";
    for (let i = blockStarts.length - 1; i >= 0; i -= 1) {
      const start = blockStarts[i];
      tr.insertText(indent, start, start);
    }
    view.dispatch(tr);
  }

  private adjustSelectedListItemsIndent(mode: "indent" | "outdent"): void {
    if (!this.editor) return;
    const { view } = this.editor;
    const listItemType = view.state.schema.nodes.listItem;
    if (!listItemType) return;

    // Let ProseMirror handle the current range selection natively.
    if (mode === "outdent") {
      liftListItem(listItemType)(view.state, view.dispatch);
      return;
    }
    const didIndentSelection = sinkListItem(listItemType)(view.state, view.dispatch);
    if (didIndentSelection) return;

    // Fallback for range selections:
    // indent selected siblings top-to-bottom and attempt every selected item.
    const { from, to } = view.state.selection;
    const positionsSet = new Set<number>();
    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "listItem") positionsSet.add(pos);
      return true;
    });
    const positions = Array.from(positionsSet).sort((a, b) => a - b);
    if (positions.length === 0) return;

    for (const pos of positions) {
      const mappedPos = view.state.tr.mapping.map(pos, -1);
      const safePos = Math.max(1, Math.min(mappedPos + 1, view.state.doc.content.size - 1));
      const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(safePos), 1));
      view.dispatch(tr);
      sinkListItem(listItemType)(view.state, view.dispatch);
    }
  }

  private selectionContainsListItems(): boolean {
    if (!this.editor) return false;
    const { from, to } = this.editor.state.selection;
    let hasList = false;
    this.editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name === "listItem") {
        hasList = true;
        return false;
      }
      return true;
    });
    return hasList;
  }

  private startResizeDrag(startX: number, startY: number, dir: string): void {
    const selected = this.getSelectedMediaNode();
    if (!selected || !this.contentArea) return;
    const baseWidthPct = normalizeVideoWidthPct(selected.node.attrs.widthPct);
    const baseWidthPx = (baseWidthPct / 100) * this.contentArea.clientWidth;
    const hasHorizontal = dir.includes("e") || dir.includes("w");
    const hasVertical = dir.includes("n") || dir.includes("s");
    const hSign = dir.includes("w") ? -1 : 1;
    const vSign = dir.includes("n") ? -1 : 1;

    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - startX) * hSign;
      const dy = (e.clientY - startY) * vSign;
      let delta = 0;
      if (hasHorizontal && hasVertical) {
        delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      } else if (hasHorizontal) {
        delta = dx;
      } else if (hasVertical) {
        delta = dy;
      }
      const nextPx = Math.max(40, baseWidthPx + delta);
      const nextPct = Math.min(100, Math.max(20, Math.round((nextPx / this.contentArea!.clientWidth) * 100)));
      this.setSelectedMediaAttrs({ widthPct: nextPct }, { silentWhenNoSelection: true });
      this.updateResizeOverlayPosition();
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  private updateResizeOverlayPosition = (): void => {
    if (!this.resizeOverlay || !this.editor || !this.contentArea) return;
    const selected = this.getSelectedMediaNode();
    if (!selected) {
      this.resizeOverlay.classList.add("hidden");
      this.mediaEditBar?.classList.add("hidden");
      return;
    }
    const dom = this.editor.view.nodeDOM(selected.pos);
    if (!(dom instanceof HTMLElement)) {
      this.resizeOverlay.classList.add("hidden");
      this.mediaEditBar?.classList.add("hidden");
      return;
    }
    const mediaEl = dom.closest("img, video, iframe") ?? dom;
    if (!(mediaEl instanceof HTMLElement)) {
      this.resizeOverlay.classList.add("hidden");
      this.mediaEditBar?.classList.add("hidden");
      return;
    }
    const contentRect = this.contentArea.getBoundingClientRect();
    const mediaRect = mediaEl.getBoundingClientRect();
    const left = mediaRect.left - contentRect.left + this.contentArea.scrollLeft;
    const top = mediaRect.top - contentRect.top + this.contentArea.scrollTop;
    this.resizeOverlay.style.left = `${left}px`;
    this.resizeOverlay.style.top = `${top}px`;
    this.resizeOverlay.style.width = `${mediaRect.width}px`;
    this.resizeOverlay.style.height = `${mediaRect.height}px`;
    this.resizeOverlay.classList.remove("hidden");
    if (this.mediaEditBar) {
      this.mediaEditBar.style.left = `${left}px`;
      this.mediaEditBar.style.top = `${Math.max(0, top - 42)}px`;
      const range = this.mediaEditBar.querySelector<HTMLInputElement>(".rte-media-edit-range");
      if (range) range.value = String(normalizeVideoWidthPct(selected.node.attrs.widthPct));
      this.mediaEditBar.classList.remove("hidden");
    }
  };

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement("div");
    toolbar.className = "rte-toolbar";
    this.fontSelect = this.createFontFamilySelect();
    toolbar.append(
      this.fontSelect,
      this.separator(),
      this.button(this.iconMarkup(ICONS.bold), "Bold", TOOLBAR_ACTIONS.bold),
      this.button(this.iconMarkup(ICONS.italic), "Italic", TOOLBAR_ACTIONS.italic),
      this.button(this.iconMarkup(ICONS.underline), "Underline", TOOLBAR_ACTIONS.underline),
      this.button(this.iconMarkup(ICONS.strike), "Strike", TOOLBAR_ACTIONS.strike),
      this.separator(),
      this.button(this.iconMarkup(ICONS.h1), "Heading 1", TOOLBAR_ACTIONS.h1),
      this.button(this.iconMarkup(ICONS.h2), "Heading 2", TOOLBAR_ACTIONS.h2),
      this.button(this.iconMarkup(ICONS.h3), "Heading 3", TOOLBAR_ACTIONS.h3),
      this.separator(),
      this.button(this.iconMarkup(ICONS.bulletList), "Bullet list", TOOLBAR_ACTIONS.bulletList),
      this.button(this.iconMarkup(ICONS.orderedList), "Numbered list", TOOLBAR_ACTIONS.orderedList),
      this.button(this.iconMarkup(ICONS.link), "Link", TOOLBAR_ACTIONS.link),
      this.button(this.iconMarkup(ICONS.blockquote), "Blockquote", TOOLBAR_ACTIONS.blockquote),
      this.button(this.iconMarkup(ICONS.codeBlock), "Code block", TOOLBAR_ACTIONS.codeBlock),
      this.button(this.iconMarkup(ICONS.divider), "Divider", TOOLBAR_ACTIONS.divider),
      this.button(this.iconMarkup(ICONS.image), "Image", TOOLBAR_ACTIONS.image),
      this.button(this.iconMarkup(ICONS.video), "Video URL", TOOLBAR_ACTIONS.video),
      this.separator(),
      this.button(this.iconMarkup(ICONS.alignLeft), "Align left", TOOLBAR_ACTIONS.alignLeft),
      this.button(this.iconMarkup(ICONS.alignCenter), "Align center", TOOLBAR_ACTIONS.alignCenter),
      this.button(this.iconMarkup(ICONS.alignRight), "Align right", TOOLBAR_ACTIONS.alignRight),
      this.button(this.iconMarkup(ICONS.alignJustify), "Align justify", TOOLBAR_ACTIONS.alignJustify),
      this.button(this.iconMarkup(ICONS.indent), "Indent", TOOLBAR_ACTIONS.indent),
      this.button(this.iconMarkup(ICONS.outdent), "Outdent", TOOLBAR_ACTIONS.outdent),
      this.separator(),
      this.button(this.iconMarkup(ICONS.undo), "Undo", TOOLBAR_ACTIONS.undo),
      this.button(this.iconMarkup(ICONS.redo), "Redo", TOOLBAR_ACTIONS.redo)
    );
    return toolbar;
  }

  private iconMarkup(name: string): string {
    return `<i data-lucide="${name}" aria-hidden="true"></i>`;
  }

  private hydrateToolbarIcons(): void {
    createIcons({
      attrs: { width: "17", height: "17", "stroke-width": "2" },
      icons: {
        Bold,
        Italic,
        Underline: UnderlineIcon,
        Strikethrough,
        Heading1,
        Heading2,
        Heading3,
        List,
        ListOrdered,
        Link2,
        Quote,
        Code2,
        Minus,
        Plus,
        Trash2,
        ImagePlus,
        Video,
        AlignLeft,
        AlignCenter,
        AlignRight,
        AlignJustify,
        ChevronsRight,
        ChevronsLeft,
        Undo2,
        Redo2
      }
    });
  }

  private createFontFamilySelect(): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "rte-font-select";
    select.setAttribute("aria-label", "Font family");
    FONT_OPTIONS.forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    });
    select.addEventListener("change", () => {
      if (!this.editor) return;
      const selected = select.value;
      const chain = this.editor.chain().focus();
      if (!selected) {
        chain.unsetFontFamily().run();
        return;
      }
      chain.setFontFamily(selected).run();
    });
    return select;
  }

  private button(
    iconMarkup: string,
    title: string,
    action: (typeof TOOLBAR_ACTIONS)[keyof typeof TOOLBAR_ACTIONS]
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rte-btn";
    btn.dataset.action = action;
    btn.setAttribute("aria-label", title);
    btn.title = title;
    btn.innerHTML = iconMarkup;
    // Preserve editor selection while clicking toolbar controls.
    btn.addEventListener("mousedown", (event) => event.preventDefault());
    btn.addEventListener("click", () => this.handleToolbarAction(action));
    return btn;
  }

  private separator(): HTMLElement {
    const line = document.createElement("span");
    line.className = "rte-separator";
    return line;
  }

  private async handleToolbarAction(action: (typeof TOOLBAR_ACTIONS)[keyof typeof TOOLBAR_ACTIONS]): Promise<void> {
    const chain = this.editor?.chain().focus();
    if (!chain || !this.editor) {
      return;
    }
    switch (action) {
      case TOOLBAR_ACTIONS.bold:
        chain.toggleBold().run();
        break;
      case TOOLBAR_ACTIONS.italic:
        chain.toggleItalic().run();
        break;
      case TOOLBAR_ACTIONS.underline:
        chain.toggleUnderline().run();
        break;
      case TOOLBAR_ACTIONS.strike:
        chain.toggleStrike().run();
        break;
      case TOOLBAR_ACTIONS.h1:
        chain.toggleHeading({ level: 1 }).run();
        break;
      case TOOLBAR_ACTIONS.h2:
        chain.toggleHeading({ level: 2 }).run();
        break;
      case TOOLBAR_ACTIONS.h3:
        chain.toggleHeading({ level: 3 }).run();
        break;
      case TOOLBAR_ACTIONS.bulletList:
        chain.toggleBulletList().run();
        break;
      case TOOLBAR_ACTIONS.orderedList:
        chain.toggleOrderedList().run();
        break;
      case TOOLBAR_ACTIONS.link: {
        const previous = this.editor.getAttributes("link").href as string | undefined;
        const value = window.prompt("Enter URL", previous ?? "https://");
        if (value === null) {
          return;
        }
        if (!value.trim()) {
          chain.unsetLink().run();
          break;
        }
        chain.extendMarkRange("link").setLink({ href: value, target: "_blank", rel: "noopener noreferrer" }).run();
        break;
      }
      case TOOLBAR_ACTIONS.blockquote:
        chain.toggleBlockquote().run();
        break;
      case TOOLBAR_ACTIONS.codeBlock:
        chain.toggleCodeBlock().run();
        break;
      case TOOLBAR_ACTIONS.divider:
        chain.setHorizontalRule().run();
        break;
      case TOOLBAR_ACTIONS.image:
        await this.insertImage();
        break;
      case TOOLBAR_ACTIONS.video:
        this.insertVideoFromUrl();
        break;
      case TOOLBAR_ACTIONS.alignLeft:
        chain.setTextAlign("left").run();
        break;
      case TOOLBAR_ACTIONS.alignCenter:
        chain.setTextAlign("center").run();
        break;
      case TOOLBAR_ACTIONS.alignRight:
        chain.setTextAlign("right").run();
        break;
      case TOOLBAR_ACTIONS.alignJustify:
        chain.setTextAlign("justify").run();
        break;
      case TOOLBAR_ACTIONS.indent:
        this.handleTabPress(false);
        break;
      case TOOLBAR_ACTIONS.outdent:
        this.handleTabPress(true);
        break;
      case TOOLBAR_ACTIONS.undo:
        this.editor.commands.undo();
        break;
      case TOOLBAR_ACTIONS.redo:
        this.editor.commands.redo();
        break;
      default:
        break;
    }
    this.updateToolbarState();
  }

  private insertVideoFromUrl(): void {
    if (!this.editor) return;
    const value = window.prompt("Enter video URL (mp4/webm/ogg)");
    if (value === null) return;
    const src = value.trim();
    if (!src) return;
    const renderKind = inferRenderKind(src);
    this.editor
      .chain()
      .focus()
      .insertContent({ type: "video", attrs: { src, controls: true, renderKind, widthPct: 80, align: "center" } })
      .run();
  }

  private getSelectedMediaNode():
    | { kind: MediaKind; node: { attrs: Record<string, unknown> }; pos: number }
    | null {
    if (!this.editor) return null;
    const { state } = this.editor;
    const selection = state.selection;
    if (
      selection instanceof NodeSelection &&
      (selection.node.type.name === "video" || selection.node.type.name === "image")
    ) {
      return {
        kind: selection.node.type.name as MediaKind,
        node: selection.node as unknown as { attrs: Record<string, unknown> },
        pos: selection.from,
      };
    }
    const nodeAtFrom = state.doc.nodeAt(selection.from);
    if (nodeAtFrom?.type.name === "video" || nodeAtFrom?.type.name === "image") {
      return {
        kind: nodeAtFrom.type.name as MediaKind,
        node: nodeAtFrom as unknown as { attrs: Record<string, unknown> },
        pos: selection.from,
      };
    }
    if (selection.from > 0) {
      const nodeBefore = state.doc.nodeAt(selection.from - 1);
      if (nodeBefore?.type.name === "video" || nodeBefore?.type.name === "image") {
        return {
          kind: nodeBefore.type.name as MediaKind,
          node: nodeBefore as unknown as { attrs: Record<string, unknown> },
          pos: selection.from - 1,
        };
      }
    }
    return null;
  }

  private setSelectedMediaAttrs(
    attrs: Partial<{ widthPct: number; align: VideoAlign }>,
    options?: { silentWhenNoSelection?: boolean }
  ): void {
    if (!this.editor) return;
    const selected = this.getSelectedMediaNode();
    if (!selected) {
      if (!options?.silentWhenNoSelection) {
        window.alert("Select an image or video first, then change width/alignment.");
      }
      return;
    }
    const currentWidth = normalizeVideoWidthPct(selected.node.attrs.widthPct);
    const currentAlign = normalizeVideoAlign(selected.node.attrs.align);
    const nextWidth = attrs.widthPct ?? currentWidth;
    const nextAlign = attrs.align ?? currentAlign;
    this.editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(selected.pos, undefined, {
        ...selected.node.attrs,
        widthPct: nextWidth,
        align: nextAlign,
      });
      return true;
    });
    this.updateResizeOverlayPosition();
  }

  private async insertImage(): Promise<void> {
    if (!this.editor) {
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.click();

    await new Promise<void>((resolve) => {
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve();
          return;
        }
        const dataUrl = await this.fileToDataUrl(file);
        const { from } = this.editor!.state.selection;
        this.editor!
          .chain()
          .focus()
          .insertContent({ type: "image", attrs: { src: dataUrl, alt: file.name, widthPct: 80, align: "center" } })
          .run();

        if (this.options.uploadImage) {
          try {
            const uploaded = await this.options.uploadImage(file);
            const doc = this.editor!.state.doc;
            doc.descendants((node, pos) => {
              if (node.type.name === "image" && node.attrs.src === dataUrl) {
                this.editor!.commands.command(({ tr }) => {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    src: uploaded.url,
                    alt: uploaded.alt ?? file.name
                  });
                  return true;
                });
                return false;
              }
              return true;
            });
          } catch (err) {
            console.error("Image upload failed", err);
            this.editor!.commands.setTextSelection(from);
          }
        }
        resolve();
      };
    });
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private updateToolbarState(): void {
    if (!this.editor) {
      return;
    }
    const checks: Record<string, boolean> = {
      [TOOLBAR_ACTIONS.bold]: this.editor.isActive("bold"),
      [TOOLBAR_ACTIONS.italic]: this.editor.isActive("italic"),
      [TOOLBAR_ACTIONS.underline]: this.editor.isActive("underline"),
      [TOOLBAR_ACTIONS.strike]: this.editor.isActive("strike"),
      [TOOLBAR_ACTIONS.h1]: this.editor.isActive("heading", { level: 1 }),
      [TOOLBAR_ACTIONS.h2]: this.editor.isActive("heading", { level: 2 }),
      [TOOLBAR_ACTIONS.h3]: this.editor.isActive("heading", { level: 3 }),
      [TOOLBAR_ACTIONS.bulletList]: this.editor.isActive("bulletList"),
      [TOOLBAR_ACTIONS.orderedList]: this.editor.isActive("orderedList"),
      [TOOLBAR_ACTIONS.link]: this.editor.isActive("link"),
      [TOOLBAR_ACTIONS.blockquote]: this.editor.isActive("blockquote"),
      [TOOLBAR_ACTIONS.codeBlock]: this.editor.isActive("codeBlock"),
      [TOOLBAR_ACTIONS.alignLeft]: this.editor.isActive({ textAlign: "left" }),
      [TOOLBAR_ACTIONS.alignCenter]: this.editor.isActive({ textAlign: "center" }),
      [TOOLBAR_ACTIONS.alignRight]: this.editor.isActive({ textAlign: "right" }),
      [TOOLBAR_ACTIONS.alignJustify]: this.editor.isActive({ textAlign: "justify" })
    };

    const selectedMedia = this.getSelectedMediaNode();
    if (selectedMedia) {
      this.updateResizeOverlayPosition();
    } else {
      if (this.resizeOverlay) this.resizeOverlay.classList.add("hidden");
      if (this.mediaEditBar) this.mediaEditBar.classList.add("hidden");
    }

    this.toolbar.querySelectorAll<HTMLButtonElement>(".rte-btn").forEach((btn) => {
      const action = btn.dataset.action ?? "";
      btn.classList.toggle("active", Boolean(checks[action]));
      if (action === TOOLBAR_ACTIONS.undo) {
        btn.disabled = !this.editor!.can().undo();
      }
      if (action === TOOLBAR_ACTIONS.redo) {
        btn.disabled = !this.editor!.can().redo();
      }
    });

    if (this.fontSelect) {
      const current = String(this.editor.getAttributes("textStyle").fontFamily ?? "").trim();
      const matched = FONT_OPTIONS.find((opt) => opt.value === current);
      this.fontSelect.value = matched?.value ?? "";
    }
  }

  private renderSlashMenu = (state: {
    active: boolean;
    items: SlashCommandItem[];
    index: number;
    coords: { top: number; left: number } | null;
  }): void => {
    if (!this.slashMenu) {
      return;
    }
    if (!state.active || !state.coords || !state.items.length) {
      this.slashMenu.classList.add("hidden");
      this.slashMenu.innerHTML = "";
      return;
    }

    this.slashMenu.classList.remove("hidden");
    this.slashMenu.style.top = `${state.coords.top}px`;
    this.slashMenu.style.left = `${state.coords.left}px`;
    this.slashMenu.innerHTML = state.items
      .map(
        (item, idx) =>
          `<button class="rte-slash-item ${idx === state.index ? "active" : ""}" data-id="${item.id}">
            <span class="title">${item.label}</span>
            <span class="desc">${item.description ?? ""}</span>
          </button>`
      )
      .join("");
  };
}
