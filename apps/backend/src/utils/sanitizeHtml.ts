/**
 * Server-side HTML sanitization for rich-text content fields.
 *
 * Defense-in-depth: the frontends already sanitize on render (DOMPurify),
 * but this layer ensures stored content is clean regardless of which client
 * wrote it (prevents stored XSS for future API consumers / mobile apps).
 *
 * Uses a permissive allowlist suitable for educational rich-text content:
 * headings, lists, tables, images, videos, links, code blocks, etc.
 * Strips <script>, <style>, event handlers, and javascript: URIs.
 */

import sanitize from "sanitize-html";

const ALLOWED_TAGS = [
  // Block
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "div", "blockquote", "pre", "code",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "figure", "figcaption", "hr", "br",
  // Inline
  "a", "strong", "b", "em", "i", "u", "s", "del", "ins",
  "mark", "small", "sub", "sup", "span", "abbr",
  // Media
  "img", "video", "source", "audio", "iframe",
  // Other
  "details", "summary",
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  "*": ["class", "id", "style", "data-*"],
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "width", "height", "loading"],
  video: ["src", "controls", "width", "height", "poster", "preload"],
  source: ["src", "type"],
  audio: ["src", "controls"],
  iframe: ["src", "width", "height", "frameborder", "allowfullscreen", "allow", "title"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  col: ["span"],
  colgroup: ["span"],
};

const ALLOWED_IFRAME_HOSTNAMES = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "drive.google.com",
];

const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ["http", "https", "data", "r2"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    video: ["http", "https", "r2"],
    source: ["http", "https", "r2"],
    a: ["http", "https", "mailto"],
    iframe: ["https"],
  },
  allowedIframeHostnames: ALLOWED_IFRAME_HOSTNAMES,
  // Strip all event handler attributes (onclick, onerror, etc.)
  disallowedTagsMode: "discard",
  // Allow data attributes
  allowedClasses: { "*": true as unknown as string[] },
};

/**
 * Sanitize HTML content for safe storage.
 * Returns the sanitized HTML string, or the original if it's not HTML.
 */
export function sanitizeRichText(html: string | undefined | null): string {
  if (!html) return "";
  const trimmed = html.trim();
  if (!trimmed) return "";
  // Quick check: if it doesn't look like HTML at all, return as-is
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return sanitize(trimmed, SANITIZE_OPTIONS);
}
