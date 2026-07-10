import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { existsSync } from "fs";
import QRCode from "qrcode";
import { getEnv } from "../config/env.js";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors
const PRIMARY = "#1e293b";     // slate-800
const SECONDARY = "#475569";   // slate-600
const ACCENT = "#4f46e5";      // indigo-600
const LIGHT_BG = "#f8fafc";    // slate-50

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
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

async function generateQrDataUrl(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { width: 80, margin: 1, errorCorrectionLevel: "M" });
}

function getVerifyUrl(letterId: string): string {
  const base = (getEnv().backendPublicUrl || "http://localhost:38472").replace(/\/+$/, "");
  return `${base}/verify/letter/${encodeURIComponent(letterId)}`;
}

function employmentTypeLabel(type: string): string {
  switch (type) {
    case "INTERN": return "Intern";
    case "FULL_TIME": return "Full-Time Employee";
    case "PART_TIME": return "Part-Time Employee";
    default: return type;
  }
}

export async function generateOfferLetterPdf(data: OfferLetterData): Promise<Buffer> {
  const verifyUrl = getVerifyUrl(data.letterId);
  const qrBuffer = await generateQrDataUrl(verifyUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 120;

    // Header
    doc.fontSize(22).fillColor(PRIMARY).font("Helvetica-Bold")
      .text("FUNT Robotics Academy", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(SECONDARY).font("Helvetica")
      .text("Building tomorrow's innovators", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(1.5);

    // Title
    doc.fontSize(18).fillColor(ACCENT).font("Helvetica-Bold")
      .text("OFFER LETTER", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(SECONDARY).font("Helvetica")
      .text(`Ref: ${data.letterId}`, { align: "center" });
    doc.moveDown(0.3);
    doc.text(`Date: ${formatDate(data.issuedAt)}`, { align: "center" });
    doc.moveDown(1.5);

    // Body
    doc.fontSize(11).fillColor(PRIMARY).font("Helvetica");
    doc.text(`Dear ${data.recipientName},`, { align: "left" });
    doc.moveDown(1);

    doc.text(
      `We are pleased to offer you the position of ${data.designation} in the ${data.department} department at FUNT Robotics Academy as a ${employmentTypeLabel(data.employmentType)}.`,
      { align: "left", lineGap: 4 }
    );
    doc.moveDown(1);

    // Details table
    const details: Array<[string, string]> = [
      ["Position", data.designation],
      ["Department", data.department],
      ["Employment Type", employmentTypeLabel(data.employmentType)],
      ["Date of Joining", formatDate(data.joiningDate)],
      ["Location", data.location || "Remote"],
    ];
    if (data.stipend) details.push(["Stipend", data.stipend]);
    if (data.ctc) details.push(["CTC", data.ctc]);
    if (data.reportingTo) details.push(["Reporting To", data.reportingTo]);

    for (const [label, value] of details) {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value);
      doc.moveDown(0.3);
    }

    doc.moveDown(1);
    doc.font("Helvetica").text(
      "We are confident that your skills and experience will be a great asset to our team. Please confirm your acceptance of this offer by signing and returning a copy of this letter.",
      { align: "left", lineGap: 4 }
    );
    doc.moveDown(1);
    doc.text("We look forward to welcoming you aboard.", { align: "left" });
    doc.moveDown(2);

    // Signature
    doc.font("Helvetica-Bold").text("For FUNT Robotics Academy");
    doc.moveDown(1.5);
    doc.font("Helvetica").text("Authorized Signatory");
    doc.moveDown(2);

    // Footer with QR
    const footerY = doc.page.height - 140;
    doc.moveTo(60, footerY).lineTo(doc.page.width - 60, footerY).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.image(qrBuffer, 60, footerY + 10, { width: 60 });
    doc.fontSize(8).fillColor(SECONDARY).font("Helvetica")
      .text(`Verify: ${verifyUrl}`, 130, footerY + 12);
    doc.text(`Letter ID: ${data.letterId}`, 130, footerY + 24);
    doc.text("This document is digitally signed by FUNT Robotics Academy.", 130, footerY + 36);
    doc.text("Signature can be verified at the URL above or by scanning the QR code.", 130, footerY + 48);
    doc.text("This is a system-generated document and does not require a physical signature.", 130, footerY + 60);

    doc.end();
  });
}

export async function generateExperienceLetterPdf(data: ExperienceLetterData): Promise<Buffer> {
  const verifyUrl = getVerifyUrl(data.letterId);
  const qrBuffer = await generateQrDataUrl(verifyUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(22).fillColor(PRIMARY).font("Helvetica-Bold")
      .text("FUNT Robotics Academy", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(SECONDARY).font("Helvetica")
      .text("Building tomorrow's innovators", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(1.5);

    // Title
    doc.fontSize(18).fillColor(ACCENT).font("Helvetica-Bold")
      .text("EXPERIENCE LETTER", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(SECONDARY).font("Helvetica")
      .text(`Ref: ${data.letterId}`, { align: "center" });
    doc.moveDown(0.3);
    doc.text(`Date: ${formatDate(data.issuedAt)}`, { align: "center" });
    doc.moveDown(1.5);

    // To Whom It May Concern
    doc.fontSize(12).fillColor(PRIMARY).font("Helvetica-Bold")
      .text("To Whom It May Concern", { align: "left" });
    doc.moveDown(1);

    // Body
    doc.fontSize(11).fillColor(PRIMARY).font("Helvetica");
    doc.text(
      `This is to certify that ${data.recipientName} was associated with FUNT Robotics Academy as a ${employmentTypeLabel(data.employmentType)} in the ${data.department} department from ${formatDate(data.joiningDate)} to ${formatDate(data.endDate)}.`,
      { align: "left", lineGap: 4 }
    );
    doc.moveDown(1);

    // Details
    const details: Array<[string, string]> = [
      ["Name", data.recipientName],
      ["Designation", data.designation],
      ["Department", data.department],
      ["Employment Type", employmentTypeLabel(data.employmentType)],
      ["Period", `${formatDate(data.joiningDate)} to ${formatDate(data.endDate)}`],
    ];

    for (const [label, value] of details) {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value);
      doc.moveDown(0.3);
    }

    doc.moveDown(1);

    if (data.performanceSummary?.trim()) {
      doc.font("Helvetica-Bold").text("Performance Summary:");
      doc.moveDown(0.3);
      doc.font("Helvetica").text(data.performanceSummary.trim(), { align: "left", lineGap: 4 });
      doc.moveDown(1);
    }

    doc.font("Helvetica").text(
      `During the tenure, ${data.recipientName} demonstrated professionalism and dedication. We wish all the best for future endeavors.`,
      { align: "left", lineGap: 4 }
    );
    doc.moveDown(2);

    // Signature
    doc.font("Helvetica-Bold").text("For FUNT Robotics Academy");
    doc.moveDown(1.5);
    doc.font("Helvetica").text("Authorized Signatory");
    doc.moveDown(2);

    // Footer with QR
    const footerY = doc.page.height - 140;
    doc.moveTo(60, footerY).lineTo(doc.page.width - 60, footerY).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.image(qrBuffer, 60, footerY + 10, { width: 60 });
    doc.fontSize(8).fillColor(SECONDARY).font("Helvetica")
      .text(`Verify: ${verifyUrl}`, 130, footerY + 12);
    doc.text(`Letter ID: ${data.letterId}`, 130, footerY + 24);
    doc.text("This document is digitally signed by FUNT Robotics Academy.", 130, footerY + 36);
    doc.text("Signature can be verified at the URL above or by scanning the QR code.", 130, footerY + 48);
    doc.text("This is a system-generated document and does not require a physical signature.", 130, footerY + 60);

    doc.end();
  });
}
