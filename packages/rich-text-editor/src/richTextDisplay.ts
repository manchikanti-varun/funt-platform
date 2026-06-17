/** Plain text from rich HTML for comparisons and search snippets. */
export function normalizeRichTextPlainText(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textsAreNearDuplicate(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 30 && longer.startsWith(shorter)) return true;

  const minLen = shorter.length;
  const maxLen = longer.length;
  if (minLen >= 40 && maxLen - minLen <= Math.max(20, Math.floor(maxLen * 0.12))) {
    const compareLen = Math.floor(minLen * 0.85);
    let matches = 0;
    for (let i = 0; i < compareLen; i += 1) {
      if (a[i] === b[i]) matches += 1;
    }
    if (matches / compareLen >= 0.9) return true;
  }

  return false;
}

/** True when a standalone description block adds information beyond chapter content. */
export function shouldShowChapterDescription(
  description: string | undefined | null,
  content: string | undefined | null,
): boolean {
  const normalizedContent = normalizeRichTextPlainText(content);
  if (normalizedContent) return false;

  return !!normalizeRichTextPlainText(description);
}

function dedupeBlockList(blocks: string[]): string[] {
  const out: string[] = [];
  let previousPlain = "";

  for (const block of blocks) {
    const plain = normalizeRichTextPlainText(block);
    if (!plain) {
      out.push(block);
      previousPlain = "";
      continue;
    }
    if (previousPlain && textsAreNearDuplicate(previousPlain, plain)) continue;
    out.push(block);
    previousPlain = plain;
  }

  return out;
}

function dedupeTopLevelBlocksWithDom(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc?.body;
  if (!body || !body.childNodes || body.childNodes.length === 0) {
    return html;
  }
  const blocks = Array.from(body.childNodes).map((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) return (node as Element).outerHTML;
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    return "";
  });

  return dedupeBlockList(blocks.filter(Boolean)).join("");
}

function dedupeTopLevelBlocksWithRegex(html: string): string {
  const blocks = Array.from(html.matchAll(/(<(?:p|h[1-6]|ul|ol|blockquote|pre|div|li)\b[\s\S]*?<\/(?:p|h[1-6]|ul|ol|blockquote|pre|div|li)>)/gi)).map(
    (m) => m[1] ?? "",
  );
  if (blocks.length < 2) return html;
  return dedupeBlockList(blocks).join("");
}

/** Remove consecutive near-duplicate top-level rich-text blocks (e.g. pasted twice). */
export function dedupeConsecutiveRichTextBlocks(html: string | undefined | null): string {
  const source = html ?? "";
  if (!source.trim()) return source;

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      return dedupeTopLevelBlocksWithDom(source);
    } catch {
      return dedupeTopLevelBlocksWithRegex(source);
    }
  }

  return dedupeTopLevelBlocksWithRegex(source);
}
