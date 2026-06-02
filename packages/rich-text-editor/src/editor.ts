import { Editor, Extension, JSONContent, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import DOMPurify from "dompurify";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  createIcons,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
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
  ListChecks,
  Palette,
  Highlighter,
  Eraser,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  Table2,
  MessageSquareWarning,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronsRight,
  ChevronsLeft,
  Undo2,
  Redo2,
  Type,
  ALargeSmall,
  Calendar,
  Unlink,
  Search
} from "lucide";
import { SlashCommandsExtension } from "./slashCommands.js";
import { RteActionsExtension } from "./editorActions.js";
import {
  dismissRteDialogs,
  showFindReplaceDialog,
  showRteAlert,
  showRteImageDialog,
  showRtePrompt,
} from "./ui/dialogs.js";
import { BlockIndent } from "./blockIndent.js";
import { DocsKeyboardShortcuts } from "./docsKeyboardShortcuts.js";
import { findTextMatch, replaceAllText, replaceMatch } from "./documentSearch.js";
import { FONT_SIZE_OPTIONS, FontSize } from "./fontSize.js";
import { LINE_SPACING_OPTIONS, LineSpacing } from "./lineSpacing.js";
import {
  adjustListItemsIndent,
  adjustMixedNestedIndent,
  analyzeMixedIndentSelection,
  isInAnyList,
} from "./listIndent.js";
import { extractGoogleDriveFileId, resolveImageEmbedUrl } from "./media/googleDriveUtils.js";
import type { EditorStats, RichTextContent, RichTextEditorApi, RichTextEditorOptions, SlashCommandItem } from "./types.js";

