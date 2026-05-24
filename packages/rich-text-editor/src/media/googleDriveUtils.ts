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
