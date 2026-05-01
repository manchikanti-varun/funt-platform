/**
 * Truncate rich-text HTML (e.g. Quill output) to a max number of text characters,
 * while preserving the original markup as much as possible.
 *
 * Notes:
 * - We count characters from text nodes only (tags don't count).
 * - If running on the server (no DOMParser), we fall back to plain-text truncation.
 */
export function truncateRichTextHtml(inputHtml: string | undefined | null, maxChars: number): string {
  const html = inputHtml ?? "";
  if (!html.trim() || maxChars <= 0) return "";

  // Fallback for any accidental SSR usage.
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html.replace(/<[^>]+>/g, "").trim().slice(0, maxChars);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const { body } = doc;

  let count = 0;
  let reachedLimit = false;

  const cloneShallowElement = (node: Element): Element => {
    const el = doc.createElement(node.tagName.toLowerCase());
    // Preserve attributes/classes/styles from the source HTML.
    for (const attr of Array.from(node.attributes)) {
      el.setAttribute(attr.name, attr.value);
    }
    return el;
  };

  const processNode = (node: Node): Node | null => {
    if (reachedLimit) return null;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const remaining = maxChars - count;
      if (remaining <= 0) {
        reachedLimit = true;
        return null;
      }
      if (text.length <= remaining) {
        count += text.length;
        return doc.createTextNode(text);
      }
      count = maxChars;
      reachedLimit = true;
      return doc.createTextNode(text.slice(0, remaining));
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tag = element.tagName.toLowerCase();

      // Quill uses <br> often; don't count it as text.
      if (tag === "br") {
        return doc.createElement("br");
      }

      const outEl = cloneShallowElement(element);

      for (const child of Array.from(element.childNodes)) {
        const outChild = processNode(child);
        if (outChild) outEl.appendChild(outChild);
        if (reachedLimit) break;
      }

      return outEl;
    }

    // Skip comments/others.
    return null;
  };

  const out = doc.createElement("div");
  for (const node of Array.from(body.childNodes)) {
    if (reachedLimit) break;
    const outNode = processNode(node);
    if (outNode) out.appendChild(outNode);
  }

  return out.innerHTML;
}

