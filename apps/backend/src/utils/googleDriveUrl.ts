const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

function parseExternalUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

export function extractGoogleDriveFileId(input: string): string | null {
  const url = parseExternalUrl(input);
  if (!url) return null;
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

export function isGoogleDriveUrl(input: string): boolean {
  const url = parseExternalUrl(input);
  return !!url && DRIVE_HOSTS.has(url.hostname.toLowerCase());
}

export function toGoogleDrivePreviewUrl(input: string): string {
  const id = extractGoogleDriveFileId(input);
  if (!id) return input;
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
}

/** Drive / YouTube / Vimeo links need an iframe embed, not a native `<video>` tag. */
export function isEmbeddableHostedVideoUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (isGoogleDriveUrl(trimmed)) return true;
  const parsed = parseExternalUrl(trimmed);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host.includes("youtube.com") || host.includes("youtu.be") || host.includes("vimeo.com");
}
