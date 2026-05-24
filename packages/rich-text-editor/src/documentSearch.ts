import type { Editor } from "@tiptap/core";

export interface TextMatch {
  from: number;
  to: number;
}

export function findTextMatch(
  editor: Editor,
  query: string,
  options?: { caseSensitive?: boolean; startFrom?: number }
): TextMatch | null {
  const term = query.trim();
  if (!term) return null;

  const { doc } = editor.state;
  const caseSensitive = options?.caseSensitive ?? false;
  const needle = caseSensitive ? term : term.toLowerCase();
  const startFrom = options?.startFrom ?? editor.state.selection.to;

  const searchFrom = (fromPos: number): TextMatch | null => {
    let found: TextMatch | null = null;
    doc.nodesBetween(fromPos, doc.content.size, (node, pos) => {
      if (found || !node.isText || !node.text) return false;
      const haystack = caseSensitive ? node.text : node.text.toLowerCase();
      const index = haystack.indexOf(needle);
      if (index === -1) return true;
      found = { from: pos + index, to: pos + index + term.length };
      return false;
    });
    return found;
  };

  const after = searchFrom(Math.max(0, startFrom));
  if (after) return after;
  if (startFrom <= 0) return null;
  return searchFrom(0);
}

export function replaceMatch(editor: Editor, match: TextMatch, replacement: string): boolean {
  if (!replacement && match.from === match.to) return false;
  return editor
    .chain()
    .focus()
    .insertContentAt({ from: match.from, to: match.to }, replacement)
    .run();
}

export function replaceAllText(
  editor: Editor,
  query: string,
  replacement: string,
  options?: { caseSensitive?: boolean }
): number {
  const term = query.trim();
  if (!term) return 0;

  let count = 0;
  let guard = 0;
  const max = 500;

  while (guard < max) {
    guard += 1;
    const match = findTextMatch(editor, term, { ...options, startFrom: 0 });
    if (!match) break;
    if (!replaceMatch(editor, match, replacement)) break;
    count += 1;
  }

  return count;
}
