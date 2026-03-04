
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
