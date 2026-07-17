import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

// Layout
const PAGE_MARGIN = 55;
const FONT_BODY = 11;
const LINE_GAP = 4;

// Company details
const COMPANY_NAME = "FUNT ROBOTICS ACADEMY";
const COMPANY_ADDRESS_LINE1 = "2-20-2/211, 1st Floor, Ganesh Nagar, Uppal,";
const COMPANY_ADDRESS_LINE2 = "Hyderabad, TS PIN: 500039.";
const COMPANY_EMAIL = "info@funt.in";
const COMPANY_WEB = "funt.in";
const HR_EMAIL = "hr@funt.in";

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
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateLong(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day}th ${months[d.getMonth()]} ${d.getFullYear()}`;
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

function departmentLabel(dept: string): string {
  switch (dept) {
    case "ENGINEERING": return "Engineering";
    case "DESIGN": return "Design";
    case "SUPPORT": return "Support";
    case "MARKETING": return "Marketing";
    case "OPERATIONS": return "Operations";
    case "EDUCATION": return "Education";
    case "HR": return "Human Resources";
    case "FINANCE": return "Finance";
    default: return dept;
  }
}

function articleFor(word: string): string {
  const first = word.trim().toLowerCase().charAt(0);
  return "aeiou".includes(first) ? "an" : "a";
}

export interface OfferLetterData {
  letterId: string;
  recipientName: string;
  designation: string;
  department: string;
  employmentType: string;
  joiningDate: Date;
  endDate?: Date;
  duration?: string;
  stipend?: string;
  ctc?: string;
  location?: string;
  reportingTo?: string;
  responsibilities?: string;
  issuedAt: Date;
  signatoryName?: string;
  signatoryRole?: string;
  signatoryImageUrl?: string;
}

export interface ExperienceLetterData {
  letterId: string;
  recipientName: string;
  recipientGender?: string;
  designation: string;
  department: string;
  employmentType: string;
  joiningDate: Date;
  endDate: Date;
  dutiesDescription?: string;
  performanceSummary?: string;
  issuedAt: Date;
  signatoryName?: string;
  signatoryRole?: string;
  signatoryImageUrl?: string;
  stampImageUrl?: string;
}

async function generateQrBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { width: 70, margin: 1, errorCorrectionLevel: "M" });
}

function getVerifyUrl(letterId: string): string {
  const base = (process.env.VERIFY_PUBLIC_URL || "https://learn.funt.in").replace(/\/+$/, "");
  return `${base}/verify-letter?id=${encodeURIComponent(letterId)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawLetterhead(doc: any): void {
  const logoPath = resolveLogoPath();

  // Logo on the left
  if (logoPath) {
    doc.image(logoPath, PAGE_MARGIN, PAGE_MARGIN, { width: 100 });
  }

  // Company info on the right (right-aligned)
  const rightX = 320;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000")
    .text(COMPANY_NAME, rightX, PAGE_MARGIN, { width: 200, align: "right" });
  doc.fontSize(8).font("Helvetica").fillColor("#333333")
    .text(COMPANY_ADDRESS_LINE1, rightX, doc.y + 2, { width: 200, align: "right" });
  doc.text(COMPANY_ADDRESS_LINE2, { width: 200, align: "right" });
  doc.text(`Email: ${COMPANY_EMAIL} | Web: ${COMPANY_WEB}`, { width: 200, align: "right" });

  // Line under header
  const lineY = PAGE_MARGIN + 70;
  doc.moveTo(PAGE_MARGIN, lineY).lineTo(doc.page.width - PAGE_MARGIN, lineY)
    .strokeColor("#000000").lineWidth(1).stroke();
  doc.y = lineY + 25;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawFooterQr(doc: any, letterId: string, qrBuffer: Buffer): void {
  const verifyUrl = getVerifyUrl(letterId);
  const footerY = doc.page.height - 90;

  doc.moveTo(PAGE_MARGIN, footerY).lineTo(doc.page.width - PAGE_MARGIN, footerY)
    .strokeColor("#cccccc").lineWidth(0.5).stroke();

  doc.image(qrBuffer, PAGE_MARGIN, footerY + 5, { width: 50 });

  const txtX = PAGE_MARGIN + 58;
  doc.fontSize(7).fillColor("#666666").font("Helvetica")
    .text(`Verify: ${verifyUrl}`, txtX, footerY + 8, { width: 380 });
  doc.text(`Letter ID: ${letterId} | Digitally signed by ${COMPANY_NAME}`, txtX, footerY + 19);
  doc.text("This is a system-generated document and does not require a physical signature.", txtX, footerY + 30);
}

export async function generateOfferLetterPdf(data: OfferLetterData): Promise<Buffer> {
  const qrBuffer = await generateQrBuffer(getVerifyUrl(data.letterId));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - PAGE_MARGIN * 2;
    const empLabel = employmentTypeLabel(data.employmentType);
    const deptLabel = departmentLabel(data.department);

    // ─── PAGE 1 ─────────────────────────────────────────────────────

    drawLetterhead(doc);

    // Date (right-aligned)
    doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#000000")
      .text(formatDate(data.issuedAt), PAGE_MARGIN, doc.y, { width: contentWidth, align: "right" });
    doc.moveDown(1.5);

    // Greeting
    doc.font("Helvetica").fontSize(FONT_BODY)
      .text(`Dear ${data.recipientName}`, PAGE_MARGIN);
    doc.moveDown(1.2);

    // Paragraph 1: Offer
    doc.text(
      `Congratulations! We are pleased to offer you ${articleFor(empLabel)} ${empLabel === "Intern" ? "Internship" : "position"} at FUNT ROBOTICS (hereinafter referred to as "FRA" or "we") in the position of "`,
      PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
    );
    doc.font("Helvetica-Bold").text(data.designation, { continued: true });
    doc.font("Helvetica").text('"');
    doc.moveDown(1);

    // Paragraph 2: Duration
    if (data.employmentType === "INTERN") {
      const duration = data.duration || "3 Months";
      const endDateStr = data.endDate ? formatDateLong(data.endDate) : "";
      let durationText = `This internship is for a period of ${duration}, beginning on `;
      doc.text(durationText, PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP });
      doc.font("Helvetica-Bold").text(formatDateLong(data.joiningDate), { continued: true });
      if (endDateStr) {
        doc.font("Helvetica").text(" and ending on ", { continued: true });
        doc.font("Helvetica-Bold").text(`${endDateStr}.`);
      } else {
        doc.font("Helvetica").text(".");
      }
    } else {
      doc.text(`Your employment will commence on `, PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP });
      doc.font("Helvetica-Bold").text(`${formatDateLong(data.joiningDate)}.`);
    }
    doc.moveDown(1);

    // Paragraph 3: Reporting & Responsibilities
    if (data.reportingTo) {
      doc.font("Helvetica").text(
        `As ${articleFor(empLabel)} ${empLabel.toLowerCase()}, you will be reporting to Mr./Ms. `,
        PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
      );
      doc.font("Helvetica-Bold").text(data.reportingTo.toUpperCase(), { continued: true });
      doc.font("Helvetica").text(`. Your primary responsibilities will include assisting in "`, { continued: true });
      doc.font("Helvetica-Bold").text(data.responsibilities || `${deptLabel} tasks`, { continued: true });
      doc.font("Helvetica").text('". Additionally, you will be expected to adhere to the company\'s policies and procedures at all times.');
      doc.moveDown(1);
    }

    // Paragraph 4: Stipend/CTC
    if (data.stipend) {
      doc.font("Helvetica").text(
        `You will receive a stipend of `,
        PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
      );
      doc.font("Helvetica-Bold").text(`INR ${data.stipend}`, { continued: true });
      doc.font("Helvetica").text(` Per Month.`);
      doc.text(
        `please confirm your acceptance in writing via electronic mail to us on or before `,
        PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
      );
      const acceptDate = new Date(data.joiningDate);
      acceptDate.setDate(acceptDate.getDate() - 14);
      doc.font("Helvetica-Bold").text(`${formatDate(acceptDate)}.`);
      doc.moveDown(1);
    } else if (data.ctc) {
      doc.font("Helvetica").text(
        `Your compensation will be `,
        PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
      );
      doc.font("Helvetica-Bold").text(`INR ${data.ctc}`, { continued: true });
      doc.font("Helvetica").text(` per annum (CTC).`);
      doc.moveDown(1);
    }

    // Paragraph 5: Completion note (for interns)
    if (data.employmentType === "INTERN") {
      doc.font("Helvetica").text(
        "Please note that upon successful completion of your internship, you will be eligible for a full-time position or Internship extension with our company, subject to your performance and organizational requirements based on your performance during the internship and the final evaluation process.",
        PAGE_MARGIN, doc.y, { width: contentWidth, lineGap: LINE_GAP }
      );
      doc.moveDown(1);
    }

    // Closing
    doc.font("Helvetica").text("We look forward to working with you.", PAGE_MARGIN, doc.y, { width: contentWidth });
    doc.moveDown(1.5);

    // Acceptance block
    doc.font("Helvetica").text(
      `I, `,
      PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
    );
    doc.font("Helvetica-Bold").text(data.recipientName, { continued: true });
    doc.font("Helvetica").text(`, accept the above offer and agree to join as a `, { continued: true });
    doc.text(`${data.designation}`);
    doc.text(`on ${formatDate(data.joiningDate)}.`, PAGE_MARGIN);
    doc.moveDown(1.5);

    // Name
    doc.font("Helvetica").text(`Name: ${data.recipientName}`, PAGE_MARGIN);
    doc.moveDown(1.2);

    // Signature lines
    doc.font("Helvetica").text("Signature: ________________________", PAGE_MARGIN, doc.y, { continued: true });
    doc.text("          Date: ________________________");
    doc.moveDown(2);

    // Authority signature
    doc.font("Helvetica").text("With Regards,", PAGE_MARGIN);
    doc.font("Helvetica-Bold").text(data.signatoryName || "Human Resources");
    doc.font("Helvetica-Bold").text(data.signatoryRole || "Human Resources");
    doc.font("Helvetica-Bold").text("Funt Robotics Academy");

    // Footer QR on page 1
    drawFooterQr(doc, data.letterId, qrBuffer);

    // ─── PAGE 2: Acceptance & Annexure ──────────────────────────────

    doc.addPage();
    drawLetterhead(doc);

    doc.font("Helvetica").fontSize(FONT_BODY).fillColor("#000000");
    doc.text(
      `Kindly sign and return a copy of this letter along with Annexure-1 to ${HR_EMAIL} to confirm your acceptance of this offer within 3 working days. If we do not receive your acceptance within the specified timeline, the offer will be automatically withdrawn without any further action from Funt Robotics Entity.`,
      PAGE_MARGIN, doc.y, { width: contentWidth, lineGap: LINE_GAP }
    );
    doc.moveDown(1.5);

    doc.text(
      "We look forward to having you join our team and contribute to our growth. Best wishes and welcome to the team!",
      PAGE_MARGIN, doc.y, { width: contentWidth, lineGap: LINE_GAP }
    );
    doc.moveDown(1);

    doc.text(`Feel free to contact us at ${HR_EMAIL} for any further concerns.`, PAGE_MARGIN, doc.y, { width: contentWidth });
    doc.moveDown(2.5);

    // Annexure heading
    doc.font("Helvetica-Bold").fontSize(12).text("Annexure -1", { align: "center" });
    doc.moveDown(1);

    // Annexure table
    const tX = PAGE_MARGIN;
    const tW = contentWidth;
    const col1W = 40;
    const col2W = tW - col1W;

    const annexureItems = [
      "Professional / Educational Certificates (original) and Mark Sheets (original) towards:\n• 10th standard or equivalent examination\n• 12th standard or equivalent examination\n• Graduation\n• Post-graduation / Doctorate\nOther relevant educational or skill certifications",
      "Colour Scanned Copy of your Photographs and Hard copy of the offer letter (entire copy of offer letter)",
      "Scanned Copy of an Aadhaar Card, Voter ID, or Driving License.",
      "PAN Card, Bank Account Details: Bank Name, Your Name as per Bank records, Account Number, IFSC Code.",
      "Any of the below-mentioned Original Marksheet must be submitted for Employment verification During the Onboarding Process.\n• 10th Standard Original Marksheet\n• 12th Standard Original Marksheet\n• Degree Semester Marksheet / Consolidated Marksheet\n• Diploma Consolidated Marksheet",
    ];

    // Table header
    let tableY = doc.y;
    doc.rect(tX, tableY, col1W, 20).stroke();
    doc.rect(tX + col1W, tableY, col2W, 20).stroke();
    doc.font("Helvetica-Bold").fontSize(9)
      .text("Sl.No", tX + 5, tableY + 5, { width: col1W - 10 })
      .text("PARTICULARS", tX + col1W + 5, tableY + 5, { width: col2W - 10 });
    tableY += 20;

    // Table rows
    doc.font("Helvetica").fontSize(8.5);
    for (let i = 0; i < annexureItems.length; i++) {
      const text = annexureItems[i];
      const textHeight = doc.heightOfString(text, { width: col2W - 10 }) + 10;
      const rowH = Math.max(textHeight, 20);

      // Check if we need a new page
      if (tableY + rowH > doc.page.height - 80) {
        doc.addPage();
        drawLetterhead(doc);
        tableY = doc.y;
      }

      doc.rect(tX, tableY, col1W, rowH).stroke();
      doc.rect(tX + col1W, tableY, col2W, rowH).stroke();

      doc.font("Helvetica-Bold").fontSize(9)
        .text(`${i + 1}.`, tX + 5, tableY + 5, { width: col1W - 10 });
      doc.font("Helvetica").fontSize(8.5)
        .text(text, tX + col1W + 5, tableY + 5, { width: col2W - 10 });

      tableY += rowH;
    }

    // Footer QR on last page
    drawFooterQr(doc, data.letterId, qrBuffer);

    doc.end();
  });
}

