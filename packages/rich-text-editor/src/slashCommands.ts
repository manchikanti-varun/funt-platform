import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import type { SlashCommandItem } from "./types.js";

export const slashCommandPluginKey = new PluginKey("slash-commands");

type SlashMenuState = {
  active: boolean;
  items: SlashCommandItem[];
  index: number;
  coords: { top: number; left: number } | null;
};

const getDefaultState = (): SlashMenuState => ({
  active: false,
  items: [],
  index: 0,
  coords: null
});

const getSlashCommands = (editor: Editor): SlashCommandItem[] => [
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    run: () => editor.chain().focus().toggleHeading({ level: 1 }).run()
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    run: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small section heading",
    run: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
  },
  {
    id: "bullet-list",
    label: "Bullet list",
    description: "Create unordered list",
    run: () => editor.chain().focus().toggleBulletList().run()
  },
  {
    id: "ordered-list",
    label: "Numbered list",
    description: "Create ordered list",
    run: () => editor.chain().focus().toggleOrderedList().run()
  },
  {
    id: "blockquote",
    label: "Blockquote",
    description: "Add quotation block",
    run: () => editor.chain().focus().toggleBlockquote().run()
  },
  {
    id: "code-block",
    label: "Code block",
    description: "Insert multiline code",
    run: () => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    id: "divider",
    label: "Divider",
    description: "Insert horizontal rule",
    run: () => editor.chain().focus().setHorizontalRule().run()
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
            if (text !== "/") {
              return false;
            }
            const { state } = view;
            const $pos = state.selection.$from;
            const isAtLineStart = $pos.parentOffset === 0;
            if (!isAtLineStart) {
              return false;
            }

            const coords = view.coordsAtPos(from);
            const payload: SlashMenuState = {
              active: true,
              items: getSlashCommands(this.editor),
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
              const next = (current.index + 1) % current.items.length;
              view.dispatch(
                view.state.tr.setMeta(slashCommandPluginKey, { ...current, index: next })
              );
              return true;
            }
            if (event.key === "ArrowUp") {
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
