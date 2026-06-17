
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CertificatePdfData {
  certificateId: string;
  studentName: string;
  courseName: string;
  issuedAt: Date;
  durationText?: string;
}

export type CertificatePlaceholder = "studentName" | "courseName" | "certificateId" | "issuedDate";

export interface CertificateLayoutBlock {
    type: "text";
    label?: string;
    placeholder?: CertificatePlaceholder;
    text?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
    marginBottom?: number;
}

export interface CertificateLayoutTemplate {
    size?: "A4" | "letter";
    margin?: number;
    organization?: string;
    title?: string;
    blocks: CertificateLayoutBlock[];
    footer?: string;
}

const DEFAULT_TEMPLATE: CertificateLayoutTemplate = {
  size: "A4",
  margin: 72,
  organization: "FUNT Robotics Academy",
  title: "Certificate of Completion",
  blocks: [
    { type: "text", text: "{{organization}}", fontSize: 24, align: "center", marginBottom: 8 },
    { type: "text", text: "{{title}}", fontSize: 18, align: "center", marginBottom: 24 },
    {
      type: "text",
      label: "This is to certify that ",
      placeholder: "studentName",
      text: " has successfully completed the course:",
      fontSize: 12,
      align: "center",
      marginBottom: 8,
    },
    { type: "text", placeholder: "courseName", fontSize: 14, align: "center", marginBottom: 24 },
    { type: "text", label: "Certificate ID: ", placeholder: "certificateId", fontSize: 10, align: "center", marginBottom: 4 },
    { type: "text", label: "Issue Date: ", placeholder: "issuedDate", fontSize: 10, align: "center", marginBottom: 48 },
  ],
  footer: "Verify at: /verify/{{certificateId}}",
};

function getTemplatePath(): string {
  
  const backendRoot = join(__dirname, "..", "..");
  return join(backendRoot, "templates", "certificate.json");
}

// ─── Cached template (loaded once on first call, avoids sync fs on every request) ───
let _cachedTemplate: CertificateLayoutTemplate | null = null;
let _cachedImagePath: string | null | undefined = undefined;

export function loadCertificateTemplate(): CertificateLayoutTemplate {
  if (_cachedTemplate) return _cachedTemplate;
  const path = getTemplatePath();
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw) as Partial<CertificateLayoutTemplate>;
      if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        _cachedTemplate = {
          size: parsed.size ?? DEFAULT_TEMPLATE.size,
          margin: parsed.margin ?? DEFAULT_TEMPLATE.margin,
          organization: parsed.organization ?? DEFAULT_TEMPLATE.organization,
          title: parsed.title ?? DEFAULT_TEMPLATE.title,
          blocks: parsed.blocks,
          footer: parsed.footer ?? DEFAULT_TEMPLATE.footer,
        };
        return _cachedTemplate;
      }
    } catch {
      
    }
  }
  _cachedTemplate = DEFAULT_TEMPLATE;
  return _cachedTemplate;
}

