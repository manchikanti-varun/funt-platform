import { Extension } from "@tiptap/core";
import type { CommandProps } from "@tiptap/core";

export const LINE_SPACING_OPTIONS = [
  { label: "Single", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "Double", value: "2" },
  { label: "2.5", value: "2.5" },
] as const;

const LINE_SPACING_TYPES = ["paragraph", "heading", "blockquote"] as const;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineSpacing: {
      setLineSpacing: (lineHeight: string) => ReturnType;
      unsetLineSpacing: () => ReturnType;
    };
  }
}

function normalizeLineHeight(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (LINE_SPACING_OPTIONS.some((o) => o.value === raw)) return raw;
  const n = Number.parseFloat(raw);
  if (Number.isFinite(n) && n > 0 && n <= 4) return String(n);
  return null;
}

function setLineSpacingOnBlocks(lineHeight: string | null, { state, dispatch }: CommandProps): boolean {
  const { selection } = state;
  const tr = state.tr;
  let changed = false;

  const apply = (pos: number, node: { attrs: Record<string, unknown> }) => {
    const next = lineHeight ?? null;
    const current = normalizeLineHeight(node.attrs.lineHeight);
    if (current === next || (!next && !current)) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: next });
    changed = true;
  };

  state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (!(LINE_SPACING_TYPES as readonly string[]).includes(node.type.name)) return true;
    apply(pos, node);
    return false;
  });

  if (!changed && selection.from === selection.to) {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const node = selection.$from.node(depth);
      if ((LINE_SPACING_TYPES as readonly string[]).includes(node.type.name)) {
        apply(selection.$from.before(depth), node);
        break;
      }
    }
  }

  if (!changed) return false;
  dispatch?.(tr);
  return true;
}

export const LineSpacing = Extension.create({
  name: "lineSpacing",

  addGlobalAttributes() {
    return [
      {
        types: [...LINE_SPACING_TYPES],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => {
              const el = element as HTMLElement;
              const data = el.getAttribute("data-line-height");
              if (data) return normalizeLineHeight(data);
              const style = el.style?.lineHeight;
              return normalizeLineHeight(style);
            },
            renderHTML: (attributes) => {
              const lh = normalizeLineHeight(attributes.lineHeight);
              if (!lh) return {};
              return {
                "data-line-height": lh,
                style: `line-height: ${lh}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineSpacing:
        (lineHeight: string) =>
        (props) =>
          setLineSpacingOnBlocks(normalizeLineHeight(lineHeight), props),
      unsetLineSpacing:
        () =>
        (props) =>
          setLineSpacingOnBlocks(null, props),
    };
  },
});
