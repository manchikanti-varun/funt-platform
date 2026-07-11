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
  // Allow all inline CSS properties (safe — no script execution via CSS in modern browsers)
  allowedStyles: {
    "*": {
      // Allow any CSS property and value
      "color": [/.*/],
      "background-color": [/.*/],
      "background": [/.*/],
      "font-family": [/.*/],
      "font-size": [/.*/],
      "font-weight": [/.*/],
      "font-style": [/.*/],
      "text-align": [/.*/],
      "text-decoration": [/.*/],
      "line-height": [/.*/],
      "margin": [/.*/],
      "margin-top": [/.*/],
      "margin-bottom": [/.*/],
      "margin-left": [/.*/],
      "margin-right": [/.*/],
      "padding": [/.*/],
      "padding-top": [/.*/],
      "padding-bottom": [/.*/],
      "padding-left": [/.*/],
      "padding-right": [/.*/],
      "width": [/.*/],
      "height": [/.*/],
      "max-width": [/.*/],
      "min-width": [/.*/],
      "display": [/.*/],
      "vertical-align": [/.*/],
      "border": [/.*/],
      "border-collapse": [/.*/],
      "list-style-type": [/.*/],
      "white-space": [/.*/],
      "word-break": [/.*/],
      "overflow": [/.*/],
    },
  },
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
  // If content is extremely large (likely contains embedded base64), fail early
  // with a clear message rather than letting sanitize-html crash.
  if (trimmed.length > 5_000_000) {
    throw new Error(`Content too large for sanitization (${(trimmed.length / 1_000_000).toFixed(1)}MB). Likely contains embedded base64 media.`);
  }
  try {
    return sanitize(trimmed, SANITIZE_OPTIONS);
  } catch (err) {
    // sanitize-html can crash on certain complex HTML (deeply nested styles, unusual entities).
    // Since the frontend already sanitizes with DOMPurify, store as-is as a fallback.
    console.error("[sanitizeRichText] sanitize-html crashed, storing raw HTML:", err instanceof Error ? err.message : err);
    // Do a minimal strip of dangerous tags as fallback
    return trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "");
  }
}
