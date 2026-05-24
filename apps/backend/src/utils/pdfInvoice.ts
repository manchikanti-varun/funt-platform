import { createRequire } from "module";
import type { InvoiceViewDto } from "../services/invoiceView.js";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const MARGIN = 40;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

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

    if (s.showLegalName) {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000").text(s.legalName, MARGIN, y);
      y = doc.y + 4;
    }
    if (s.showAddress && s.address) {
      doc.font("Helvetica").fontSize(9).fillColor("#333333").text(s.address, MARGIN, y, { width: CONTENT_W * 0.55 });
      y = Math.max(doc.y, y + 28);
    }
    const metaY = MARGIN;
    if (s.showGstin && s.gstin) {
      doc.font("Helvetica").fontSize(9).text(`GSTIN: ${s.gstin}`, MARGIN, y);
      y = doc.y + 2;
    }
    if (s.showPan && s.pan) {
      doc.font("Helvetica").fontSize(9).text(`PAN: ${s.pan}`, MARGIN, y);
      y = doc.y + 2;
    }
    if (s.showEmail && s.email) {
      doc.font("Helvetica").fontSize(9).text(s.email, MARGIN, y);
      y = doc.y + 2;
    }
    if (s.showPhone && s.phone) {
      doc.font("Helvetica").fontSize(9).text(s.phone, MARGIN, y);
    }

    doc.font("Helvetica-Bold").fontSize(20).text("TAX INVOICE", MARGIN, metaY, {
      width: CONTENT_W,
      align: "right",
    });

    y = Math.max(y, metaY + 36) + 12;
    drawHr(doc, y);
    y += 10;

    if (s.showInvoiceMeta) {
      const colW = CONTENT_W / 2;
      const leftX = MARGIN;
      const rightX = MARGIN + colW;
      const metaStart = y;
      doc.font("Helvetica").fontSize(9).fillColor("#555555");
      doc.text("#", leftX, metaStart);
      doc.font("Helvetica-Bold").fillColor("#000").text(view.invoiceNumber, leftX + 90, metaStart);
      let ly = metaStart + 14;
      doc.font("Helvetica").fillColor("#555555").text("Invoice Date", leftX, ly);
      doc.font("Helvetica-Bold").fillColor("#000").text(view.invoiceDate, leftX + 90, ly);
      ly += 14;
      if (s.showTerms) {
        doc.font("Helvetica").fillColor("#555555").text("Terms", leftX, ly);
        doc.font("Helvetica-Bold").fillColor("#000").text(s.terms, leftX + 90, ly);
        ly += 14;
      }
      if (s.showDueDate) {
        doc.font("Helvetica").fillColor("#555555").text("Due Date", leftX, ly);
        doc.font("Helvetica-Bold").fillColor("#000").text(view.dueDate, leftX + 90, ly);
        ly += 14;
      }
      if (s.showPlaceOfSupply) {
        doc.font("Helvetica").fillColor("#555555").text("Place Of Supply", rightX, metaStart);
        doc.font("Helvetica-Bold").fillColor("#000").text(s.placeOfSupply, rightX + 100, metaStart);
      }
      y = Math.max(ly, metaStart + 42) + 8;
    }

    drawHr(doc, y);
    y += 10;

    if (s.showBillTo || s.showShipTo) {
      const colW = CONTENT_W / 2;
      if (s.showBillTo) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#666666").text("Bill To", MARGIN, y);
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(view.studentName || view.studentUsername, MARGIN, y + 14);
        let by = y + 28;
        if (view.studentEmail) {
          doc.font("Helvetica").fontSize(9).text(view.studentEmail, MARGIN, by);
          by += 12;
        }
        if (view.studentUsername) {
          doc.font("Helvetica").fontSize(9).text(`@${view.studentUsername}`, MARGIN, by);
        }
      }
      if (s.showShipTo) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#666666").text("Ship To", MARGIN + colW, y);
        doc.font("Helvetica").fontSize(9).fillColor("#000").text(view.shipToLines, MARGIN + colW, y + 14, {
          width: colW - 10,
        });
      }
      y += 56;
    }

    const col = {
      num: 24,
      desc: 150,
      hsn: 52,
      qty: 48,
      rate: 68,
      igstPct: 36,
      igstAmt: 58,
      amt: CONTENT_W - 24 - 150 - 52 - 48 - 68 - 36 - 58,
    };
    const tableTop = y;
    doc.rect(MARGIN, tableTop, CONTENT_W, 18).fill("#f3f4f6");
    doc.fillColor("#444444").font("Helvetica-Bold").fontSize(8);
    let cx = MARGIN + 4;
    doc.text("#", cx, tableTop + 5, { width: col.num });
    cx += col.num;
    doc.text("Item & Description", cx, tableTop + 5, { width: col.desc });
    cx += col.desc;
    if (s.showHsnSac) {
      doc.text("HSN/SAC", cx, tableTop + 5, { width: col.hsn });
      cx += col.hsn;
    }
    doc.text("Qty", cx, tableTop + 5, { width: col.qty, align: "center" });
    cx += col.qty;
    doc.text("Rate", cx, tableTop + 5, { width: col.rate, align: "right" });
    cx += col.rate;
    if (s.showIgst && s.igstPercent > 0) {
      doc.text("IGST %", cx, tableTop + 5, { width: col.igstPct, align: "center" });
      cx += col.igstPct;
      doc.text("IGST Amt", cx, tableTop + 5, { width: col.igstAmt, align: "right" });
      cx += col.igstAmt;
    }
    doc.text("Amount", cx, tableTop + 5, { width: col.amt, align: "right" });

    y = tableTop + 22;
    doc.font("Helvetica").fontSize(9).fillColor("#000000");
    cx = MARGIN + 4;
    doc.text("1", cx, y, { width: col.num });
    cx += col.num;
    doc.text(view.lineDescription, cx, y, { width: col.desc });
    cx += col.desc;
    if (s.showHsnSac) {
      doc.text(s.hsnSac, cx, y, { width: col.hsn });
      cx += col.hsn;
    }
    doc.text("1.00", cx, y, { width: col.qty, align: "center" });
    cx += col.qty;
    doc.text(view.subtotalFormatted, cx, y, { width: col.rate, align: "right" });
    cx += col.rate;
    if (s.showIgst && s.igstPercent > 0) {
      doc.text(`${s.igstPercent}%`, cx, y, { width: col.igstPct, align: "center" });
      cx += col.igstPct;
      doc.text(view.igstFormatted, cx, y, { width: col.igstAmt, align: "right" });
      cx += col.igstAmt;
    }
    doc.text(view.subtotalFormatted, cx, y, { width: col.amt, align: "right" });
    y += 28;
    drawHr(doc, y);
    y += 12;

    const totalsX = PAGE_W - MARGIN - 200;
    if (s.showTotalInWords) {
      doc.font("Helvetica-Bold").fontSize(9).text("Total In Words", MARGIN, y);
      doc.font("Helvetica-Oblique").fontSize(9).text(view.totalInWords, MARGIN, y + 14, { width: CONTENT_W * 0.55 });
    }
    if (s.showNotes && view.displayNotes) {
      doc.font("Helvetica-Bold").fontSize(9).text("Notes", MARGIN, y + 44);
      doc.font("Helvetica").fontSize(9).text(view.displayNotes, MARGIN, y + 56, { width: CONTENT_W * 0.55 });
    }

    let ty = y;
    doc.font("Helvetica").fontSize(9).text("Sub Total", totalsX, ty, { width: 100, align: "left" });
    doc.text(view.subtotalFormatted, totalsX + 100, ty, { width: 100, align: "right" });
    ty += 14;
    if (view.discountInPaise > 0) {
      doc.text("Discount", totalsX, ty);
      doc.text(`-${formatPlain(view.discountInPaise)}`, totalsX + 100, ty, { width: 100, align: "right" });
      ty += 14;
    }
    if (s.showIgst && view.igstInPaise > 0) {
      doc.text(view.igstLabel, totalsX, ty);
      doc.text(view.igstFormatted, totalsX + 100, ty, { width: 100, align: "right" });
      ty += 14;
    }
    doc.font("Helvetica-Bold").text("Total", totalsX, ty);
    doc.text(view.grandTotalFormatted, totalsX + 100, ty, { width: 100, align: "right" });
    ty += 14;
    if (s.showBalanceDue) {
      doc.font("Helvetica-Bold").text("Balance Due", totalsX, ty);
      doc.text(view.balanceDueFormatted, totalsX + 100, ty, { width: 100, align: "right" });
      ty += 14;
    }

    y = Math.max(y + 80, ty + 20);

    if (s.showDigitalSignature) {
      const sigX = PAGE_W - MARGIN - 220;
      doc.font("Helvetica").fontSize(9).fillColor("#333333");
      doc.text(`Digitally signed by ${s.signatoryName}`, sigX, y, { width: 220, align: "right" });
      doc.text(`Date: ${view.signedAtFormatted}`, sigX, y + 14, { width: 220, align: "right" });
      doc.text("Authorized Signature", sigX, y + 36, { width: 220, align: "center" });
      doc
        .strokeColor("#999999")
        .lineWidth(0.5)
        .moveTo(sigX, y + 32)
        .lineTo(sigX + 220, y + 32)
        .stroke();
    }

    if (s.showVerifyLink && view.verifyUrl) {
      doc.font("Helvetica").fontSize(7).fillColor("#666666").text(`Verify: ${view.verifyUrl}`, MARGIN, PAGE_W - 60, {
        width: CONTENT_W,
      });
    }

    doc.end();
  });
}

function formatPlain(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
