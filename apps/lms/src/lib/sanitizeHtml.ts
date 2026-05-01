import DOMPurify from "isomorphic-dompurify";

export const RICH_TEXT_VIEW_CLASS =
  "rich-text-view !p-0 max-w-none leading-7 [overflow-wrap:anywhere] [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li]:list-item [&_li>p]:my-0 [&_li[data-list='bullet']]:list-item [&_li[data-list='bullet']]:list-disc [&_li[data-list='bullet']]:ml-6 [&_li[data-list='ordered']]:list-item [&_li[data-list='ordered']]:list-decimal [&_li[data-list='ordered']]:ml-6 [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_a]:decoration-teal-300 [&_a]:underline-offset-2 [&_.ql-align-center]:text-center [&_.ql-align-right]:text-right [&_.ql-align-justify]:text-justify [&_.ql-indent-1]:pl-6 [&_.ql-indent-2]:pl-12 [&_.ql-indent-3]:pl-[4.5rem] [&_.ql-indent-4]:pl-24 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5";

function normalizeQuillLists(html: string): string {
  return html.replace(/<ol>([\s\S]*?)<\/ol>/gi, (full, inner: string) => {
    if (!/data-list=/i.test(inner)) return full;
    const liMatches = Array.from(inner.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi));
    if (liMatches.length === 0) return full;

    let out = "";
    let currentList: "ul" | "ol" | null = null;
    for (const m of liMatches) {
      const attrs = m[1] ?? "";
      const itemHtml = (m[2] ?? "").replace(/<span\b[^>]*class="[^"]*\bql-ui\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "");
      const isBullet = /data-list=(["'])bullet\1/i.test(attrs);
      const listTag: "ul" | "ol" = isBullet ? "ul" : "ol";
      const cleanedAttrs = attrs
        .replace(/\s{2,}/g, " ")
        .trim();
      const attrSuffix = cleanedAttrs ? ` ${cleanedAttrs}` : "";
      if (currentList !== listTag) {
        if (currentList) out += `</${currentList}>`;
        out += `<${listTag}>`;
        currentList = listTag;
      }
      out += `<li${attrSuffix}>${itemHtml}</li>`;
    }
    if (currentList) out += `</${currentList}>`;
    return out || full;
  });
}

function normalizeStandardLists(html: string): string {
  const withBullets = html.replace(/<ul\b([^>]*)>([\s\S]*?)<\/ul>/gi, (_full, ulAttrs: string, inner: string) => {
    const listAttrs = (ulAttrs ?? "").trim();
    const open = listAttrs ? `<ul ${listAttrs}>` : "<ul>";
    const normalizedInner = inner.replace(/<li(?![^>]*\bdata-list=)([^>]*)>/gi, (_m, liAttrs: string) => {
      const attrs = (liAttrs ?? "").trim();
      return attrs ? `<li data-list="bullet" ${attrs}>` : `<li data-list="bullet">`;
    });
    return `${open}${normalizedInner}</ul>`;
  });

  return withBullets.replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (_full, olAttrs: string, inner: string) => {
    const listAttrs = (olAttrs ?? "").trim();
    const open = listAttrs ? `<ol ${listAttrs}>` : "<ol>";
    const normalizedInner = inner.replace(/<li(?![^>]*\bdata-list=)([^>]*)>/gi, (_m, liAttrs: string) => {
      const attrs = (liAttrs ?? "").trim();
      return attrs ? `<li data-list="ordered" ${attrs}>` : `<li data-list="ordered">`;
    });
    return `${open}${normalizedInner}</ol>`;
  });
}

