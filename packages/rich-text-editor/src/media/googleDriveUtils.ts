const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

/** Returns true when the URL should be embedded via iframe rather than a <video> element. */
function isEmbeddableVideoUrl(src: string): boolean {
  const value = src.trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith("data:video/")) return false;
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(value)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("vimeo.com")) return true;
    if (DRIVE_HOSTS.has(host)) return true;
  } catch {
    return false;
  }
  return false;
}

/** Convert a video URL to its embeddable iframe form (YouTube nocookie, Vimeo player, Drive preview). */
export function toEmbeddableIframeSrc(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host.includes("youtu.be")) {
    const id = path.split("/").filter(Boolean)[0];
    if (!id) return raw;
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host.includes("youtube.com")) {
    const parts = path.split("/").filter(Boolean);
    const watchId = url.searchParams.get("v");
    const embedId = parts[0] === "embed" ? parts[1] : "";
    const shortsId = parts[0] === "shorts" ? parts[1] : "";
    const id = watchId || embedId || shortsId;
    if (!id) return raw;
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host.includes("vimeo.com")) {
    const id = path.split("/").filter(Boolean).pop();
    if (!id) return raw;
    return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
  }
  if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
    const fileId = extractGoogleDriveFileId(raw);
    if (fileId) return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
  }
  return raw;
}

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
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview?rm=minimal`;
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
  const isDrive = preview.includes("drive.google.com");
  const sandboxAttr = isDrive ? ' sandbox="allow-scripts allow-same-origin"' : "";
  const iframe = `<iframe src=${quote}${preview}${quote}${merged} data-rte-video="true" data-render-kind="embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen frameborder="0"${sandboxAttr} style="width:100%;height:100%;border:none;" class="rte-video rte-video-embed rte-video-align-center"></iframe>`;
  if (isDrive) {
    return `<div class="rte-drive-video-wrap rte-video-align-center" style="position:relative;width:80%;aspect-ratio:16/9;overflow:hidden;">${iframe}<div class="rte-drive-overlay" style="position:absolute;top:0;right:0;width:80px;height:80px;z-index:10;background:#1a1a1a;pointer-events:all;"></div></div>`;
  }
  return `<iframe src=${quote}${preview}${quote}${merged} data-rte-video="true" data-render-kind="embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen frameborder="0" style="width:80%;aspect-ratio:16/9;" class="rte-video rte-video-embed rte-video-align-center"></iframe>`;
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
    /<iframe\b([^>]*?)\ssrc=(["'])([^"']+)\2([^>]*)>/gi,
    (match, attrs: string, quote: string, src: string, rest: string) => {
      // Convert Google Drive non-preview URLs to preview, apply sandbox + overlay
      if (isGoogleDriveUrl(src) && !src.includes("/preview")) {
        const preview = toGoogleDrivePreviewUrl(src);
        if (preview === src) return match;
        return driveIframeFromAttrs(attrs, rest, quote, preview);
      }
      // Existing Drive /preview iframes → wrap with sandbox + overlay
      if (isGoogleDriveUrl(src) && src.includes("/preview")) {
        const previewWithMinimal = src.includes("rm=minimal") ? src : `${src}${src.includes("?") ? "&" : "?"}rm=minimal`;
        return driveIframeFromAttrs(attrs, rest, quote, previewWithMinimal);
      }
      // Convert YouTube/Vimeo non-embed URLs (e.g. watch?v=) to embeddable form
      if (isEmbeddableVideoUrl(src)) {
        const embedSrc = toEmbeddableIframeSrc(src);
        if (embedSrc === src) return match;
        return `<iframe${attrs} src=${quote}${embedSrc}${quote}${rest}>`;
      }
      return match;
    }
  );

  out = out.replace(
    /<video\b([^>]*?)\ssrc=(["'])([^"']+)\2([^>]*)>/gi,
    (match, attrs: string, quote: string, src: string, rest: string) => {
      if (isGoogleDriveUrl(src)) {
        const preview = toGoogleDrivePreviewUrl(src);
        return driveIframeFromAttrs(attrs, rest, quote, preview);
      }
      if (isEmbeddableVideoUrl(src)) {
        const embedSrc = toEmbeddableIframeSrc(src);
        return driveIframeFromAttrs(attrs, rest, quote, embedSrc);
      }
      return match;
    }
  );

  // Anchor links that point to embeddable video URLs (YouTube, Vimeo, Drive)
  // and are the only meaningful content in a paragraph → convert to iframe embed.
  out = out.replace(
    /<p\b[^>]*>\s*<a\b[^>]*\shref=(["'])([^"']+)\1[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi,
    (match, _quote: string, href: string) => {
      const trimmedHref = href.trim();
      if (!isEmbeddableVideoUrl(trimmedHref)) return match;
      const embedSrc = toEmbeddableIframeSrc(trimmedHref);
      const isDrive = embedSrc.includes("drive.google.com");
      if (isDrive) {
        return `<div class="rte-drive-video-wrap rte-video-align-center" style="position:relative;width:80%;aspect-ratio:16/9;overflow:hidden;"><iframe src="${embedSrc}" data-rte-video="true" data-render-kind="embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen frameborder="0" sandbox="allow-scripts allow-same-origin" style="width:100%;height:100%;border:none;" class="rte-video rte-video-embed rte-video-align-center"></iframe><div class="rte-drive-overlay" style="position:absolute;top:0;right:0;width:80px;height:80px;z-index:10;background:#1a1a1a;pointer-events:all;"></div></div>`;
      }
      return `<iframe src="${embedSrc}" data-rte-video="true" data-render-kind="embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen frameborder="0" style="width:80%;aspect-ratio:16/9;" class="rte-video rte-video-embed rte-video-align-center"></iframe>`;
    }
  );

  // Standalone anchor links (not wrapped in <p>) that point to embeddable video URLs.
  out = out.replace(
    /<a\b[^>]*\shref=(["'])([^"']+)\1[^>]*>[^<]*<\/a>/gi,
    (match, _quote: string, href: string) => {
      const trimmedHref = href.trim();
      if (!isEmbeddableVideoUrl(trimmedHref)) return match;
      const embedSrc = toEmbeddableIframeSrc(trimmedHref);
      const isDrive = embedSrc.includes("drive.google.com");
      if (isDrive) {
        return `<div class="rte-drive-video-wrap rte-video-align-center" style="position:relative;width:80%;aspect-ratio:16/9;overflow:hidden;"><iframe src="${embedSrc}" data-rte-video="true" data-render-kind="embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen frameborder="0" sandbox="allow-scripts allow-same-origin" style="width:100%;height:100%;border:none;" class="rte-video rte-video-embed rte-video-align-center"></iframe><div class="rte-drive-overlay" style="position:absolute;top:0;right:0;width:80px;height:80px;z-index:10;background:#1a1a1a;pointer-events:all;"></div></div>`;
      }
      return `<iframe src="${embedSrc}" data-rte-video="true" data-render-kind="embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen frameborder="0" style="width:80%;aspect-ratio:16/9;" class="rte-video rte-video-embed rte-video-align-center"></iframe>`;
    }
  );

  return out;
}
