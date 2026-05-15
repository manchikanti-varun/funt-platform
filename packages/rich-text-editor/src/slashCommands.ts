import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import type { SlashCommandItem } from "./types.js";

export const slashCommandPluginKey = new PluginKey("slash-commands");

type SlashMenuState = {
  active: boolean;
  items: SlashCommandItem[];
  query: string;
  index: number;
  coords: { top: number; left: number } | null;
};

const getDefaultState = (): SlashMenuState => ({
  active: false,
  items: [],
  query: "",
  index: 0,
  coords: null
});

const getSlashCommands = (editor: Editor): SlashCommandItem[] => [
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    group: "Text",
    keywords: ["title", "h1"],
    icon: "heading-1",
    run: () => editor.chain().focus().toggleHeading({ level: 1 }).run()
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    group: "Text",
    keywords: ["subtitle", "h2"],
    icon: "heading-2",
    run: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small section heading",
    group: "Text",
    keywords: ["h3"],
    icon: "heading-3",
    run: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
  },
  {
    id: "h4",
    label: "Heading 4",
    description: "Minor section heading",
    group: "Text",
    keywords: ["h4"],
    icon: "heading-4",
    run: () => editor.chain().focus().toggleHeading({ level: 4 }).run()
  },
  {
    id: "h5",
    label: "Heading 5",
    description: "Subsection heading",
    group: "Text",
    keywords: ["h5"],
    icon: "heading-5",
    run: () => editor.chain().focus().toggleHeading({ level: 5 }).run()
  },
  {
    id: "h6",
    label: "Heading 6",
    description: "Smallest heading",
    group: "Text",
    keywords: ["h6"],
    icon: "heading-6",
    run: () => editor.chain().focus().toggleHeading({ level: 6 }).run()
  },
  {
    id: "bullet-list",
    label: "Bullet list",
    description: "Create unordered list",
    group: "List",
    keywords: ["ul", "bullet"],
    icon: "list",
    run: () => editor.chain().focus().toggleBulletList().run()
  },
  {
    id: "ordered-list",
    label: "Numbered list",
    description: "Create ordered list",
    group: "List",
    keywords: ["ol", "number"],
    icon: "list-ordered",
    run: () => editor.chain().focus().toggleOrderedList().run()
  },
  {
    id: "blockquote",
    label: "Blockquote",
    description: "Add quotation block",
    group: "Blocks",
    icon: "quote",
    run: () => editor.chain().focus().toggleBlockquote().run()
  },
  {
    id: "code-block",
    label: "Code block",
    description: "Insert multiline code",
    group: "Blocks",
    icon: "code-2",
    run: () => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    id: "divider",
    label: "Divider",
    description: "Insert horizontal rule",
    group: "Insert",
    icon: "minus",
    run: () => editor.chain().focus().setHorizontalRule().run()
  },
  {
    id: "image",
    label: "Image",
    description: "Insert from an https image URL",
    group: "Insert",
    keywords: ["photo", "picture", "img", "url"],
    icon: "image-plus",
    run: () => {
      const value = window.prompt("Enter image URL (https://…)");
      if (value === null) return;
      const src = value.trim();
      if (!src) return;
      if (!/^https?:\/\//i.test(src) && !/^data:image\//i.test(src)) {
        window.alert("Please enter a valid image URL (https://…).");
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({ type: "image", attrs: { src, alt: "", widthPct: 80, align: "center" } })
        .run();
    },
  },
  {
    id: "task-list",
    label: "Checklist",
    description: "Track tasks with checkboxes",
    group: "List",
    keywords: ["todo", "task"],
    icon: "list-checks",
    run: () => editor.chain().focus().toggleTaskList().run()
  },
  {
    id: "table",
    label: "Table",
    description: "Insert 3x3 table",
    group: "Insert",
    keywords: ["grid"],
    icon: "table-2",
    run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }
];

