import { isGoogleDriveUrl, resolveImageEmbedUrl } from "@funt-platform/rich-text-editor";

/** URL suitable for `<img src>` (resolves Google Drive share links to thumbnails). */
export function courseCardImagePreviewSrc(url: string | undefined | null): string | undefined {
  const t = String(url ?? "").trim();
  if (!t) return undefined;
  if (/^data:image\//i.test(t)) return t;
  if (!/^https?:\/\//i.test(t)) return undefined;
  return resolveImageEmbedUrl(t, 800);
}

export function courseCardImageLinkLabel(url: string): string {
  if (isGoogleDriveUrl(url)) return "Google Drive link";
  return "Image URL";
}

export function isValidCourseCardImageLink(raw: string): boolean {
  const t = raw.trim();
  return /^https?:\/\//i.test(t);
}
