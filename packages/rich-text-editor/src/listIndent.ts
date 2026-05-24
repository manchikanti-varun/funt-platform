import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { liftListItem, sinkListItem } from "@tiptap/pm/schema-list";
import { TextSelection } from "@tiptap/pm/state";
import { collectIndentableBlockPositions } from "./blockIndent.js";

export type ListItemNodeName = "listItem" | "taskItem";

export function selectionContainsNodeType(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  typeName: string
): boolean {
  let found = false;
  doc.nodesBetween(from, to, (node) => {
    if (node.type.name === typeName) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

export function collectListItemPositions(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  typeName: ListItemNodeName
): number[] {
  const positions: number[] = [];
  const seen = new Set<number>();

  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== typeName) return true;
    if (seen.has(pos)) return false;
    seen.add(pos);
    positions.push(pos);
    return false;
  });

  return positions;
}

/** Deepest list item type under cursor, or any type present in the selection. */
export function resolveListItemType(editor: Editor): ListItemNodeName | null {
  const { state } = editor;
  const { from, to, $from } = state.selection;

  if (selectionContainsNodeType(state.doc, from, to, "taskItem")) {
    return "taskItem";
  }
  if (selectionContainsNodeType(state.doc, from, to, "listItem")) {
    return "listItem";
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "taskItem" || name === "listItem") {
      return name as ListItemNodeName;
    }
  }

  if (editor.isActive("taskList")) return "taskItem";
  if (editor.isActive("bulletList") || editor.isActive("orderedList")) return "listItem";
  return null;
}

export function isInAnyList(editor: Editor): boolean {
  return resolveListItemType(editor) !== null;
}

export function adjustListItemsIndent(
  editor: Editor,
  mode: "indent" | "outdent",
  typeName?: ListItemNodeName
): boolean {
  const itemType = typeName ?? resolveListItemType(editor);
  if (!itemType) return false;

  const { view } = editor;
  const listItemNode = view.state.schema.nodes[itemType];
  if (!listItemNode) return false;

  if (mode === "outdent") {
    return liftListItem(listItemNode)(view.state, view.dispatch);
  }

  if (sinkListItem(listItemNode)(view.state, view.dispatch)) {
    return true;
  }

  const { from, to } = view.state.selection;
  const positions = collectListItemPositions(view.state.doc, from, to, itemType);
  if (positions.length === 0) return false;

  const ordered = [...positions].sort((a, b) => b - a);
  let changed = false;

  for (const pos of ordered) {
    const mappedPos = view.state.tr.mapping.map(pos, -1);
    const safePos = Math.max(1, Math.min(mappedPos + 1, view.state.doc.content.size - 1));
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(safePos), 1));
    view.dispatch(tr);
    if (sinkListItem(listItemNode)(view.state, view.dispatch)) {
      changed = true;
    }
  }

  return changed;
}

export interface MixedIndentSnapshot {
  listPositions: number[];
  taskPositions: number[];
  blockPositions: number[];
}

export function analyzeMixedIndentSelection(editor: Editor): MixedIndentSnapshot {
  const { state } = editor;
  const { from, to } = state.selection;

  return {
    listPositions: collectListItemPositions(state.doc, from, to, "listItem"),
    taskPositions: collectListItemPositions(state.doc, from, to, "taskItem"),
    blockPositions: collectIndentableBlockPositions(state.doc, from, to),
  };
}

/** Indent/outdent when selection mixes lists, task lists, and plain blocks. */
export function adjustMixedNestedIndent(editor: Editor, mode: "indent" | "outdent"): boolean {
  const snapshot = analyzeMixedIndentSelection(editor);
  const hasLists = snapshot.listPositions.length > 0 || snapshot.taskPositions.length > 0;
  const hasBlocks = snapshot.blockPositions.length > 0;

  if (!hasLists && !hasBlocks) {
    return mode === "indent" ? editor.commands.indentBlock() : editor.commands.outdentBlock();
  }

  if (hasLists && !hasBlocks) {
    if (snapshot.taskPositions.length > 0) {
      adjustListItemsIndent(editor, mode, "taskItem");
    }
    if (snapshot.listPositions.length > 0) {
      adjustListItemsIndent(editor, mode, "listItem");
    }
    return true;
  }

  if (hasBlocks && !hasLists) {
    return mode === "indent" ? editor.commands.indentBlock() : editor.commands.outdentBlock();
  }

  // Mixed: block indent + list nest in one action (Google Docs–style multi-structure edit).
  if (mode === "indent") {
    editor.commands.indentBlock();
    if (snapshot.taskPositions.length > 0) adjustListItemsIndent(editor, "indent", "taskItem");
    if (snapshot.listPositions.length > 0) adjustListItemsIndent(editor, "indent", "listItem");
  } else {
    if (snapshot.taskPositions.length > 0) adjustListItemsIndent(editor, "outdent", "taskItem");
    if (snapshot.listPositions.length > 0) adjustListItemsIndent(editor, "outdent", "listItem");
    editor.commands.outdentBlock();
  }
  return true;
}
