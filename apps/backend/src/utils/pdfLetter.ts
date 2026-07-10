import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

// Colors
const PRIMARY = "#0f172a";     // slate-900
const SECONDARY = "#475569";   // slate-600
const ACCENT = "#4f46e5";      // indigo-600
const MUTED = "#94a3b8";       // slate-400

// Company details
const COMPANY_NAME = "FUNT Robotics Academy";
const COMPANY_PHONE = "+91 6305930640";
const COMPANY_EMAIL = "info@funt.in";
const COMPANY_ADDRESS = "2-20-2/211, Ganesh Nagar, Sai Nagar, Uppal, Hyderabad, Telangana 500039";
const COMPANY_WEBSITE = "www.funt.in";

function resolveLogoPath(): string | null {
  const candidates = [
    join(MODULE_DIR, "../../assets/funt-logo.png"),
    join(MODULE_DIR, "../../../assets/funt-logo.png"),
    resolve(process.cwd(), "assets/funt-logo.png"),
    resolve(process.cwd(), "dist/assets/funt-logo.png"),
    resolve(process.cwd(), "apps/backend/assets/funt-logo.png"),
    resolve(process.cwd(), "apps/backend/dist/assets/funt-logo.png"),
    resolve(process.cwd(), "apps/admin/public/funt-logo.png"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function employmentTypeLabel(type: string): string {
  switch (type) {
    case "INTERN": return "Intern";
    case "FULL_TIME": return "Full-Time Employee";
    case "PART_TIME": return "Part-Time Employee";
    case "CONTRACT": return "Contract Employee";
    default: return type;
  }
}

export interface OfferLetterData {
  letterId: string;
  recipientName: string;
  designation: string;
  department: string;
  employmentType: string;
  joiningDate: Date;
  stipend?: string;
  ctc?: string;
  location?: string;
  reportingTo?: string;
  issuedAt: Date;
}

export interface ExperienceLetterData {
  letterId: string;
  recipientName: string;
  designation: string;
  department: string;
  employmentType: string;
  joiningDate: Date;
  endDate: Date;
  performanceSummary?: string;
  issuedAt: Date;
}

async function generateQrBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { width: 80, margin: 1, errorCorrectionLevel: "M" });
}

function getVerifyUrl(letterId: string): string {
  const base = (process.env.VERIFY_PUBLIC_URL || "https://learn.funt.in").replace(/\/+$/, "");
  return `${base}/verify-letter?id=${encodeURIComponent(letterId)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawLetterhead(doc: any): void {
  const logoPath = resolveLogoPath();
  const startY = doc.y;

  // Logo
  if (logoPath) {
    doc.image(logoPath, 60, startY, { width: 60 });
  }

  // Company info (to the right of logo)
  const textX = logoPath ? 130 : 60;
  doc.fontSize(16).fillColor(PRIMARY).font("Helvetica-Bold")
    .text(COMPANY_NAME, textX, startY + 2, { width: 350 });
  doc.fontSize(8).fillColor(SECONDARY).font("Helvetica")
    .text(`${COMPANY_PHONE}  |  ${COMPANY_EMAIL}  |  ${COMPANY_WEBSITE}`, textX, startY + 22, { width: 380 });
  doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
    .text(COMPANY_ADDRESS, textX, startY + 34, { width: 380 });

  // Accent line under header
  const lineY = startY + 52;
  doc.moveTo(60, lineY).lineTo(doc.page.width - 60, lineY).strokeColor(ACCENT).lineWidth(2).stroke();
  doc.y = lineY + 20;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawFooter(doc: any, letterId: string, qrBuffer: Buffer): void {
  const verifyUrl = getVerifyUrl(letterId);
  const footerY = doc.page.height - 130;

  doc.moveTo(60, footerY).lineTo(doc.page.width - 60, footerY).strokeColor("#e2e8f0").lineWidth(0.5).stroke();

  doc.image(qrBuffer, 60, footerY + 8, { width: 55 });

  const txtX = 125;
  doc.fontSize(7.5).fillColor(SECONDARY).font("Helvetica")
    .text(`Verify this letter: ${verifyUrl}`, txtX, footerY + 10, { width: 380 });
  doc.text(`Letter ID: ${letterId}`, txtX, footerY + 22);
  doc.fontSize(7).fillColor(MUTED)
    .text("This document is electronically generated and digitally signed by FUNT Robotics Academy.", txtX, footerY + 38, { width: 380 });
  doc.text("It does not require a physical signature. Authenticity can be verified by scanning the QR code or visiting the URL above.", txtX, footerY + 49, { width: 380 });
  doc.text(`© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.`, txtX, footerY + 64, { width: 380 });
}

export async function generateOfferLetterPdf(data: OfferLetterData): Promise<Buffer> {
  const qrBuffer = await generateQrBuffer(getVerifyUrl(data.letterId));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Letterhead
    drawLetterhead(doc);

    // Title
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor(ACCENT).font("Helvetica-Bold")
      .text("OFFER LETTER", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`Ref: ${data.letterId}  |  Date: ${formatDate(data.issuedAt)}`, { align: "center" });
    doc.moveDown(1.5);

    // Body
    doc.fontSize(11).fillColor(PRIMARY).font("Helvetica");
    doc.text(`Dear ${data.recipientName},`, { align: "left" });
    doc.moveDown(0.8);

    doc.text(
      `We are pleased to offer you the position of "${data.designation}" in the ${data.department} department at ${COMPANY_NAME} as a ${employmentTypeLabel(data.employmentType)}.`,
      { align: "left", lineGap: 3 }
    );
    doc.moveDown(0.8);

    doc.text("The details of your appointment are as follows:", { align: "left" });
    doc.moveDown(0.6);

    // Details
    const details: Array<[string, string]> = [
      ["Position", data.designation],
      ["Department", data.department],
      ["Employment Type", employmentTypeLabel(data.employmentType)],
      ["Date of Joining", formatDate(data.joiningDate)],
      ["Location", data.location || "Remote"],
    ];
    if (data.stipend) details.push(["Stipend / Compensation", data.stipend]);
    if (data.ctc) details.push(["CTC", data.ctc]);
    if (data.reportingTo) details.push(["Reporting To", data.reportingTo]);

    const tableX = 80;
    for (const [label, value] of details) {
      doc.font("Helvetica-Bold").fontSize(10).text(`${label}:`, tableX, doc.y, { continued: true, width: 180 });
      doc.font("Helvetica").text(`  ${value}`, { width: 300 });
      doc.moveDown(0.2);
    }

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(11).text(
      "We are confident that your skills and experience will be a valuable addition to our team. Please confirm your acceptance by signing and returning a copy of this letter.",
      60, doc.y, { align: "left", lineGap: 3, width: doc.page.width - 120 }
    );
    doc.moveDown(0.6);
    doc.text("We look forward to welcoming you aboard and wish you a rewarding career with us.", { align: "left", lineGap: 3 });
    doc.moveDown(2);

    // Signature block
    doc.font("Helvetica-Bold").fontSize(11).text(`For ${COMPANY_NAME}`, 60);
    doc.moveDown(2.5);
    doc.moveTo(60, doc.y).lineTo(200, doc.y).strokeColor(PRIMARY).lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor(SECONDARY).text("Authorized Signatory");

    // Footer
    drawFooter(doc, data.letterId, qrBuffer);

    doc.end();
  });
}

export async function generateExperienceLetterPdf(data: ExperienceLetterData): Promise<Buffer> {
  const qrBuffer = await generateQrBuffer(getVerifyUrl(data.letterId));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Letterhead
    drawLetterhead(doc);

    // Title
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor(ACCENT).font("Helvetica-Bold")
      .text("EXPERIENCE LETTER", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`Ref: ${data.letterId}  |  Date: ${formatDate(data.issuedAt)}`, { align: "center" });
    doc.moveDown(1.5);

    // To Whom It May Concern
    doc.fontSize(12).fillColor(PRIMARY).font("Helvetica-Bold")
      .text("To Whom It May Concern", { align: "left" });
    doc.moveDown(1);

    // Body
    doc.fontSize(11).fillColor(PRIMARY).font("Helvetica");
    doc.text(
      `This is to certify that ${data.recipientName} was associated with ${COMPANY_NAME} as a ${employmentTypeLabel(data.employmentType)} in the ${data.department} department from ${formatDate(data.joiningDate)} to ${formatDate(data.endDate)}.`,
      { align: "left", lineGap: 3 }
    );
    doc.moveDown(0.8);

    doc.text("The details of employment are as follows:", { align: "left" });
    doc.moveDown(0.6);

    // Details
    const details: Array<[string, string]> = [
      ["Name", data.recipientName],
      ["Designation", data.designation],
      ["Department", data.department],
      ["Employment Type", employmentTypeLabel(data.employmentType)],
      ["Period of Service", `${formatDate(data.joiningDate)} to ${formatDate(data.endDate)}`],
    ];

    const tableX = 80;
    for (const [label, value] of details) {
      doc.font("Helvetica-Bold").fontSize(10).text(`${label}:`, tableX, doc.y, { continued: true, width: 180 });
      doc.font("Helvetica").text(`  ${value}`, { width: 300 });
      doc.moveDown(0.2);
    }

    doc.moveDown(1);

    if (data.performanceSummary?.trim()) {
      doc.font("Helvetica-Bold").fontSize(11).text("Performance Summary:", 60);
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(11).text(data.performanceSummary.trim(), 60, doc.y, {
        align: "left", lineGap: 3, width: doc.page.width - 120,
      });
      doc.moveDown(0.8);
    }

    doc.font("Helvetica").fontSize(11).text(
      `During the tenure at ${COMPANY_NAME}, ${data.recipientName} demonstrated professionalism, dedication, and a strong work ethic. We appreciate the contributions made and wish all the best for future endeavors.`,
      60, doc.y, { align: "left", lineGap: 3, width: doc.page.width - 120 }
    );
    doc.moveDown(0.6);
    doc.text(
      "This letter is issued on request and does not constitute any liability on the part of the organization.",
      { align: "left", lineGap: 3 }
    );
    doc.moveDown(2);

    // Signature block
    doc.font("Helvetica-Bold").fontSize(11).fillColor(PRIMARY).text(`For ${COMPANY_NAME}`, 60);
    doc.moveDown(2.5);
    doc.moveTo(60, doc.y).lineTo(200, doc.y).strokeColor(PRIMARY).lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor(SECONDARY).text("Authorized Signatory");

    // Footer
    drawFooter(doc, data.letterId, qrBuffer);

    doc.end();
  });
}
