/**
 * Chapter Export Service — exports a global module (chapter) as a Word-compatible document.
 *
 * Generates an HTML file with .doc extension that Microsoft Word opens natively.
 * Includes: title, description, rich text content, video links, resource links.
 *
 * Temporary feature for Super Admin only.
 */

import { GlobalModuleModel } from "../models/GlobalModule.model.js";
import { AppError } from "../utils/AppError.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket } from "../config/r2.js";

/** Resolve Google Drive share/view URLs into direct thumbnail URLs for Word embedding. */
function resolveGoogleDriveImageUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") return trimmed;

  // Extract file ID
  const byQuery = url.searchParams.get("id");
  let fileId = byQuery ?? null;
  if (!fileId) {
    const parts = url.pathname.split("/").filter(Boolean);
    const dIndex = parts.indexOf("d");
    if (dIndex >= 0 && parts[dIndex + 1]) fileId = parts[dIndex + 1];
  }
  if (!fileId) return trimmed;

  // Return thumbnail URL that Word can fetch directly
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w800`;
}

/** Rewrite <img> src attributes: resolve Google Drive links to direct image URLs. */
function resolveImagesForExport(html: string): string {
  return html.replace(
    /<img\b([^>]*?)\ssrc=(["'])([^"']+)\2/gi,
    (match, attrs: string, quote: string, src: string) => {
      const resolved = resolveGoogleDriveImageUrl(src);
      if (resolved !== src) {
        return `<img${attrs} src=${quote}${resolved}${quote}`;
      }
      return match;
    }
  );
}

const R2_PREFIX = "r2://";

/** Fetch an R2 object and return it as a base64 data URL. Returns null on failure. */
async function fetchR2AsBase64(r2Url: string): Promise<string | null> {
  try {
    const key = r2Url.slice(R2_PREFIX.length);
    const client = getR2Client();
    const bucket = getR2Bucket();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);
    if (!response.Body) return null;

    const bytes = await response.Body.transformToByteArray();
    const contentType = response.ContentType || guessMimeFromKey(key);
    const base64 = Buffer.from(bytes).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error(`[chapterExport] Failed to fetch R2 object: ${r2Url}`, err);
    return null;
  }
}

function guessMimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Replace all r2:// src attributes in <img> tags with base64 data URLs. */
async function resolveR2ImagesForExport(html: string): Promise<string> {
  // Find all r2:// image sources
  const r2ImageRegex = /<img\b([^>]*?)\ssrc=(["'])(r2:\/\/[^"']+)\2/gi;
  const matches: Array<{ full: string; attrs: string; quote: string; r2Url: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = r2ImageRegex.exec(html)) !== null) {
    matches.push({ full: m[0], attrs: m[1], quote: m[2], r2Url: m[3] });
  }

  if (matches.length === 0) return html;

  // Fetch all R2 images in parallel
  const results = await Promise.all(
    matches.map(async (match) => ({
      ...match,
      dataUrl: await fetchR2AsBase64(match.r2Url),
    }))
  );

  // Replace in HTML
  let out = html;
  for (const { full, attrs, quote, r2Url, dataUrl } of results) {
    if (dataUrl) {
      out = out.replace(full, `<img${attrs} src=${quote}${dataUrl}${quote}`);
    } else {
      // If fetch failed, replace with a placeholder text
      out = out.replace(full, `<p><em>[Image: ${r2Url}]</em></p>`);
    }
  }
  return out;
}

export async function exportChapterAsDoc(moduleId: string): Promise<{ html: string; filename: string }> {
  // Try finding by _id or moduleId
  let module = await GlobalModuleModel.findById(moduleId).lean().exec();
  if (!module) {
    module = await GlobalModuleModel.findOne({ moduleId }).lean().exec();
  }
  if (!module) throw new AppError("Chapter not found", 404);

  const title = module.title ?? "Untitled Chapter";
  const description = module.description ?? "";
  const content = module.content ?? "";
  const youtubeUrl = (module as { youtubeUrl?: string }).youtubeUrl ?? "";
  const videoUrl = (module as { videoUrl?: string }).videoUrl ?? "";
  const resourceLinkUrl = (module as { resourceLinkUrl?: string }).resourceLinkUrl ?? "";

  // Build video links section
  const videoLinks: string[] = [];
  if (youtubeUrl) videoLinks.push(`<p><strong>YouTube Video:</strong> <a href="${youtubeUrl}">${youtubeUrl}</a></p>`);
  if (videoUrl && !videoUrl.startsWith("r2://")) videoLinks.push(`<p><strong>Video URL:</strong> <a href="${videoUrl}">${videoUrl}</a></p>`);
  if (videoUrl && videoUrl.startsWith("r2://")) videoLinks.push(`<p><strong>Hosted Video:</strong> ${videoUrl} (R2 storage — access via platform)</p>`);
  if (resourceLinkUrl) videoLinks.push(`<p><strong>Resource Link:</strong> <a href="${resourceLinkUrl}">${resourceLinkUrl}</a></p>`);

  const videoSection = videoLinks.length > 0
    ? `<h2 style="color:#4338ca;margin-top:30px;">Attached Media & Links</h2>\n${videoLinks.join("\n")}`
    : "";

  // Strip inline color spans that fragment text in Word — merge adjacent same-style spans
  const cleanedContent = await cleanContentForWord(content);

  // Generate Word-compatible HTML with MS Office namespace for proper rendering
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 1in; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; }
  h1 { color: #1e1b4b; font-size: 22pt; margin-bottom: 6px; text-align: center; }
  h2 { color: #1e1b4b; font-size: 14pt; margin-top: 20px; margin-bottom: 8px; }
  h3 { color: #1e1b4b; font-size: 12pt; margin-top: 16px; margin-bottom: 6px; }
  p { margin: 6px 0; font-size: 11pt; }
  .description { color: #475569; font-style: italic; font-size: 11pt; margin-bottom: 16px; text-align: center; }
  .content { font-size: 11pt; }
  .content img { max-width: 100%; height: auto; }
  .content table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  .content td, .content th { border: 1px solid #cbd5e1; padding: 8px; }
  .meta { color: #94a3b8; font-size: 9pt; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  a { color: #4338ca; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="description">${escapeHtml(description)}</p>

<div class="content">
${cleanedContent || "<p><em>No text content</em></p>"}
</div>

${videoSection}

<p class="meta">Exported from FUNT Robotics Academy &mdash; ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
</body>
</html>`;

  // Sanitize filename
  const safeName = title.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  const filename = `${safeName}.doc`;

  return { html, filename };
}

