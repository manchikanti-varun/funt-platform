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

  // Generate Word-compatible HTML
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; margin: 40px; line-height: 1.6; color: #1e293b; }
  h1 { color: #1e1b4b; font-size: 24pt; margin-bottom: 8px; }
  h2 { color: #4338ca; font-size: 16pt; margin-top: 24px; }
  .description { color: #475569; font-style: italic; font-size: 11pt; margin-bottom: 20px; }
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

<h2>Chapter Content</h2>
<div class="content">
${content || "<p><em>No text content</em></p>"}
</div>

${videoSection}

<p class="meta">Exported from FUNT Robotics Academy — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
</body>
</html>`;

  // Sanitize filename
  const safeName = title.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  const filename = `${safeName}.doc`;

  return { html, filename };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