function substitute(str: string, data: Record<string, string>): string {
  let out = str;
  for (const [key, value] of Object.entries(data)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return out;
}

function getTemplateImagePath(): string | null {
  if (_cachedImagePath !== undefined) return _cachedImagePath;
  const backendRoot = join(__dirname, "..", "..");
  const templatePath = join(backendRoot, "templates", "certificate-template.png");
  _cachedImagePath = existsSync(templatePath) ? templatePath : null;
  return _cachedImagePath;
}

function generateImageTemplateCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  const imagePath = getTemplateImagePath();
  if (!imagePath) {
    throw new Error("Certificate template image not found");
  }

  return new Promise((resolve, reject) => {
    const probe = new PDFDocument({ autoFirstPage: false });
    const image = probe.openImage(imagePath);
    const pageWidth = image.width;
    const pageHeight = image.height;
    probe.destroy();

    const doc = new PDFDocument({
      autoFirstPage: true,
      size: [pageWidth, pageHeight],
      margin: 0
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const issuedDateRaw = data.issuedAt instanceof Date ? data.issuedAt : new Date(data.issuedAt);
    const issuedDate = Number.isNaN(issuedDateRaw.getTime())
      ? "—"
      : `${String(issuedDateRaw.getDate()).padStart(2, "0")}/${String(issuedDateRaw.getMonth() + 1).padStart(2, "0")}/${issuedDateRaw.getFullYear()}`;
    const durationText = (data.durationText ?? "—").trim() || "—";
    const shrinkToFit = (
      text: string,
      maxWidth: number,
      baseSize: number,
      minSize: number,
      fontName: string
    ): number => {
      doc.font(fontName);
      let size = baseSize;
      while (size > minSize) {
        doc.fontSize(size);
        if (doc.widthOfString(text) <= maxWidth) break;
        size -= 1;
      }
      return size;
    };

    doc.image(imagePath, 0, 0, { width: pageWidth, height: pageHeight });

    const bottomPad = Math.max(8, Math.round(pageHeight * 0.018));

    // Metadata block (left side): render one line per field with labels so the template
    // can omit printed values and keep the dynamic content aligned.
    // Target the black outlined box at bottom-left in the final template image.
    const metaX = pageWidth * 0.170;
    const certWidth = pageWidth * 0.24;
    const courseWidth = pageWidth * 0.24;
    const rowGap = Math.max(3, Math.round(pageHeight * 0.008));
    const hCertRow = Math.max(19, Math.round(pageHeight * 0.03));
    const hCourseRow = Math.max(19, Math.round(pageHeight * 0.03));
    const hDateRow = Math.max(19, Math.round(pageHeight * 0.03));
    const hDurRow = Math.max(19, Math.round(pageHeight * 0.03));
    const metaBand = hCertRow + rowGap + hCourseRow + rowGap + hDateRow + rowGap + hDurRow + bottomPad;
    const metaStartY = Math.min(pageHeight * 0.81, pageHeight - metaBand);

    const nameBoxWidth = pageWidth * 0.74;
    const nameX = (pageWidth - nameBoxWidth) / 2;
    const nameY = Math.round(pageHeight * 0.5);
    const nameMaxHeight = Math.max(36, metaStartY - nameY - rowGap * 2);

    const fitFontHeight = (
      text: string,
      width: number,
      maxHeight: number,
      maxSize: number,
      minSize: number,
      fontName: string
    ): number => {
      doc.font(fontName);
      let size = maxSize;
      while (size >= minSize) {
        doc.fontSize(size);
        const h = doc.heightOfString(text, { width });
        if (h <= maxHeight) return size;
        size -= 1;
      }
      return minSize;
    };

    const nameSize = fitFontHeight(data.studentName, nameBoxWidth, nameMaxHeight, 44, 20, "Helvetica-Bold");
    doc.font("Helvetica-Bold")
      .fillColor("#111111")
      .fontSize(nameSize)
      .text(data.studentName, nameX, nameY, {
        width: nameBoxWidth,
        align: "center",
        height: nameMaxHeight,
        ellipsis: true,
        lineGap: 2,
      });

    let yRow = metaStartY;
    doc.font("Helvetica-Bold").fillColor("#111111").fontSize(14);
    const certLine = `Certificate No. : ${data.certificateId}`;
    const certSize = shrinkToFit(certLine, certWidth, 14, 8, "Helvetica-Bold");
    doc.fontSize(certSize).text(certLine, metaX, yRow, { lineBreak: false });
    yRow += hCertRow + rowGap;

    const courseLine = `Course : ${data.courseName}`;
    const courseSize = shrinkToFit(courseLine, courseWidth, 14, 8, "Helvetica-Bold");
    doc.fontSize(courseSize).text(courseLine, metaX, yRow, { lineBreak: false });
    yRow += hCourseRow + rowGap;

    const dateLine = `Date : ${issuedDate}`;
    const dateSize = shrinkToFit(dateLine, certWidth, 14, 8, "Helvetica-Bold");
    doc.fontSize(dateSize).text(dateLine, metaX, yRow, { lineBreak: false });
    yRow += hDateRow + rowGap;

    const durationLine = `Duration : ${durationText}`;
    const durationSize = shrinkToFit(durationLine, certWidth, 14, 8, "Helvetica-Bold");
    doc.fontSize(durationSize).text(durationLine, metaX, yRow, { lineBreak: false });

    doc.end();
  });
}

export function generateCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  const templateImagePath = getTemplateImagePath();
  if (templateImagePath) {
    return generateImageTemplateCertificatePdf(data);
  }

  const template = loadCertificateTemplate();
  const issuedDate = data.issuedAt instanceof Date
    ? data.issuedAt.toLocaleDateString()
    : new Date(data.issuedAt).toLocaleDateString();
  const values: Record<string, string> = {
    studentName: data.studentName,
    courseName: data.courseName,
    certificateId: data.certificateId,
    issuedDate,
    organization: template.organization ?? "",
    title: template.title ?? "",
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: template.size ?? "A4",
      margin: template.margin ?? 72,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const block of template.blocks) {
      if (block.type !== "text") continue;
      let text: string;
      if (block.placeholder !== undefined) {
        const label = block.label ?? "";
        const value = values[block.placeholder] ?? "";
        const suffix = block.text ?? "";
        text = label + value + substitute(suffix, values);
      } else if (block.text) {
        text = substitute(block.text, values);
      } else {
        text = block.label ?? "";
      }
      const fontSize = block.fontSize ?? 12;
      const align = block.align ?? "left";
      doc.fontSize(fontSize).text(text, { align });
      doc.moveDown(block.marginBottom != null ? block.marginBottom / 12 : 1);
    }

    if (template.footer) {
      const footerText = substitute(template.footer, values);
      doc.fontSize(8).text(footerText, { align: "center" });
    }
    doc.end();
  });
}
