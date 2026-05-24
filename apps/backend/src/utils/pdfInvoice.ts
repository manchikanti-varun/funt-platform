import { createRequire } from "module";
import type { InvoiceViewDto } from "../services/invoiceView.js";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const MARGIN = 36;
const PAGE_W = 595.28;
const W = PAGE_W - MARGIN * 2;

function drawHr(doc: ReturnType<typeof PDFDocument>, y: number) {
  doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
}

export function generateInvoicePdf(view: InvoiceViewDto): Promise<Buffer> {
  const s = view.settings;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = MARGIN;

    doc.font("Helvetica").fontSize(8).fillColor("#666666").text("ORIGINAL FOR RECIPIENT", MARGIN, y, {
      width: W,
      align: "right",
    });
    y += 12;
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#000").text("TAX INVOICE", MARGIN, y, {
      width: W,
      align: "right",
    });
    y += 22;
    doc.font("Helvetica").fontSize(9).text(`Invoice #: ${view.invoiceNumber}`, MARGIN, y, {
      width: W,
      align: "right",
    });
    y += 12;
    doc.text(`Invoice date: ${view.invoiceDate}`, MARGIN, y, { width: W, align: "right" });

    const companyTop = MARGIN;
    if (s.showLegalName) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text(s.legalName, MARGIN, companyTop);
    }
    let cy = companyTop + 14;
    if (s.showAddress && s.address) {
      doc.font("Helvetica").fontSize(8).text(s.address, MARGIN, cy, { width: W * 0.48 });
      cy = doc.y + 4;
    }
    if (s.showGstin && s.gstin) {
      doc.text(`GSTIN: ${s.gstin}`, MARGIN, cy);
      cy += 10;
    }
    if (s.showPan && s.pan) {
      doc.text(`PAN no.: ${s.pan}`, MARGIN, cy);
    }

    y = Math.max(y, cy) + 16;
    drawHr(doc, y);
    y += 12;

    const half = W / 2 - 8;
    doc.font("Helvetica-Bold").fontSize(9).text("Company details:", MARGIN, y);
    if (s.showRecipient) {
      doc.text("Recipient details:", MARGIN + half + 16, y);
      doc.font("Helvetica").fontSize(8);
      let ry = y + 14;
      doc.text(view.studentName || view.studentUsername, MARGIN + half + 16, ry, { width: half });
      ry += 10;
      if (s.showRecipientEmail && view.studentEmail) {
        doc.text(view.studentEmail, MARGIN + half + 16, ry, { width: half });
        ry += 10;
      }
      if (s.showRecipientAddress && view.studentAddress) {
        doc.text(view.studentAddress, MARGIN + half + 16, ry, { width: half });
        ry = doc.y + 4;
      }
      if (s.showRecipientPhone && view.studentPhone) {
        doc.text(view.studentPhone, MARGIN + half + 16, ry, { width: half });
      }
    }

    doc.font("Helvetica").fontSize(8);
    let ly = y + 14;
    if (s.showLegalName) {
      doc.font("Helvetica-Bold").text(s.legalName, MARGIN, ly, { width: half });
      ly += 12;
      doc.font("Helvetica");
    }
    if (s.showAddress && s.address) {
      doc.text(s.address, MARGIN, ly, { width: half });
      ly = doc.y + 4;
    }
    if (s.showGstin && s.gstin) {
      doc.text(`GSTIN: ${s.gstin}`, MARGIN, ly);
      ly += 10;
    }
    if (s.showPan && s.pan) {
      doc.text(`PAN no.: ${s.pan}`, MARGIN, ly);
    }

    y = Math.max(doc.y, ly) + 20;

    const cols: Array<{ label: string; w: number; align: "left" | "right" | "center" }> = [
      { label: "Description", w: 120, align: "left" },
    ];
    if (s.showHsn) cols.push({ label: "HSN Code", w: 44, align: "left" });
    if (s.showSac) cols.push({ label: "SAC Code", w: 44, align: "left" });
    cols.push({ label: "Quantity", w: 44, align: "center" });
    cols.push({ label: "Unit Price", w: 52, align: "right" });
    if (s.showTaxableValue) cols.push({ label: "Taxable Value", w: 58, align: "right" });
    if (s.showCgst) cols.push({ label: `CGST (${view.cgstPercent}%)`, w: 52, align: "right" });
    if (s.showSgst) cols.push({ label: `SGST (${view.sgstPercent}%)`, w: 52, align: "right" });
    if (s.showIgst) cols.push({ label: `IGST (${view.igstPercent}%)`, w: 52, align: "right" });
    cols.push({ label: "Total", w: 56, align: "right" });

    const scale = W / cols.reduce((a, c) => a + c.w, 0);
    let x = MARGIN;
    doc.rect(MARGIN, y, W, 16).fill("#f0f0f0");
    doc.fillColor("#333").font("Helvetica-Bold").fontSize(7);
    for (const c of cols) {
      const cw = c.w * scale;
      doc.text(c.label, x + 2, y + 4, { width: cw - 4, align: c.align });
      x += cw;
    }
    y += 18;
    x = MARGIN;
    doc.font("Helvetica").fontSize(8).fillColor("#000");
    const rowVals = [
      { text: view.lineDescription, align: "left" as const },
      ...(s.showHsn ? [{ text: view.lineHsnDisplay, align: "left" as const }] : []),
      ...(s.showSac ? [{ text: view.lineSacDisplay, align: "left" as const }] : []),
      { text: view.quantity.toFixed(1), align: "center" as const },
      { text: view.unitPriceFormatted, align: "right" as const },
      ...(s.showTaxableValue ? [{ text: view.taxableFormatted, align: "right" as const }] : []),
      ...(s.showCgst ? [{ text: view.cgstFormatted, align: "right" as const }] : []),
      ...(s.showSgst ? [{ text: view.sgstFormatted, align: "right" as const }] : []),
      ...(s.showIgst ? [{ text: view.igstFormatted, align: "right" as const }] : []),
      { text: view.lineTotalFormatted, align: "right" as const },
    ];
    let xi = 0;
    for (const c of cols) {
      const cw = c.w * scale;
      doc.text(rowVals[xi]?.text ?? "", x + 2, y + 4, { width: cw - 4, align: c.align });
      x += cw;
      xi++;
    }
    y += 22;
    x = MARGIN;
    doc.font("Helvetica-Bold");
    const totalVals = [
      { text: "Total", align: "left" as const },
      ...(s.showHsn ? [{ text: "", align: "left" as const }] : []),
      ...(s.showSac ? [{ text: "", align: "left" as const }] : []),
      { text: "", align: "center" as const },
      { text: "", align: "right" as const },
      ...(s.showTaxableValue ? [{ text: view.taxableFormatted, align: "right" as const }] : []),
      ...(s.showCgst ? [{ text: view.cgstFormatted, align: "right" as const }] : []),
      ...(s.showSgst ? [{ text: view.sgstFormatted, align: "right" as const }] : []),
      ...(s.showIgst ? [{ text: view.igstFormatted, align: "right" as const }] : []),
      { text: `${view.lineTotalFormatted} ${view.currencyLabel}`, align: "right" as const },
    ];
    xi = 0;
    for (const c of cols) {
      const cw = c.w * scale;
      doc.text(totalVals[xi]?.text ?? "", x + 2, y + 4, { width: cw - 4, align: c.align });
      x += cw;
      xi++;
    }

    y += 28;
    if (s.showTotalInWords) {
      doc.font("Helvetica-Oblique").fontSize(8).text(view.totalInWords, MARGIN, y, { width: W });
      y += 20;
    }
    if (s.showSystemFooter) {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor("#555").text(s.systemFooterText, MARGIN, y, {
        width: W,
        align: "center",
      });
    }

    doc.end();
  });
}
