import { AppError } from "./AppError.js";

export const MAX_HEADER_IMAGE_URL_LEN = 2_500_000;

const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

function extractGoogleDriveFileId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!DRIVE_HOSTS.has(url.hostname.toLowerCase())) return null;
  const byQuery = url.searchParams.get("id");
  if (byQuery) return byQuery;
  const parts = url.pathname.split("/").filter(Boolean);
  const dIndex = parts.indexOf("d");
  if (dIndex >= 0 && parts[dIndex + 1]) return parts[dIndex + 1];
  return null;
}

/** Turn share/view links into a URL suitable for `<img src>`. */
export function resolveHeaderImageDisplayUrl(input: string, size: 220 | 400 | 800 = 800): string {
  const trimmed = input.trim();
  if (!trimmed || /^data:image\//i.test(trimmed)) return trimmed;
  const id = extractGoogleDriveFileId(trimmed);
  if (!id) return trimmed;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;
}

export function assertHeaderImageUrl(raw: string, entityLabel = "Course"): string {
  const t = raw.trim();
  if (!t) throw new AppError(`${entityLabel} header image value is empty`, 400);
  if (t.length > MAX_HEADER_IMAGE_URL_LEN) {
    throw new AppError(
      `${entityLabel} header image is too large. Use a smaller image, a Google Drive link, or paste an https URL.`,
      400
    );
  }
  const dataOk = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(t);
  const urlOk = /^https?:\/\//i.test(t);
  if (!dataOk && !urlOk) {
    throw new AppError(
      `${entityLabel} header image must be an image data URL, Google Drive share link, or http(s) URL.`,
      400
    );
  }
  return t;
}
