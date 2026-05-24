import { Extension } from "@tiptap/core";
import type { CommandProps } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";

/** Pixels per indent level (~0.5 in, similar to Google Docs). */
export const BLOCK_INDENT_PX = 36;

export const BLOCK_INDENT_MAX = 8;

export const BLOCK_INDENT_TYPES = ["paragraph", "heading", "blockquote"] as const;

export type BlockIndentType = (typeof BLOCK_INDENT_TYPES)[number];

function parseIndentLevel(element: HTMLElement): number {
  const dataIndent = element.getAttribute("data-indent");
  if (dataIndent) {
    const n = Number.parseInt(dataIndent, 10);
    if (Number.isFinite(n) && n > 0) return Math.min(BLOCK_INDENT_MAX, n);
  }

  const classMatch = element.className.match(/(?:^|\s)(?:ql-indent|rte-indent)-(\d+)(?:\s|$)/);
  if (classMatch) {
    const n = Number.parseInt(classMatch[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(BLOCK_INDENT_MAX, n);
  }

  const paddingLeft = element.style.paddingLeft || element.style.marginLeft;
  if (paddingLeft) {
    const px = Number.parseFloat(paddingLeft);
    if (Number.isFinite(px) && px > 0) {
      return Math.min(BLOCK_INDENT_MAX, Math.max(1, Math.round(px / BLOCK_INDENT_PX)));
    }
  }

  return 0;
}

function normalizeIndentLevel(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(BLOCK_INDENT_MAX, Math.round(n));
}

export function isInsideListItem($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const name = $pos.node(depth).type.name;
    if (name === "listItem" || name === "taskItem") {
      return true;
    }
  }
  return false;
}

export function collectIndentableBlockPositions(doc: ProseMirrorNode, from: number, to: number): number[] {
  const positions: number[] = [];
  const seen = new Set<number>();

  doc.nodesBetween(from, to, (node, pos) => {
    if (!(BLOCK_INDENT_TYPES as readonly string[]).includes(node.type.name)) {
      return true;
    }
    if (isInsideListItem(doc.resolve(pos))) {
      return true;
    }
    if (seen.has(pos)) return false;
    seen.add(pos);
    positions.push(pos);
    return false;
  });

  return positions;
}

function findActiveBlockPos($from: ResolvedPos): number | null {
  if (isInsideListItem($from)) {
    return null;
  }
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if ((BLOCK_INDENT_TYPES as readonly string[]).includes(node.type.name)) {
      return $from.before(depth);
    }
  }
  return null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockIndent: {
      indentBlock: () => ReturnType;
      outdentBlock: () => ReturnType;
      resetBlockIndent: () => ReturnType;
    };
  }
}

export const BlockIndent = Extension.create({
  name: "blockIndent",

  addOptions() {
    return {
      types: [...BLOCK_INDENT_TYPES] as BlockIndentType[],
      maxLevel: BLOCK_INDENT_MAX,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => parseIndentLevel(element as HTMLElement),
            renderHTML: (attributes) => {
              const level = normalizeIndentLevel(attributes.indent);
              if (level <= 0) {
                return {};
              }
              return {
                "data-indent": String(level),
                class: `rte-indent rte-indent-${level}`,
                style: `padding-left: ${level * BLOCK_INDENT_PX}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const maxLevel = this.options.maxLevel;

    const adjustIndent =
      (delta: -1 | 1) =>
      () =>
      ({ state, dispatch }: CommandProps) => {
        const { selection } = state;
        const positions = collectIndentableBlockPositions(state.doc, selection.from, selection.to);

        if (positions.length === 0) {
          const activePos = findActiveBlockPos(selection.$from);
          if (activePos == null) return false;
          positions.push(activePos);
        }

        const tr = state.tr;
        let changed = false;

        for (const pos of positions) {
          const node = state.doc.nodeAt(pos);
          if (!node) continue;
          const current = normalizeIndentLevel(node.attrs.indent);
          const next =
            delta > 0 ? Math.min(maxLevel, current + 1) : Math.max(0, current - 1);
          if (next === current) continue;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        }

        if (!changed) return false;
        dispatch?.(tr);
        return true;
      };

    return {
      indentBlock: adjustIndent(1),
      outdentBlock: adjustIndent(-1),
      resetBlockIndent:
        () =>
        ({ state, dispatch }: CommandProps) => {
          const { selection } = state;
          const positions = collectIndentableBlockPositions(state.doc, selection.from, selection.to);
          const tr = state.tr;
          let changed = false;

          for (const pos of positions) {
            const node = state.doc.nodeAt(pos);
            if (!node || normalizeIndentLevel(node.attrs.indent) === 0) continue;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: 0 });
            changed = true;
          }

          if (!changed) return false;
          dispatch?.(tr);
          return true;
        },
    };
  },
});