/**
 * Clean rich text HTML for better Word compatibility:
 * - Remove redundant color spans that fragment text
 * - Strip style attributes with only color that match body text color
 * - Ensure heading styles are preserved
 */
async function cleanContentForWord(html: string): Promise<string> {
  // Remove span tags that only set color close to default body text (dark grays/blacks)
  // These are common in rich text editors and fragment text in Word
  let cleaned = html.replace(
    /<span\s+style="color:\s*rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\);?">(.*?)<\/span>/gi,
    (_match, r, g, b, inner) => {
      const red = parseInt(r, 10);
      const green = parseInt(g, 10);
      const blue = parseInt(b, 10);
      // If it's a dark color (close to black/dark gray), strip the span
      if (red < 100 && green < 100 && blue < 100) {
        return inner;
      }
      return _match;
    }
  );

  // Remove empty spans
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, "");

  // Replace &nbsp; used as spacing with regular spaces in non-pre elements
  cleaned = cleaned.replace(
    /(<span[^>]*style="[^"]*font-family:\s*&quot;Times New Roman&quot;[^"]*"[^>]*>)(&nbsp;\s*)+(<\/span>)/gi,
    "    "
  );

  // Resolve R2 image URLs to embedded base64 data URLs (so Word can display them offline)
  cleaned = await resolveR2ImagesForExport(cleaned);

  // Resolve Google Drive image links to direct thumbnail URLs
  cleaned = resolveImagesForExport(cleaned);

  // Convert video/iframe embeds to linked text (Word can't render iframes)
  cleaned = cleaned.replace(
    /<iframe\b[^>]*\ssrc=(["'])([^"']+)\1[^>]*>.*?<\/iframe>/gi,
    (_match, _q, src) => `<p><strong>[Video]</strong> <a href="${src}">${src}</a></p>`
  );
  cleaned = cleaned.replace(
    /<video\b[^>]*\ssrc=(["'])([^"']+)\1[^>]*>.*?<\/video>/gi,
    (_match, _q, src) => {
      if (src.startsWith("data:")) return ""; // skip data URL videos
      return `<p><strong>[Video]</strong> <a href="${src}">${src}</a></p>`;
    }
  );

  // Remove wrapping divs used for video containers (rte-drive-video-wrap)
  cleaned = cleaned.replace(/<div\s+class="rte-drive-video-wrap[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, "");

  return cleaned;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
