/**
 * Generate certificate PDF from template (JSON layout) or built-in default.
 * Template can be provided via file at templates/certificate.json (see CertificateLayoutTemplate type).
 */

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
}

/** Placeholders allowed in template blocks: {{studentName}}, {{courseName}}, {{certificateId}}, {{issuedDate}} */
export type CertificatePlaceholder = "studentName" | "courseName" | "certificateId" | "issuedDate";

export interface CertificateLayoutBlock {
  /** Static text or placeholder key (e.g. "studentName") wrapped as {{key}} in final text */
  type: "text";
  /** Optional static label before the placeholder (e.g. "Certificate ID: ") */
  label?: string;
  /** Placeholder key – value is inserted here. Use one of: studentName, courseName, certificateId, issuedDate */
  placeholder?: CertificatePlaceholder;
  /** Full static text (no placeholder). If set, label/placeholder are ignored. */
  text?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  /** Extra space below this block (in points, approximate) */
  marginBottom?: number;
}

export interface CertificateLayoutTemplate {
  /** Page size: A4 or letter */
  size?: "A4" | "letter";
  /** Margin in points (default 72) */
  margin?: number;
  /** Organization/school name at top */
  organization?: string;
  /** Main title (e.g. "Certificate of Completion") */
  title?: string;
  /** Ordered blocks to render (text lines with optional placeholders) */
  blocks: CertificateLayoutBlock[];
  /** Footer line (e.g. "Verify at: /verify/{{certificateId}}") – can use {{certificateId}} */
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
  // From dist/utils go up to backend root so templates/certificate.json is backend/templates/certificate.json
  const backendRoot = join(__dirname, "..", "..");
  return join(backendRoot, "templates", "certificate.json");
}

/** Load template from file if it exists; otherwise return default. */
export function loadCertificateTemplate(): CertificateLayoutTemplate {
  const path = getTemplatePath();
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw) as Partial<CertificateLayoutTemplate>;
      if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        return {
          size: parsed.size ?? DEFAULT_TEMPLATE.size,
          margin: parsed.margin ?? DEFAULT_TEMPLATE.margin,
          organization: parsed.organization ?? DEFAULT_TEMPLATE.organization,
          title: parsed.title ?? DEFAULT_TEMPLATE.title,
          blocks: parsed.blocks,
          footer: parsed.footer ?? DEFAULT_TEMPLATE.footer,
        };
      }
    } catch {
      // fall back to default
    }
  }
  return DEFAULT_TEMPLATE;
}

function substitute(str: string, data: Record<string, string>): string {
  let out = str;
  for (const [key, value] of Object.entries(data)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return out;
}

export function generateCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
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