const TOOLBAR_ACTIONS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strike",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  bulletList: "bulletList",
  orderedList: "orderedList",
  taskList: "taskList",
  link: "link",
  blockquote: "blockquote",
  codeBlock: "codeBlock",
  divider: "divider",
  image: "image",
  video: "video",
  callout: "callout",
  table: "table",
  textColor: "textColor",
  textHighlight: "textHighlight",
  clearFormatting: "clearFormatting",
  superscript: "superscript",
  subscript: "subscript",
  alignLeft: "alignLeft",
  alignCenter: "alignCenter",
  alignRight: "alignRight",
  alignJustify: "alignJustify",
  indent: "indent",
  outdent: "outdent",
  normalText: "normalText",
  fontSizeUp: "fontSizeUp",
  fontSizeDown: "fontSizeDown",
  insertDate: "insertDate",
  removeLink: "removeLink",
  findReplace: "findReplace",
  undo: "undo",
  redo: "redo"
} as const;

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/** Allow https images and embedded uploads (data:image) through DOMPurify. */
const RTE_PURIFY_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "style"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
  ADD_ATTR: [
    "style",
    "data-indent",
    "data-line-height",
    "data-font-size",
    "data-width",
    "data-align",
    "data-rte-video",
    "data-render-kind",
    "class",
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|data:image\/|data:video\/|blob:)|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};
const ICONS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikethrough",
  h1: "heading-1",
  h2: "heading-2",
  h3: "heading-3",
  h4: "heading-4",
  h5: "heading-5",
  h6: "heading-6",
  bulletList: "list",
  orderedList: "list-ordered",
  taskList: "list-checks",
  link: "link-2",
  blockquote: "quote",
  codeBlock: "code-2",
  divider: "minus",
  image: "image-plus",
  video: "video",
  callout: "message-square-warning",
  table: "table-2",
  textColor: "palette",
  textHighlight: "highlighter",
  clearFormatting: "eraser",
  superscript: "superscript",
  subscript: "subscript",
  alignLeft: "align-left",
  alignCenter: "align-center",
  alignRight: "align-right",
  alignJustify: "align-justify",
  indent: "chevrons-right",
  outdent: "chevrons-left",
  normalText: "type",
  fontSizeUp: "a-large-small",
  fontSizeDown: "minus",
  insertDate: "calendar",
  removeLink: "unlink",
  findReplace: "search",
  undo: "undo-2",
  redo: "redo-2"
} as const;
const FONT_OPTIONS = [
  { label: "Sans", value: "" },
  { label: "Serif", value: "Georgia, Cambria, 'Times New Roman', Times, serif" },
  { label: "Mono", value: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace" },
  { label: "Inter", value: "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Poppins", value: "Poppins, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Outfit", value: "Outfit, Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Manrope", value: "Manrope, Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "DM Sans", value: "'DM Sans', Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Montserrat", value: "Montserrat, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Lato", value: "Lato, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Nunito", value: "Nunito, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Rubik", value: "Rubik, Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: "Lora", value: "Lora, Georgia, 'Times New Roman', serif" },
  { label: "Roboto Slab", value: "'Roboto Slab', Rockwell, 'Times New Roman', serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, 'Times New Roman', serif" },
  { label: "Playfair", value: "'Playfair Display', Georgia, 'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Fira Code", value: "'Fira Code', 'JetBrains Mono', Menlo, Monaco, Consolas, monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace" },
  { label: "Source Code", value: "'Source Code Pro', Menlo, Monaco, Consolas, monospace" },
  { label: "Display", value: "'Trebuchet MS', 'Gill Sans', 'Segoe UI', sans-serif" },
  { label: "System UI", value: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }
] as const;

const TEXT_COLOR_PRESETS_LIGHT = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ec4899", "#6b7280"];
const TEXT_COLOR_PRESETS_DARK = ["#f87171", "#60a5fa", "#4ade80", "#facc15", "#c084fc", "#fb923c", "#f472b6", "#9ca3af"];
const HIGHLIGHT_PRESETS_LIGHT = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa"];
const HIGHLIGHT_PRESETS_DARK = ["#713f12", "#14532d", "#1e3a8a", "#831843", "#4c1d95", "#7c2d12"];

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
  if (value.startsWith("data:video/")) return "video";
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
  if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
    const id = extractGoogleDriveFileId(raw);
    if (id) return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
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
    const parentAttrs = (typeof this.parent === "function" ? this.parent() : {}) as Record<
      string,
      unknown
    >;
    const parentSrc = parentAttrs.src as { parseHTML?: (element: Element) => unknown } | undefined;
    return {
      ...parentAttrs,
      src: {
        ...parentSrc,
        parseHTML: (element: Element) => {
          const raw = element.getAttribute("src") ?? "";
          return raw ? resolveImageEmbedUrl(raw) : null;
        },
      },
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
    const src =
      typeof HTMLAttributes.src === "string" && HTMLAttributes.src
        ? resolveImageEmbedUrl(HTMLAttributes.src)
        : HTMLAttributes.src;
    return [
      "img",
      mergeAttributes(
        { "data-width": String(widthPct), "data-align": align, class: mergedClass, style: `width:${widthPct}%;` },
        { ...HTMLAttributes, src }
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
      { tag: "iframe[src*='drive.google.com/file/d/'][src*='/preview']" },
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
  private fontSizeSelect: HTMLSelectElement | null = null;
  private lineSpacingSelect: HTMLSelectElement | null = null;
  private lastFindQuery = "";
  private pastePlainTextNext = false;
  private textColorInput: HTMLInputElement | null = null;
  private highlightColorInput: HTMLInputElement | null = null;
  private textColorDropdown: HTMLDetailsElement | null = null;
  private highlightColorDropdown: HTMLDetailsElement | null = null;
  private textColorRecentRow: HTMLDivElement | null = null;
  private highlightColorRecentRow: HTMLDivElement | null = null;
  private textColorPresets = [...TEXT_COLOR_PRESETS_LIGHT];
  private highlightPresets = [...HIGHLIGHT_PRESETS_LIGHT];
  private recentTextColors: string[] = [];
  private recentHighlightColors: string[] = [];
  private statsBar: HTMLDivElement | null = null;
  private floatingInlineBar: HTMLDivElement | null = null;
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
      maxHeight: Math.max(360, Math.floor(options.maxHeight ?? 720)),
      contentMinHeight: Math.max(140, Math.floor(options.contentMinHeight ?? 220)),
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
    this.root.style.setProperty("--rte-max-height", `${this.options.maxHeight}px`);
    this.root.style.setProperty("--rte-content-min-height", `${this.options.contentMinHeight}px`);
    this.refreshThemeAwarePalettes();

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
    this.floatingInlineBar = document.createElement("div");
    this.floatingInlineBar.className = "rte-inline-toolbar hidden";
    this.floatingInlineBar.innerHTML = `
      <button type="button" class="rte-inline-btn" data-inline-action="bold">${this.iconMarkup("bold")}</button>
      <button type="button" class="rte-inline-btn" data-inline-action="italic">${this.iconMarkup("italic")}</button>
      <button type="button" class="rte-inline-btn" data-inline-action="underline">${this.iconMarkup("underline")}</button>
      <button type="button" class="rte-inline-btn" data-inline-action="link">${this.iconMarkup("link-2")}</button>
    `;
    this.statsBar = document.createElement("div");
    this.statsBar.className = "rte-stats";

    this.contentArea.appendChild(this.resizeOverlay);
    this.contentArea.appendChild(this.mediaEditBar);
    this.root.append(this.toolbar, this.contentArea, this.slashMenu, this.floatingInlineBar, this.statsBar);
    this.hydrateToolbarIcons();
    this.bindResizeHandles();
    this.bindMediaEditBar();
    this.bindInlineToolbar();

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
          heading: { levels: [1, 2, 3, 4, 5, 6] }
        }),
        TextStyle,
        FontFamily.configure({ types: ["textStyle"] }),
        Color.configure({ types: ["textStyle"] }),
        Highlight.configure({ multicolor: true }),
        BlockIndent,
        FontSize,
        LineSpacing,
        DocsKeyboardShortcuts,
        TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Subscript,
        Superscript,
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        CustomImage.configure({ allowBase64: true }),
        VideoNode,
        RteActionsExtension,
        ...(this.options.enableSlashCommands
          ? [SlashCommandsExtension.configure({ onStateChange: this.renderSlashMenu })]
          : [])
      ],
      editorProps: {
        attributes: {
          class: "rte-prosemirror",
          "data-placeholder": this.options.placeholder
        },
        handlePaste: (view, event) => {
          if (!this.pastePlainTextNext || !event.clipboardData) return false;
          this.pastePlainTextNext = false;
          const text = event.clipboardData.getData("text/plain");
          if (!text) return false;
          event.preventDefault();
          const { from, to } = view.state.selection;
          view.dispatch(view.state.tr.insertText(text, from, to));
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        this.updateToolbarState();
        this.updateStatsBar();
        this.updateInlineToolbarPosition();
        const payload = {
          html: this.getUnsafeHTML(),
          json: editor.getJSON()
        };
        this.changeCallbacks.forEach((callback) => callback(payload));
      },
      onSelectionUpdate: () => {
        this.updateToolbarState();
        this.updateInlineToolbarPosition();
      }
    });

    this.toolbar.classList.toggle("floating", this.options.toolbarMode === "floating");
    const rteActions = this.editor.storage.rteActions as {
      insertImage: (() => Promise<void>) | null;
      openFindReplace: (() => Promise<void>) | null;
      showAlert: ((message: string) => Promise<void>) | null;
    };
    rteActions.insertImage = () => this.insertImage();
    rteActions.openFindReplace = () => this.openFindReplace();
    rteActions.showAlert = (message) => this.showEditorAlert(message);
    this.updateToolbarState();
    this.updateStatsBar();
    this.contentArea.addEventListener("scroll", this.updateResizeOverlayPosition, { passive: true });
    this.contentArea.addEventListener("mousedown", this.handleContentMouseDown);
    this.contentArea.addEventListener("keydown", this.handleEditorKeyDown, true);
    this.root.ownerDocument.addEventListener("keydown", this.handleDocumentKeyDown, true);
    this.root.ownerDocument.addEventListener("mousedown", this.handleOutsidePointerDown, true);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.updateResizeOverlayPosition);
    }
  }

  getHTML(): string {
    const html = this.getUnsafeHTML();
    if (!this.options.sanitizeOnGet) {
      return html;
    }
    const sanitized = DOMPurify.sanitize(html, RTE_PURIFY_CONFIG);
    return this.filterUnsafeEmbeds(sanitized);
  }

  private filterUnsafeEmbeds(html: string): string {
    if (typeof window === "undefined") return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const allowedHosts = ["youtube.com", "youtu.be", "youtube-nocookie.com", "vimeo.com", "player.vimeo.com", "drive.google.com", "docs.google.com"];
    doc.querySelectorAll("iframe").forEach((frame) => {
      const src = frame.getAttribute("src")?.trim() ?? "";
      // Always keep iframes marked as RTE video nodes (editor manages these)
      if (frame.getAttribute("data-rte-video") === "true") return;
      let keep = false;
      try {
        const host = new URL(src).hostname.toLowerCase();
        keep = allowedHosts.some((item) => host === item || host.endsWith(`.${item}`));
      } catch {
        keep = false;
      }
      if (!keep) frame.remove();
    });
    return doc.body.innerHTML;
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

  getStats(): EditorStats {
    if (!this.editor) {
      return { words: 0, characters: 0, readingTimeMinutes: 0, selectedWords: 0 };
    }
    const plain = this.editor.getText().trim();
    const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    const characters = plain.length;
    const readingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(words / 220)) : 0;

    const { from, to, empty } = this.editor.state.selection;
    let selectedWords = 0;
    if (!empty) {
      const selected = this.editor.state.doc.textBetween(from, to, " ").trim();
      selectedWords = selected ? selected.split(/\s+/).filter(Boolean).length : 0;
    }

    return { words, characters, readingTimeMinutes, selectedWords };
  }

  setContent(content: RichTextContent): void {
    this.editor?.commands.setContent(content, true);
  }

  onChange(callback: (payload: { html: string; json: JSONContent }) => void): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  destroy(): void {
    dismissRteDialogs();
    this.editor?.destroy();
    this.editor = null;
    this.changeCallbacks.clear();
    this.contentArea?.removeEventListener("scroll", this.updateResizeOverlayPosition);
    this.contentArea?.removeEventListener("mousedown", this.handleContentMouseDown);
    this.contentArea?.removeEventListener("keydown", this.handleEditorKeyDown, true);
    this.root?.ownerDocument.removeEventListener("keydown", this.handleDocumentKeyDown, true);
    this.root?.ownerDocument.removeEventListener("mousedown", this.handleOutsidePointerDown, true);
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
    if (!this.editor || !this.contentArea) return;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
      const target = event.target;
      const inside =
        target instanceof globalThis.Node &&
        (this.contentArea.contains(target) || this.root?.contains(target));
      if (inside) {
        this.pastePlainTextNext = true;
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      const target = event.target;
      const inside =
        target instanceof globalThis.Node &&
        (this.contentArea.contains(target) || this.root?.contains(target));
      if (inside) {
        event.preventDefault();
        void this.openFindReplace();
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      if (this.textColorDropdown) this.textColorDropdown.open = true;
      this.textColorInput?.focus();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      if (this.highlightColorDropdown) this.highlightColorDropdown.open = true;
      this.highlightColorInput?.focus();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      this.clearHighlightColor();
      return;
    }
    if (!this.isTabKey(event)) return;
    const target = event.target;
    const isInsideEditorTarget = !!target && target instanceof globalThis.Node && this.contentArea.contains(target);
    const hasEditorFocus = this.editor.isFocused || this.editor.view.hasFocus();
    const hasEditorSelection = this.hasActiveSelectionInsideEditor();
    if (!isInsideEditorTarget && !hasEditorFocus && !hasEditorSelection) return;
    event.preventDefault();
    this.handleTabPress(event.shiftKey);
  };

  private closeColorDropdowns(): void {
    if (this.textColorDropdown) this.textColorDropdown.open = false;
    if (this.highlightColorDropdown) this.highlightColorDropdown.open = false;
  }

  private handleOutsidePointerDown = (event: MouseEvent): void => {
    if (!this.root) return;
    const target = event.target;
    if (target instanceof globalThis.Node && this.root.contains(target)) return;
    this.closeColorDropdowns();
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

    if (this.editor.isActive("table")) {
      return shiftKey
        ? this.editor.commands.goToPreviousCell()
        : this.editor.commands.goToNextCell();
    }

    if (this.editor.isActive("codeBlock")) {
      if (!shiftKey) {
        this.editor.chain().focus().insertContent("\t").run();
      }
      return true;
    }

    const mode = shiftKey ? "outdent" : "indent";
    const snapshot = analyzeMixedIndentSelection(this.editor);
    const hasLists = snapshot.listPositions.length > 0 || snapshot.taskPositions.length > 0;
    const hasBlocks = snapshot.blockPositions.length > 0;
    const { from, to } = this.editor.state.selection;

    if (hasLists || isInAnyList(this.editor)) {
      const mixedListTypes =
        snapshot.taskPositions.length > 0 && snapshot.listPositions.length > 0;
      if ((from !== to && hasLists && hasBlocks) || mixedListTypes) {
        adjustMixedNestedIndent(this.editor, mode);
        return true;
      }
      adjustListItemsIndent(this.editor, mode);
      return true;
    }

    if (hasBlocks) {
      return mode === "indent" ? this.editor.commands.indentBlock() : this.editor.commands.outdentBlock();
    }

    return mode === "indent" ? this.editor.commands.indentBlock() : this.editor.commands.outdentBlock();
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
    this.fontSizeSelect = this.createFontSizeSelect();
    this.lineSpacingSelect = this.createLineSpacingSelect();
    const textColorControl = this.createColorControl({
      label: "Text",
      icon: "palette",
      presets: this.textColorPresets,
      onApply: (color, options) => this.applyTextColor(color, options),
      onClear: () => this.clearTextColor(),
      onBindInput: (input) => {
        this.textColorInput = input;
      },
      onBindRecentRow: (row) => {
        this.textColorRecentRow = row;
      },
      onBindDropdown: (dropdown) => {
        this.textColorDropdown = dropdown;
      },
      getCurrent: () => String(this.editor?.getAttributes("textStyle").color ?? "")
    });
    const highlightControl = this.createColorControl({
      label: "Highlight",
      icon: "highlighter",
      presets: this.highlightPresets,
      onApply: (color, options) => this.applyHighlightColor(color, options),
      onClear: () => this.clearHighlightColor(),
      onBindInput: (input) => {
        this.highlightColorInput = input;
      },
      onBindRecentRow: (row) => {
        this.highlightColorRecentRow = row;
      },
      onBindDropdown: (dropdown) => {
        this.highlightColorDropdown = dropdown;
      },
      getCurrent: () => String(this.editor?.getAttributes("highlight").color ?? "")
    });
    toolbar.append(
      this.fontSelect,
      this.fontSizeSelect,
      this.button(this.iconMarkup(ICONS.fontSizeDown), "Decrease font size", TOOLBAR_ACTIONS.fontSizeDown),
      this.button(this.iconMarkup(ICONS.fontSizeUp), "Increase font size", TOOLBAR_ACTIONS.fontSizeUp),
      this.lineSpacingSelect,
      textColorControl,
      highlightControl,
      this.separator(),
      this.button(this.iconMarkup(ICONS.normalText), "Normal text", TOOLBAR_ACTIONS.normalText),
      this.button(this.iconMarkup(ICONS.bold), "Bold", TOOLBAR_ACTIONS.bold),
      this.button(this.iconMarkup(ICONS.italic), "Italic", TOOLBAR_ACTIONS.italic),
      this.button(this.iconMarkup(ICONS.underline), "Underline", TOOLBAR_ACTIONS.underline),
      this.button(this.iconMarkup(ICONS.strike), "Strike", TOOLBAR_ACTIONS.strike),
      this.separator(),
      this.button(this.iconMarkup(ICONS.h1), "Heading 1", TOOLBAR_ACTIONS.h1),
      this.button(this.iconMarkup(ICONS.h2), "Heading 2", TOOLBAR_ACTIONS.h2),
      this.button(this.iconMarkup(ICONS.h3), "Heading 3", TOOLBAR_ACTIONS.h3),
      this.button(this.iconMarkup(ICONS.h4), "Heading 4", TOOLBAR_ACTIONS.h4),
      this.button(this.iconMarkup(ICONS.h5), "Heading 5", TOOLBAR_ACTIONS.h5),
      this.button(this.iconMarkup(ICONS.h6), "Heading 6", TOOLBAR_ACTIONS.h6),
      this.separator(),
      this.button(this.iconMarkup(ICONS.bulletList), "Bullet list", TOOLBAR_ACTIONS.bulletList),
      this.button(this.iconMarkup(ICONS.orderedList), "Numbered list", TOOLBAR_ACTIONS.orderedList),
      this.button(this.iconMarkup(ICONS.taskList), "Task checklist", TOOLBAR_ACTIONS.taskList),
      this.button(this.iconMarkup(ICONS.link), "Link", TOOLBAR_ACTIONS.link),
      this.button(this.iconMarkup(ICONS.blockquote), "Blockquote", TOOLBAR_ACTIONS.blockquote),
      this.button(this.iconMarkup(ICONS.codeBlock), "Code block", TOOLBAR_ACTIONS.codeBlock),
      this.button(this.iconMarkup(ICONS.subscript), "Subscript", TOOLBAR_ACTIONS.subscript),
      this.button(this.iconMarkup(ICONS.superscript), "Superscript", TOOLBAR_ACTIONS.superscript),
      this.button(this.iconMarkup(ICONS.divider), "Divider", TOOLBAR_ACTIONS.divider),
      this.button(this.iconMarkup(ICONS.callout), "Callout block", TOOLBAR_ACTIONS.callout),
      this.button(this.iconMarkup(ICONS.table), "Insert table", TOOLBAR_ACTIONS.table),
      this.button(this.iconMarkup(ICONS.image), "Image (URL or upload)", TOOLBAR_ACTIONS.image),
      this.button(this.iconMarkup(ICONS.video), "Video URL", TOOLBAR_ACTIONS.video),
      this.separator(),
      this.button(this.iconMarkup(ICONS.alignLeft), "Align left", TOOLBAR_ACTIONS.alignLeft),
      this.button(this.iconMarkup(ICONS.alignCenter), "Align center", TOOLBAR_ACTIONS.alignCenter),
      this.button(this.iconMarkup(ICONS.alignRight), "Align right", TOOLBAR_ACTIONS.alignRight),
      this.button(this.iconMarkup(ICONS.alignJustify), "Align justify", TOOLBAR_ACTIONS.alignJustify),
      this.button(this.iconMarkup(ICONS.indent), "Increase indent (Tab)", TOOLBAR_ACTIONS.indent),
      this.button(this.iconMarkup(ICONS.outdent), "Decrease indent (Shift+Tab)", TOOLBAR_ACTIONS.outdent),
      this.button(this.iconMarkup(ICONS.clearFormatting), "Clear formatting", TOOLBAR_ACTIONS.clearFormatting),
      this.button(this.iconMarkup(ICONS.insertDate), "Insert date & time", TOOLBAR_ACTIONS.insertDate),
      this.button(this.iconMarkup(ICONS.removeLink), "Remove link", TOOLBAR_ACTIONS.removeLink),
      this.button(this.iconMarkup(ICONS.findReplace), "Find & replace (Ctrl+F)", TOOLBAR_ACTIONS.findReplace),
      this.separator(),
      this.button(this.iconMarkup(ICONS.undo), "Undo", TOOLBAR_ACTIONS.undo),
      this.button(this.iconMarkup(ICONS.redo), "Redo", TOOLBAR_ACTIONS.redo)
    );
    this.renderRecentColorButtons();
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
        Heading4,
        Heading5,
        Heading6,
        List,
        ListOrdered,
        ListChecks,
        Link2,
        Quote,
        Code2,
        Minus,
        Plus,
        Trash2,
        ImagePlus,
        Video,
        Palette,
        Highlighter,
        Eraser,
        Superscript: SuperscriptIcon,
        Subscript: SubscriptIcon,
        Table2,
        MessageSquareWarning,
        AlignLeft,
        AlignCenter,
        AlignRight,
        AlignJustify,
        ChevronsRight,
        ChevronsLeft,
        Type,
        ALargeSmall,
        Calendar,
        Unlink,
        Search,
        Undo2,
        Redo2
      }
    });
  }

  private createColorControl(config: {
    label: string;
    icon: string;
    presets: string[];
    onApply: (color: string, options?: { recordRecent?: boolean }) => void;
    onClear: () => void;
    onBindInput: (input: HTMLInputElement) => void;
    onBindRecentRow: (row: HTMLDivElement) => void;
    onBindDropdown: (dropdown: HTMLDetailsElement) => void;
    getCurrent: () => string;
  }): HTMLDetailsElement {
    const dropdown = document.createElement("details");
    dropdown.className = "rte-color-dropdown";
    const trigger = document.createElement("summary");
    trigger.className = "rte-color-dropdown-trigger";
    trigger.innerHTML = `<i data-lucide="${config.icon}" aria-hidden="true"></i><span>${config.label}</span>`;
    const wrapper = document.createElement("div");
    wrapper.className = "rte-color-control rte-color-dropdown-panel";
    const title = document.createElement("div");
    title.className = "rte-color-title";
    title.innerHTML = `<i data-lucide="${config.icon}" aria-hidden="true"></i><span>${config.label}</span>`;

    const presets = document.createElement("div");
    presets.className = "rte-color-swatches";
    let previewing = false;
    let previewBase = "";
    config.presets.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "rte-color-swatch";
      swatch.title = color;
      swatch.style.backgroundColor = color;
      swatch.addEventListener("mousedown", (event) => event.preventDefault());
      swatch.addEventListener("mouseenter", () => {
        if (previewing) return;
        previewing = true;
        previewBase = config.getCurrent();
        config.onApply(color, { recordRecent: false });
      });
      swatch.addEventListener("mouseleave", () => {
        if (!previewing) return;
        previewing = false;
        if (previewBase) config.onApply(previewBase);
        else config.onClear();
      });
      swatch.addEventListener("click", () => {
        previewing = false;
        config.onApply(color);
        dropdown.open = false;
      });
      presets.appendChild(swatch);
    });

    const input = document.createElement("input");
    input.type = "color";
    input.className = "rte-color-input";
    input.setAttribute("aria-label", `${config.label} color`);
    input.title = `${config.label} color`;
    input.value = config.presets[0] ?? "#000000";
    input.addEventListener("input", () => {
      config.onApply(input.value);
      dropdown.open = false;
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "rte-color-clear";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
      config.onClear();
      dropdown.open = false;
    });

    const recentLabel = document.createElement("span");
    recentLabel.className = "rte-color-recent-label";
    recentLabel.textContent = "Recent";
    const recentRow = document.createElement("div");
    recentRow.className = "rte-color-recent";

    const custom = document.createElement("div");
    custom.className = "rte-color-custom";
    custom.append(input, clear);
    wrapper.append(title, presets, custom, recentLabel, recentRow);
    dropdown.append(trigger, wrapper);
    config.onBindInput(input);
    config.onBindRecentRow(recentRow);
    config.onBindDropdown(dropdown);
    return dropdown;
  }

  private applyTextColor(color: string, options?: { recordRecent?: boolean }): void {
    if (!this.editor) return;
    this.editor.chain().focus().setColor(color).run();
    if (options?.recordRecent !== false) {
      this.pushRecentColor(this.recentTextColors, color);
      this.renderRecentColorButtons();
    }
  }

  private applyHighlightColor(color: string, options?: { recordRecent?: boolean }): void {
    if (!this.editor) return;
    this.editor.chain().focus().setHighlight({ color }).run();
    if (options?.recordRecent !== false) {
      this.pushRecentColor(this.recentHighlightColors, color);
      this.renderRecentColorButtons();
    }
  }

  private clearTextColor(): void {
    if (!this.editor) return;
    this.editor.chain().focus().unsetColor().run();
  }

  private clearHighlightColor(): void {
    if (!this.editor) return;
    this.editor.chain().focus().unsetHighlight().run();
  }

  private pushRecentColor(target: string[], color: string): void {
    const normalized = color.toLowerCase();
    const next = [normalized, ...target.filter((item) => item !== normalized)].slice(0, 8);
    target.splice(0, target.length, ...next);
  }

  private renderRecentColorButtons(): void {
    const render = (container: HTMLDivElement | null, colors: string[], onClick: (color: string) => void) => {
      if (!container) return;
      container.innerHTML = "";
      colors.slice(0, 6).forEach((color) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "rte-color-swatch recent";
        swatch.style.backgroundColor = color;
        swatch.title = color;
        swatch.addEventListener("click", () => {
          onClick(color);
          this.closeColorDropdowns();
        });
        container.appendChild(swatch);
      });
    };
    render(this.textColorRecentRow, this.recentTextColors, (color) => this.applyTextColor(color));
    render(this.highlightColorRecentRow, this.recentHighlightColors, (color) => this.applyHighlightColor(color));
  }

  private bindInlineToolbar(): void {
    if (!this.floatingInlineBar) return;
    this.floatingInlineBar.querySelectorAll<HTMLButtonElement>(".rte-inline-btn").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        const action = button.dataset.inlineAction ?? "";
        if (action === "bold") this.editor?.chain().focus().toggleBold().run();
        if (action === "italic") this.editor?.chain().focus().toggleItalic().run();
        if (action === "underline") this.editor?.chain().focus().toggleUnderline().run();
        if (action === "link") void this.handleToolbarAction(TOOLBAR_ACTIONS.link);
      });
    });
  }

  private refreshThemeAwarePalettes(): void {
    const prefersDark =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    this.textColorPresets = prefersDark ? [...TEXT_COLOR_PRESETS_DARK] : [...TEXT_COLOR_PRESETS_LIGHT];
    this.highlightPresets = prefersDark ? [...HIGHLIGHT_PRESETS_DARK] : [...HIGHLIGHT_PRESETS_LIGHT];
  }

  private updateInlineToolbarPosition(): void {
    if (!this.editor || !this.floatingInlineBar || !this.root) return;
    const selection = this.editor.state.selection;
    if (selection.empty || !(selection instanceof TextSelection)) {
      this.floatingInlineBar.classList.add("hidden");
      return;
    }
    const start = this.editor.view.coordsAtPos(selection.from);
    const end = this.editor.view.coordsAtPos(selection.to);
    const rootRect = this.root.getBoundingClientRect();
    const toolbarRect = this.toolbar.getBoundingClientRect();
    const selectionTop = Math.min(start.top, end.top) - rootRect.top;
    const selectionBottom = Math.max(start.bottom, end.bottom) - rootRect.top;
    const minTop = Math.max(8, toolbarRect.bottom - rootRect.top + 6);
    const preferredTop = selectionTop - 44;
    const top = preferredTop < minTop ? selectionBottom + 8 : preferredTop;
    const left = ((start.left + end.right) / 2) - rootRect.left;
    this.floatingInlineBar.style.left = `${Math.max(8, left - 70)}px`;
    this.floatingInlineBar.style.top = `${Math.max(minTop, top)}px`;
    this.floatingInlineBar.classList.remove("hidden");
  }

  private updateStatsBar(): void {
    if (!this.statsBar) return;
    const stats = this.getStats();
    const selected =
      stats.selectedWords > 0
        ? `  |  ${stats.selectedWords} words selected`
        : "";
    this.statsBar.textContent = `${stats.words} words  |  ${stats.characters} chars  |  ~${stats.readingTimeMinutes} min read${selected}`;
  }

  private createFontSizeSelect(): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "rte-font-select rte-font-select-narrow";
    select.setAttribute("aria-label", "Font size");
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Size";
    select.append(defaultOpt);
    FONT_SIZE_OPTIONS.forEach((size) => {
      const item = document.createElement("option");
      item.value = `${size}px`;
      item.textContent = String(size);
      select.append(item);
    });
    select.addEventListener("mousedown", (event) => event.preventDefault());
    select.addEventListener("change", () => {
      if (!this.editor) return;
      const value = select.value;
      if (!value) {
        this.editor.chain().focus().unsetFontSize().run();
        return;
      }
      this.editor.chain().focus().setFontSize(value).run();
    });
    return select;
  }

  private createLineSpacingSelect(): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "rte-font-select rte-font-select-spacing";
    select.setAttribute("aria-label", "Line spacing");
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Line";
    select.append(defaultOpt);
    LINE_SPACING_OPTIONS.forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.append(item);
    });
    select.addEventListener("mousedown", (event) => event.preventDefault());
    select.addEventListener("change", () => {
      if (!this.editor) return;
      const value = select.value;
      if (!value) {
        this.editor.chain().focus().unsetLineSpacing().run();
        return;
      }
      this.editor.chain().focus().setLineSpacing(value).run();
    });
    return select;
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
      case TOOLBAR_ACTIONS.h4:
        chain.toggleHeading({ level: 4 }).run();
        break;
      case TOOLBAR_ACTIONS.h5:
        chain.toggleHeading({ level: 5 }).run();
        break;
      case TOOLBAR_ACTIONS.h6:
        chain.toggleHeading({ level: 6 }).run();
        break;
      case TOOLBAR_ACTIONS.bulletList:
        chain.toggleBulletList().run();
        break;
      case TOOLBAR_ACTIONS.orderedList:
        chain.toggleOrderedList().run();
        break;
      case TOOLBAR_ACTIONS.taskList:
        chain.toggleTaskList().run();
        break;
      case TOOLBAR_ACTIONS.link: {
        void this.editLink();
        break;
      }
      case TOOLBAR_ACTIONS.blockquote:
        chain.toggleBlockquote().run();
        break;
      case TOOLBAR_ACTIONS.codeBlock:
        chain.toggleCodeBlock().run();
        break;
      case TOOLBAR_ACTIONS.subscript:
        chain.toggleSubscript().run();
        break;
      case TOOLBAR_ACTIONS.superscript:
        chain.toggleSuperscript().run();
        break;
      case TOOLBAR_ACTIONS.divider:
        chain.setHorizontalRule().run();
        break;
      case TOOLBAR_ACTIONS.callout:
        chain.insertContent(`<blockquote><p><strong>Info:</strong> Write your callout...</p></blockquote>`).run();
        break;
      case TOOLBAR_ACTIONS.table:
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case TOOLBAR_ACTIONS.image:
        await this.insertImage();
        break;
      case TOOLBAR_ACTIONS.video:
        void this.insertVideoFromUrl();
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
      case TOOLBAR_ACTIONS.clearFormatting:
        chain.clearNodes().unsetAllMarks().resetBlockIndent().unsetLineSpacing().run();
        break;
      case TOOLBAR_ACTIONS.normalText:
        chain.setParagraph().unsetAllMarks().run();
        break;
      case TOOLBAR_ACTIONS.fontSizeUp:
        this.editor.commands.increaseFontSize();
        break;
      case TOOLBAR_ACTIONS.fontSizeDown:
        this.editor.commands.decreaseFontSize();
        break;
      case TOOLBAR_ACTIONS.insertDate:
        this.insertDateTime();
        break;
      case TOOLBAR_ACTIONS.removeLink:
        chain.unsetLink().run();
        break;
      case TOOLBAR_ACTIONS.findReplace:
        await this.openFindReplace();
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

  private async insertVideoFromUrl(): Promise<void> {
    if (!this.editor || !this.root) return;
    const result = await showRtePrompt(this.root, {
      title: "Insert video",
      label: "Video URL",
      placeholder: "https://example.com/video.mp4",
      hint: "Supported formats: mp4, webm, ogg, or embeddable links.",
    });
    if (result.cancelled) return;
    const src = result.value.trim();
    if (!src) return;
    const renderKind = inferRenderKind(src);
    this.editor
      .chain()
      .focus()
      .insertContent({ type: "video", attrs: { src, controls: true, renderKind, widthPct: 80, align: "center" } })
      .run();
  }

  private async editLink(): Promise<void> {
    if (!this.editor || !this.root) return;
    const previous = (this.editor.getAttributes("link").href as string | undefined) ?? "";
    const result = await showRtePrompt(this.root, {
      title: "Link",
      label: "URL",
      placeholder: "https://example.com",
      defaultValue: previous || "https://",
      allowEmpty: true,
      hint: "Leave empty to remove the link.",
    });
    if (result.cancelled) return;
    const value = result.value.trim();
    if (!value) {
      this.editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    this.editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: value, target: "_blank", rel: "noopener noreferrer" })
      .run();
  }

  private showEditorAlert(message: string): Promise<void> {
    if (!this.root) return Promise.resolve();
    return showRteAlert(this.root, message);
  }

  private insertDateTime(): void {
    if (!this.editor) return;
    const now = new Date();
    const text = `${now.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })} ${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    this.editor.chain().focus().insertContent(text).run();
  }

  private async openFindReplace(): Promise<void> {
    if (!this.editor || !this.root) return;
    const result = await showFindReplaceDialog(this.root, { find: this.lastFindQuery });
    if (result.action === "cancel") return;

    this.lastFindQuery = result.find;
    const opts = { caseSensitive: result.caseSensitive };

    if (result.action === "findNext") {
      const match = findTextMatch(this.editor, result.find, opts);
      if (!match) {
        await this.showEditorAlert(`No matches for "${result.find}".`);
        return;
      }
      this.editor.chain().focus().setTextSelection(match).run();
      return;
    }

    if (result.action === "replace") {
      const { from, to, empty } = this.editor.state.selection;
      if (!empty && result.find) {
        const selected = this.editor.state.doc.textBetween(from, to);
        const matches =
          result.caseSensitive
            ? selected === result.find
            : selected.toLowerCase() === result.find.toLowerCase();
        if (matches) {
          replaceMatch(this.editor, { from, to }, result.replace);
          return;
        }
      }
      const match = findTextMatch(this.editor, result.find, opts);
      if (!match) {
        await this.showEditorAlert(`No matches for "${result.find}".`);
        return;
      }
      replaceMatch(this.editor, match, result.replace);
      this.editor.chain().focus().setTextSelection(match).run();
      return;
    }

    if (result.action === "replaceAll") {
      const count = replaceAllText(this.editor, result.find, result.replace, opts);
      await this.showEditorAlert(
        count > 0 ? `Replaced ${count} occurrence${count === 1 ? "" : "s"}.` : `No matches for "${result.find}".`
      );
    }
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
        void this.showEditorAlert("Select an image or video first, then change width/alignment.");
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

  private insertImageFromUrl(src: string): void {
    if (!this.editor) {
      return;
    }
    const trimmed = src.trim();
    if (inferRenderKind(trimmed) === "embed" && !/^data:image\//i.test(trimmed)) {
      const renderKind = inferRenderKind(trimmed);
      this.editor
        .chain()
        .focus()
        .insertContent({ type: "video", attrs: { src: trimmed, controls: true, renderKind, widthPct: 80, align: "center" } })
        .run();
      return;
    }
    const normalized = resolveImageEmbedUrl(trimmed);
    if (!/^https?:\/\//i.test(normalized) && !/^data:image\//i.test(normalized)) {
      void this.showEditorAlert("Please enter a valid image URL (https://…).");
      return;
    }
    this.editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: { src: normalized, alt: "", widthPct: 80, align: "center" },
      })
      .run();
  }

  private async compressImageForEmbed(file: File): Promise<File> {
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
      return file;
    }
    if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / bitmap.width);
      if (scale >= 1 && file.size < 400_000) {
        bitmap.close();
        return file;
      }
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        return file;
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82)
      );
      if (!blob) {
        return file;
      }
      const name = `${file.name.replace(/\.[^.]+$/, "") || "image"}.jpg`;
      return new File([blob], name, { type: "image/jpeg" });
    } catch {
      return file;
    }
  }

  private async insertImage(): Promise<void> {
    if (!this.root) return;
    const result = await showRteImageDialog(this.root);
    if (result.action === "cancel") return;
    if (result.action === "url") {
      this.insertImageFromUrl(result.url);
      return;
    }
    await this.insertImageFromFile(result.file);
  }

  private async insertImageFromFile(file: File): Promise<void> {
    if (!this.editor) {
      return;
    }
    if (file.type.startsWith("video/")) {
      const dataUrl = await this.fileToDataUrl(file);
      this.editor
        .chain()
        .focus()
        .insertContent({
          type: "video",
          attrs: { src: dataUrl, controls: true, renderKind: "video", widthPct: 80, align: "center" },
        })
        .run();
      return;
    }
    const compressed = await this.compressImageForEmbed(file);
    const dataUrl = await this.fileToDataUrl(compressed);
    const { from } = this.editor.state.selection;
    this.editor
      .chain()
      .focus()
      .insertContent({ type: "image", attrs: { src: dataUrl, alt: compressed.name, widthPct: 80, align: "center" } })
      .run();

    if (this.options.uploadImage) {
      try {
        const uploaded = await this.options.uploadImage(compressed);
        const doc = this.editor.state.doc;
        doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === dataUrl) {
            this.editor!.commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                src: uploaded.url,
                alt: uploaded.alt ?? compressed.name,
              });
              return true;
            });
            return false;
          }
          return true;
        });
      } catch (err) {
        console.error("Image upload failed", err);
        this.editor.commands.setTextSelection(from);
      }
    }
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
      [TOOLBAR_ACTIONS.h4]: this.editor.isActive("heading", { level: 4 }),
      [TOOLBAR_ACTIONS.h5]: this.editor.isActive("heading", { level: 5 }),
      [TOOLBAR_ACTIONS.h6]: this.editor.isActive("heading", { level: 6 }),
      [TOOLBAR_ACTIONS.bulletList]: this.editor.isActive("bulletList"),
      [TOOLBAR_ACTIONS.orderedList]: this.editor.isActive("orderedList"),
      [TOOLBAR_ACTIONS.taskList]: this.editor.isActive("taskList"),
      [TOOLBAR_ACTIONS.blockquote]: this.editor.isActive("blockquote"),
      [TOOLBAR_ACTIONS.codeBlock]: this.editor.isActive("codeBlock"),
      [TOOLBAR_ACTIONS.subscript]: this.editor.isActive("subscript"),
      [TOOLBAR_ACTIONS.superscript]: this.editor.isActive("superscript"),
      [TOOLBAR_ACTIONS.alignLeft]: this.editor.isActive({ textAlign: "left" }),
      [TOOLBAR_ACTIONS.alignCenter]: this.editor.isActive({ textAlign: "center" }),
      [TOOLBAR_ACTIONS.alignRight]: this.editor.isActive({ textAlign: "right" }),
      [TOOLBAR_ACTIONS.alignJustify]: this.editor.isActive({ textAlign: "justify" }),
      [TOOLBAR_ACTIONS.normalText]:
        this.editor.isActive("paragraph") &&
        !this.editor.isActive("heading") &&
        !this.editor.isActive("blockquote"),
      [TOOLBAR_ACTIONS.link]: this.editor.isActive("link"),
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
      if (action === TOOLBAR_ACTIONS.removeLink) {
        btn.disabled = !this.editor!.isActive("link");
      }
    });

    if (this.fontSelect) {
      const current = String(this.editor.getAttributes("textStyle").fontFamily ?? "").trim();
      const matched = FONT_OPTIONS.find((opt) => opt.value === current);
      this.fontSelect.value = matched?.value ?? "";
    }
    if (this.fontSizeSelect) {
      const size = String(this.editor.getAttributes("textStyle").fontSize ?? "").trim();
      this.fontSizeSelect.value = size || "";
    }
    if (this.lineSpacingSelect) {
      const { $from } = this.editor.state.selection;
      let lh = "";
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === "paragraph" || node.type.name === "heading" || node.type.name === "blockquote") {
          lh = String(node.attrs.lineHeight ?? "");
          break;
        }
      }
      this.lineSpacingSelect.value = lh || "";
    }
    if (this.textColorInput) {
      const color = String(this.editor.getAttributes("textStyle").color ?? "").trim();
      if (/^#[0-9a-f]{6}$/i.test(color)) this.textColorInput.value = color;
    }
    if (this.highlightColorInput) {
      const color = String(this.editor.getAttributes("highlight").color ?? "").trim();
      if (/^#[0-9a-f]{6}$/i.test(color)) this.highlightColorInput.value = color;
    }
  }

  private renderSlashMenu = (state: {
    active: boolean;
    items: SlashCommandItem[];
    query?: string;
    index: number;
    coords: { top: number; left: number } | null;
  }): void => {
    if (!this.slashMenu) {
      return;
    }
    if (!state.active || !state.coords) {
      this.slashMenu.classList.add("hidden");
      this.slashMenu.innerHTML = "";
      return;
    }

    this.slashMenu.classList.remove("hidden");
    this.slashMenu.style.top = `${state.coords.top}px`;
    this.slashMenu.style.left = `${state.coords.left}px`;
    if (!state.items.length) {
      this.slashMenu.innerHTML = `<div class="rte-slash-empty">No commands for "${state.query ?? ""}"</div>`;
      return;
    }
    this.slashMenu.innerHTML = state.items
      .map((item, idx) => {
        const group = item.group ? `<span class="group">${item.group}</span>` : "";
        const icon = item.icon ? `<span class="icon"><i data-lucide="${item.icon}" aria-hidden="true"></i></span>` : "";
        return `<button class="rte-slash-item ${idx === state.index ? "active" : ""}" data-id="${item.id}">
            <span class="title">${icon}<span class="label">${item.label}</span>${group}</span>
            <span class="desc">${item.description ?? ""}</span>
          </button>`;
      })
      .join("");
    createIcons({
      attrs: { width: "15", height: "15", "stroke-width": "2" },
    });
  };
}
