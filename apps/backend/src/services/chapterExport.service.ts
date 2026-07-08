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
  const cleanedContent = cleanContentForWord(content);

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
function cleanContentForWord(html: string): string {
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

  return cleaned;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