export const SlashCommandsExtension = Extension.create({
  name: "slashCommands",
  addOptions() {
    return { onStateChange: (_state: SlashMenuState) => {} };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: slashCommandPluginKey,
        state: {
          init: getDefaultState,
          apply: (tr, value) => {
            const metadata = tr.getMeta(slashCommandPluginKey) as SlashMenuState | undefined;
            if (metadata) {
              return metadata;
            }
            if (tr.docChanged || tr.selectionSet) {
              return getDefaultState();
            }
            return value;
          }
        },
        props: {
          handleTextInput: (view, from, _to, text) => {
            const { state } = view;
            const current = slashCommandPluginKey.getState(state) as SlashMenuState | undefined;
            if (current?.active && text.length === 1 && /[\w-]/.test(text)) {
              const query = `${current.query}${text}`.toLowerCase();
              const all = getSlashCommands(this.editor);
              const filtered = all.filter((item) => {
                const haystack = [item.label, item.description, ...(item.keywords ?? []), item.group]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return haystack.includes(query);
              });
              view.dispatch(
                state.tr.setMeta(slashCommandPluginKey, {
                  ...current,
                  query,
                  items: filtered,
                  index: 0
                })
              );
              return false;
            }
            if (text !== "/") return false;
            const $pos = state.selection.$from;
            const isAtLineStart = $pos.parentOffset === 0;
            if (!isAtLineStart) {
              return false;
            }

            const coords = view.coordsAtPos(from);
            const payload: SlashMenuState = {
              active: true,
              items: getSlashCommands(this.editor),
              query: "",
              index: 0,
              coords: { top: coords.bottom + 6, left: coords.left }
            };
            view.dispatch(state.tr.setMeta(slashCommandPluginKey, payload));
            return false;
          },
          handleKeyDown: (view, event) => {
            const current = slashCommandPluginKey.getState(view.state) as SlashMenuState;
            if (!current?.active) {
              return false;
            }
            if (event.key === "ArrowDown") {
              if (current.items.length === 0) return true;
              const next = (current.index + 1) % current.items.length;
              view.dispatch(
                view.state.tr.setMeta(slashCommandPluginKey, { ...current, index: next })
              );
              return true;
            }
            if (event.key === "ArrowUp") {
              if (current.items.length === 0) return true;
              const next = (current.index - 1 + current.items.length) % current.items.length;
              view.dispatch(
                view.state.tr.setMeta(slashCommandPluginKey, { ...current, index: next })
              );
              return true;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const selected = current.items[current.index];
              if (selected) {
                selected.run();
              }
              view.dispatch(view.state.tr.setMeta(slashCommandPluginKey, getDefaultState()));
              return true;
            }
            if (event.key === "Backspace") {
              if (!current.query) {
                view.dispatch(view.state.tr.setMeta(slashCommandPluginKey, getDefaultState()));
                return false;
              }
              const nextQuery = current.query.slice(0, -1).toLowerCase();
              const all = getSlashCommands(this.editor);
              const filtered = !nextQuery
                ? all
                : all.filter((item) => {
                    const haystack = [item.label, item.description, ...(item.keywords ?? []), item.group]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase();
                    return haystack.includes(nextQuery);
                  });
              view.dispatch(
                view.state.tr.setMeta(slashCommandPluginKey, {
                  ...current,
                  query: nextQuery,
                  items: filtered,
                  index: 0
                })
              );
              return false;
            }
            if (event.key === "Escape") {
              view.dispatch(view.state.tr.setMeta(slashCommandPluginKey, getDefaultState()));
              return true;
            }
            return false;
          }
        },
        view: () => {
          return {
            update: (view) => {
              const state = slashCommandPluginKey.getState(view.state) as SlashMenuState;
              this.options.onStateChange(state ?? getDefaultState());
            },
            destroy: () => {
              this.options.onStateChange(getDefaultState());
            }
          };
        }
      })
    ];
  }
});
