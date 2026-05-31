const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export function extractGoogleDriveFileId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!DRIVE_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  const byQuery = url.searchParams.get("id");
  if (byQuery) return byQuery;

  const parts = url.pathname.split("/").filter(Boolean);
  const dIndex = parts.indexOf("d");
  if (dIndex >= 0 && parts[dIndex + 1]) {
    return parts[dIndex + 1];
  }
  return null;
}

export function toGoogleDrivePreviewUrl(input: string): string {
  const id = extractGoogleDriveFileId(input);
  if (!id) return input;
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
}

export function toGoogleDriveThumbnailUrl(input: string, size: 220 | 400 | 800 = 400): string {
  const id = extractGoogleDriveFileId(input);
  if (!id) return input;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;
}

export function isGoogleDriveUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return DRIVE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Turn share/view links into a URL suitable for `<img src>`. */
export function resolveImageEmbedUrl(input: string, size: 220 | 400 | 800 = 800): string {
  const trimmed = input.trim();
  if (!trimmed || !isGoogleDriveUrl(trimmed)) {
    return trimmed;
  }
  return toGoogleDriveThumbnailUrl(trimmed, size);
}

function driveIframeFromAttrs(attrs: string, rest: string, quote: string, preview: string): string {
  const merged = `${attrs}${rest}`.replace(/\scontrols\b/i, "");
  return `<iframe src=${quote}${preview}${quote}${merged} data-rte-video="true" data-render-kind="embed" allow="autoplay; fullscreen" allowfullscreen frameborder="0" class="rte-video rte-video-embed rte-video-align-center"></iframe>`;
}

/** Rewrite Google Drive image sources in stored HTML (LMS/admin read views). */
export function rewriteGoogleDriveImagesInHtml(html: string): string {
  return html.replace(
    /<img\b([^>]*?)\ssrc=(["'])([^"']+)\2/gi,
    (match, attrs: string, quote: string, src: string) => {
      if (!isGoogleDriveUrl(src)) {
        return match;
      }
      const resolved = resolveImageEmbedUrl(src);
      if (resolved === src) {
        return match;
      }
      return `<img${attrs} src=${quote}${resolved}${quote}`;
    }
  );
}

/** Fix embedded media in stored HTML for read views (Drive previews, video data URLs). */
export function rewriteEmbeddedMediaInHtml(html: string): string {
  let out = html;

  // Videos mistakenly inserted via the image upload path (data URL).
  out = out.replace(
    /<img\b([^>]*?)\ssrc=(["'])(data:video\/[^"']+)\2([^>]*)>/gi,
    (_match, _attrs: string, quote: string, src: string) =>
      `<video src=${quote}${src}${quote} controls playsinline preload="metadata" class="rte-video rte-video-align-center"></video>`
  );

  // Google Drive share links in <img> (not thumbnails) → playable iframe embed.
  out = out.replace(
    /<img\b([^>]*?)\ssrc=(["'])([^"']+)\2([^>]*)>/gi,
    (match, attrs: string, quote: string, src: string, rest: string) => {
      if (!isGoogleDriveUrl(src) || src.includes("/thumbnail?")) {
        return match;
      }
      const preview = toGoogleDrivePreviewUrl(src);
      if (preview === src) return match;
      return driveIframeFromAttrs(attrs, rest, quote, preview);
    }
  );

  // Images explicitly marked as video in the editor.
  out = out.replace(
    /<img\b([^>]*\bdata-rte-video=(["'])true\2[^>]*)>/gi,
    (match, inner: string) => {
      const srcMatch = inner.match(/\ssrc=(["'])([^"']+)\1/i);
      if (!srcMatch) return match;
      const quote = srcMatch[1];
      const src = srcMatch[2];
      const preview = isGoogleDriveUrl(src) ? toGoogleDrivePreviewUrl(src) : src;
      const attrs = inner.replace(/\ssrc=(["'])[^"']+\1/i, "");
      return driveIframeFromAttrs(attrs, "", quote, preview);
    }
  );

  out = rewriteGoogleDriveImagesInHtml(out);

  out = out.replace(
    /<iframe\b([^>]*?)\ssrc=(["'])([^"']+)\2/gi,
    (match, attrs: string, quote: string, src: string) => {
      if (!isGoogleDriveUrl(src) || src.includes("/preview")) {
        return match;
      }
      const preview = toGoogleDrivePreviewUrl(src);
      if (preview === src) return match;
      return `<iframe${attrs} src=${quote}${preview}${quote}`;
    }
  );

  out = out.replace(
    /<video\b([^>]*?)\ssrc=(["'])([^"']+)\2([^>]*)>/gi,
    (match, attrs: string, quote: string, src: string, rest: string) => {
      if (!isGoogleDriveUrl(src)) {
        return match;
      }
      const preview = toGoogleDrivePreviewUrl(src);
      return driveIframeFromAttrs(attrs, rest, quote, preview);
    }
  );

  return out;
}