function normalizeParagraphColonLists(html: string): string {
  return html.replace(
    /(<p\b[^>]*>[\s\S]*?[:：]\s*<\/p>)\s*((?:<p\b[^>]*>[\s\S]*?<\/p>\s*){2,})/gi,
    (full, headingPara: string, followingParas: string) => {
      const items = Array.from(followingParas.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
        .map((m) => (m[1] ?? "").trim())
        .filter(Boolean);
      if (items.length < 2) return full;
      return `${headingPara}<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    }
  );
}

function normalizeBreakColonLists(html: string): string {
  return html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (full, attrs: string, content: string) => {
    const parts = content
      .split(/<br\s*\/?>/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 3) return full;

    const colonIndex = parts.findIndex((p) => /[:：]$/.test(p));
    if (colonIndex === -1 || colonIndex >= parts.length - 2) return full;

    const heading = parts.slice(0, colonIndex + 1).join("<br />");
    const items = parts.slice(colonIndex + 1);
    const attrSuffix = attrs?.trim() ? ` ${attrs.trim()}` : "";
    return `<p${attrSuffix}>${heading}</p><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
  });
}

function preserveEmptyParagraphs(html: string): string {
  // Quill represents blank lines as <p><br></p>; keep them visible in view mode.
  return html.replace(/<p\b([^>]*)>\s*(?:<br\s*\/?>|\u00a0|&nbsp;)?\s*<\/p>/gi, "<p$1>&nbsp;</p>");
}

export function decodeEncodedRichText(input: string | undefined | null): string {
  let out = (input ?? "").replace(/&nbsp;/gi, " ").replace(/\u00a0/g, " ");
  // Always decode quote/apostrophe/ampersand, but avoid eager < > decoding
  // because literal examples like "&lt;h1&gt;" should stay visible as text.
  for (let i = 0; i < 2; i += 1) {
    const next = out
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, "&");
    if (next === out) break;
    out = next;
  }
  const hasRealHtml = /<[a-z][\s\S]*>/i.test(out);
  const looksLikeEscapedHtml = /&lt;\s*(?:p|h[1-6]|ul|ol|li|blockquote|pre|code|a|img|hr|div|span|strong|em|u|s|br)\b/i.test(out);
  if (!hasRealHtml && looksLikeEscapedHtml) {
    for (let i = 0; i < 2; i += 1) {
      const next = out
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, "&");
      if (next === out) break;
      out = next;
    }
  }
  // Normalize JSX-style attributes accidentally pasted/stored as HTML.
  out = out.replace(/\bclassName=/gi, "class=");
  // If content was wrapped in editor chrome, keep only inner HTML.
  out = out.replace(
    /^\s*<div\b[^>]*\bclass=(["'])[^"']*\b(?:ql-editor|rte-prosemirror)\b[^"']*\1[^>]*>([\s\S]*?)<\/div>\s*$/i,
    "$2"
  );
  return out;
}

function plainTextToRichHtml(input: string): string {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = input.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let paragraphLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let previousLineEndsWithColon = false;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    out.push(`<p>${paragraphLines.map(escapeHtml).join("<br />")}</p>`);
    paragraphLines = [];
  };
  const openList = (type: "ul" | "ol") => {
    if (listType === type) return;
    if (listType) out.push(`</${listType}>`);
    out.push(`<${type}>`);
    listType = type;
  };
  const closeList = () => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      previousLineEndsWithColon = false;
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    const colonListItem = previousLineEndsWithColon;

    if (bulletMatch) {
      flushParagraph();
      openList("ul");
      out.push(`<li>${escapeHtml(bulletMatch[1])}</li>`);
      previousLineEndsWithColon = false;
      continue;
    }
    if (orderedMatch) {
      flushParagraph();
      openList("ol");
      out.push(`<li>${escapeHtml(orderedMatch[1])}</li>`);
      previousLineEndsWithColon = false;
      continue;
    }
    if (colonListItem) {
      flushParagraph();
      openList("ul");
      out.push(`<li>${escapeHtml(line)}</li>`);
      previousLineEndsWithColon = false;
      continue;
    }

    closeList();
    paragraphLines.push(line);
    previousLineEndsWithColon = /[:：]$/.test(line);
  }

  flushParagraph();
  closeList();
  return out.join("");
}

export function sanitizeHtml(html: string | undefined | null): string {
  const raw = decodeEncodedRichText(html);
  const hasHtmlTag = /<[a-z][\s\S]*>/i.test(raw);
  const source = hasHtmlTag ? raw : plainTextToRichHtml(raw);
  const normalized = preserveEmptyParagraphs(
    normalizeStandardLists(
      normalizeBreakColonLists(normalizeParagraphColonLists(normalizeQuillLists(source)))
    )
  );
  const safe = DOMPurify.sanitize(normalized, {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: ["class", "href", "target", "rel", "data-list"],
  });
  return safe;
}

/** One-line preview for cards/lists — course descriptions are often HTML from the editor. */
export function richTextToPlainPreview(html: string | undefined | null): string {
  const safe = sanitizeHtml(html ?? "");
  const text = safe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text;
}
