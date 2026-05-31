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

export function isGoogleDriveUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return DRIVE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
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
  const lower = trimmed.toLowerCase();
  return (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("vimeo.com")
  );
}
