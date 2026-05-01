import { Editor, JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import DOMPurify from "dompurify";
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
  ImagePlus,
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

export class RichTextEditor implements RichTextEditorApi {
  private editor: Editor | null = null;
  private root: HTMLElement | null = null;
  private toolbar!: HTMLElement;
  private contentArea!: HTMLElement;
  private slashMenu!: HTMLElement;
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
    this.slashMenu = document.createElement("div");
    this.slashMenu.className = "rte-slash-menu hidden";

    this.root.append(this.toolbar, this.contentArea, this.slashMenu);
    this.hydrateToolbarIcons();

    this.editor = new Editor({
      element: this.contentArea,
      content: this.options.content,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] }
        }),
        TextStyle,
        FontFamily.configure({ types: ["textStyle"] }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        Image.configure({ allowBase64: true }),
        ...(this.options.enableSlashCommands
          ? [SlashCommandsExtension.configure({ onStateChange: this.renderSlashMenu })]
          : [])
      ],
      editorProps: {
        attributes: {
          class: "rte-prosemirror",
          "data-placeholder": this.options.placeholder
        }
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
    if (this.root) {
      this.root.innerHTML = "";
    }
    this.root = null;
  }

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
        ImagePlus,
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
        this.editor!.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();

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
      [TOOLBAR_ACTIONS.codeBlock]: this.editor.isActive("codeBlock")
    };

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