export async function generateExperienceLetterPdf(data: ExperienceLetterData): Promise<Buffer> {
  const qrBuffer = await generateQrBuffer(getVerifyUrl(data.letterId));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - PAGE_MARGIN * 2;
    const empLabel = employmentTypeLabel(data.employmentType);

    drawLetterhead(doc);

    // Date (right-aligned)
    doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#000000")
      .text(formatDate(data.issuedAt), PAGE_MARGIN, doc.y, { width: contentWidth, align: "right" });
    doc.moveDown(1.5);

    // Title
    doc.font("Helvetica-Bold").fontSize(13).text("INTERNSHIP EXPERIENCE LETTER", { align: "center" });
    doc.moveDown(1.5);

    // To whom it may concern
    doc.font("Helvetica").fontSize(FONT_BODY).text("To whomsoever it may concern:", PAGE_MARGIN);
    doc.moveDown(1.5);

    // Body
    doc.font("Helvetica").fontSize(FONT_BODY).fillColor("#000000");
    const salutation = data.recipientGender || "Mr";
    doc.text(
      `This is to certify that ${salutation}. `,
      PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
    );
    doc.font("Helvetica-Bold").text(data.recipientName, { continued: true });
    doc.font("Helvetica").text(
      ` was employed by Funt Robotics Academy as ${articleFor(empLabel)} ${empLabel} employee to perform the duties of ${articleFor(data.designation)} `,
      { continued: true }
    );
    doc.font("Helvetica-Bold").text(data.designation, { continued: true });
    doc.font("Helvetica").text(` from `, { continued: true });
    doc.font("Helvetica-Bold").text(formatDateLong(data.joiningDate), { continued: true });
    doc.font("Helvetica").text(` to `, { continued: true });
    doc.font("Helvetica-Bold").text(`${formatDateLong(data.endDate)}.`);
    doc.moveDown(1);

    // Duties description (varies per person)
    if (data.dutiesDescription?.trim()) {
      doc.font("Helvetica").text(
        `During the period of employment at Funt Robotics Academy, ${salutation}. ${data.recipientName} duties included `,
        PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
      );
      doc.text(`${data.dutiesDescription.trim()}.`);
      doc.moveDown(1);
    }

    // Performance remark
    const perfRemark = data.performanceSummary?.trim() || "rendered his services satisfactorily";
    doc.font("Helvetica").text(
      `${salutation}. ${data.recipientName} has ${perfRemark} and we wish `,
      PAGE_MARGIN, doc.y, { continued: true, width: contentWidth, lineGap: LINE_GAP }
    );
    doc.text(`all the best in future endeavours.`);
    doc.moveDown(2);

    // Authority
    doc.font("Helvetica").text("Sincerely,", PAGE_MARGIN);
    doc.moveDown(1.5);
    doc.font("Helvetica-Bold").text(data.signatoryName || "Human Resources");
    doc.font("Helvetica").text(data.signatoryRole || "Manager, FUNT ROBOTICS ACADEMY");

    // Footer QR
    drawFooterQr(doc, data.letterId, qrBuffer);

    doc.end();
  });
}
