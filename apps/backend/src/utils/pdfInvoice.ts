import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { InvoiceViewDto } from "../services/invoiceView.js";
import type { InvoiceSettingsDto } from "../services/invoiceSettings.service.js";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const MARGIN = 36;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const W = PAGE_W - MARGIN * 2;
const BOTTOM_Y = PAGE_H - MARGIN - 20;
const TABLE_HEADER_H = 22;
const MIN_DATA_ROW_H = 24;
const CONTINUATION_HEADER_H = 40;

const TEAL = "#0d9488";
const SLATE_100 = "#f1f5f9";
const SLATE_200 = "#e2e8f0";
const SLATE_500 = "#64748b";
const SLATE_700 = "#334155";
const SLATE_900 = "#0f172a";

type PdfDoc = InstanceType<typeof PDFDocument>;
type ColDef = { label: string; w: number; align: "left" | "right" | "center" };
type CellAlign = "left" | "right" | "center";

interface PdfLayoutState {
  y: number;
  page: number;
  cols: ColDef[];
  scale: number;
  descColWidth: number;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

function resolveLogoPath(): string | null {
  const candidates = [
    path.join(MODULE_DIR, "../../assets/funt-logo.png"),
    path.join(MODULE_DIR, "../../../assets/funt-logo.png"),
    path.resolve(process.cwd(), "assets/funt-logo.png"),
    path.resolve(process.cwd(), "dist/assets/funt-logo.png"),
    path.resolve(process.cwd(), "apps/backend/assets/funt-logo.png"),
    path.resolve(process.cwd(), "apps/backend/dist/assets/funt-logo.png"),
    path.resolve(process.cwd(), "../admin/public/funt-logo.png"),
    path.resolve(process.cwd(), "apps/admin/public/funt-logo.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function drawHr(doc: PdfDoc, y: number) {
  doc.strokeColor(SLATE_200).lineWidth(0.75).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
}

function drawAccentBar(doc: PdfDoc) {
  doc.save();
  doc.rect(0, 0, PAGE_W, 4).fill(TEAL);
  doc.restore();
}

function buildColumns(s: InvoiceSettingsDto, view: InvoiceViewDto): ColDef[] {
  const cols: ColDef[] = [{ label: "Description", w: 120, align: "left" }];
  if (s.showHsn) cols.push({ label: "HSN Code", w: 44, align: "left" });
  if (s.showSac) cols.push({ label: "SAC Code", w: 44, align: "left" });
  cols.push({ label: "Quantity", w: 44, align: "center" });
  cols.push({ label: "Unit Price", w: 52, align: "right" });
  if (s.showTaxableValue) cols.push({ label: "Taxable Value", w: 58, align: "right" });
  if (s.showCgst) cols.push({ label: `CGST (${view.cgstPercent}%)`, w: 52, align: "right" });
  if (s.showSgst) cols.push({ label: `SGST (${view.sgstPercent}%)`, w: 52, align: "right" });
  if (s.showIgst) cols.push({ label: `IGST (${view.igstPercent}%)`, w: 52, align: "right" });
  cols.push({ label: "Total", w: 56, align: "right" });
  return cols;
}

function colWidths(state: PdfLayoutState): number[] {
  return state.cols.map((c) => c.w * state.scale);
}

function drawLogo(doc: PdfDoc, y: number): number {
  const logoPath = resolveLogoPath();
  if (!logoPath) return y;
  try {
    const logoH = 64;
    const logoW = 150;
    doc.image(logoPath, MARGIN, y, { fit: [logoW, logoH], align: "left", valign: "top" });
    return y + logoH;
  } catch {
    return y;
  }
}

function drawInvoiceMeta(doc: PdfDoc, view: InvoiceViewDto, topY: number): number {
  let y = topY;
  doc.font("Helvetica").fontSize(8).fillColor(SLATE_500).text("ORIGINAL FOR RECIPIENT", MARGIN, y, {
    width: W,
    align: "right",
  });
  y += 14;
  doc.font("Helvetica-Bold").fontSize(20).fillColor(SLATE_900).text("INVOICE", MARGIN, y, {
    width: W,
    align: "right",
  });
  y += 26;
  doc.font("Helvetica").fontSize(9).fillColor(SLATE_700).text(`Invoice #: ${view.invoiceNumber}`, MARGIN, y, {
    width: W,
    align: "right",
  });
  y += 13;
  doc.fillColor(SLATE_700).text(`Invoice date: ${view.invoiceDate}`, MARGIN, y, { width: W, align: "right" });
  return y + 14;
}

function measureBlockHeight(
  doc: PdfDoc,
  s: InvoiceSettingsDto,
  view: InvoiceViewDto,
  half: number
): number {
  let h = 28;
  doc.font("Helvetica").fontSize(8);
  if (s.showLegalName) h += measureTextHeight(doc, s.legalName, half, 9) + 4;
  if (s.showAddress && s.address) h += measureTextHeight(doc, s.address, half) + 4;
  if (s.showGstin && s.gstin) h += 12;
  if (s.showPan && s.pan) h += 12;

  let rh = 28;
  if (s.showRecipient) {
    rh += measureTextHeight(doc, view.studentName || view.studentUsername, half, 9) + 4;
    if (s.showRecipientEmail && view.studentEmail) rh += 12;
    if (s.showRecipientAddress && view.studentAddress) rh += measureTextHeight(doc, view.studentAddress, half) + 4;
    if (s.showRecipientPhone && view.studentPhone) rh += 12;
  }
  return Math.max(h, rh) + 8;
}

function drawFirstPageHeader(doc: PdfDoc, view: InvoiceViewDto): number {
  const s = view.settings;
  drawAccentBar(doc);

  const topY = MARGIN;
  const logoBottom = drawLogo(doc, topY);
  const metaBottom = drawInvoiceMeta(doc, view, topY);
  let y = Math.max(logoBottom, metaBottom) + 14;

  drawHr(doc, y);
  y += 14;

  const half = W / 2 - 6;
  const gap = 12;
  const boxH = measureBlockHeight(doc, s, view, half);

  doc.save();
  doc.rect(MARGIN, y, half, boxH).fill("#f8fafc");
  if (s.showRecipient) {
    doc.rect(MARGIN + half + gap, y, half, boxH).fill("#ffffff");
  }
  doc.strokeColor(SLATE_200).lineWidth(0.75);
  doc.rect(MARGIN, y, half, boxH).stroke();
  if (s.showRecipient) {
    doc.rect(MARGIN + half + gap, y, half, boxH).stroke();
  }
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(7).fillColor(SLATE_500).text("COMPANY DETAILS", MARGIN + 8, y + 8);

  let ly = y + 20;
  doc.font("Helvetica").fontSize(8).fillColor(SLATE_700);
  if (s.showLegalName) {
    doc.font("Helvetica-Bold").fontSize(9).text(s.legalName, MARGIN + 8, ly, { width: half - 16 });
    ly = doc.y + 4;
    doc.font("Helvetica").fontSize(8);
  }
  if (s.showAddress && s.address) {
    doc.text(s.address, MARGIN + 8, ly, { width: half - 16 });
    ly = doc.y + 4;
  }
  if (s.showGstin && s.gstin) {
    doc.text(`GSTIN: ${s.gstin}`, MARGIN + 8, ly);
    ly += 11;
  }
  if (s.showPan && s.pan) {
    doc.text(`PAN no.: ${s.pan}`, MARGIN + 8, ly);
    ly += 11;
  }

  if (s.showRecipient) {
    const rx = MARGIN + half + gap + 8;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(SLATE_500).text("RECIPIENT DETAILS", rx, y + 8);
    let ry = y + 20;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(SLATE_700).text(view.studentName || view.studentUsername, rx, ry, {
      width: half - 16,
    });
    ry = doc.y + 4;
    doc.font("Helvetica").fontSize(8);
    if (s.showRecipientEmail && view.studentEmail) {
      doc.text(view.studentEmail, rx, ry, { width: half - 16 });
      ry += 11;
    }
    if (s.showRecipientAddress && view.studentAddress) {
      doc.text(view.studentAddress, rx, ry, { width: half - 16 });
      ry = doc.y + 4;
    }
    if (s.showRecipientPhone && view.studentPhone) {
      doc.text(view.studentPhone, rx, ry, { width: half - 16 });
    }
  }

  return y + boxH + 16;
}

function drawContinuationHeader(doc: PdfDoc, view: InvoiceViewDto, page: number): number {
  drawAccentBar(doc);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(SLATE_900).text("INVOICE (continued)", MARGIN, MARGIN + 6);
  doc.font("Helvetica").fontSize(8).fillColor(SLATE_500).text(
    `${view.invoiceNumber} · ${view.invoiceDate} · Page ${page}`,
    MARGIN,
    MARGIN + 20,
    { width: W, align: "right" }
  );
  drawHr(doc, MARGIN + CONTINUATION_HEADER_H - 4);
  return MARGIN + CONTINUATION_HEADER_H;
}

function drawTableHeaderRow(doc: PdfDoc, state: PdfLayoutState): void {
  const widths = colWidths(state);
  let x = MARGIN;
  doc.rect(MARGIN, state.y, W, TABLE_HEADER_H).fill(SLATE_100);
  doc.strokeColor(SLATE_200).lineWidth(0.5).rect(MARGIN, state.y, W, TABLE_HEADER_H).stroke();
  doc.fillColor(SLATE_700).font("Helvetica-Bold").fontSize(7);
  for (let i = 0; i < state.cols.length; i++) {
    const c = state.cols[i]!;
    const cw = widths[i]!;
    doc.text(c.label.toUpperCase(), x + 4, state.y + 7, { width: cw - 8, align: c.align });
    x += cw;
  }
  state.y += TABLE_HEADER_H;
}

function drawTableRowBorder(doc: PdfDoc, y: number, h: number) {
  doc.strokeColor(SLATE_200).lineWidth(0.5).rect(MARGIN, y, W, h).stroke();
}

function startNewPage(doc: PdfDoc, view: InvoiceViewDto, state: PdfLayoutState): void {
  doc.addPage();
  state.page += 1;
  state.y = drawContinuationHeader(doc, view, state.page);
  drawTableHeaderRow(doc, state);
}

function ensureSpace(doc: PdfDoc, view: InvoiceViewDto, state: PdfLayoutState, needed: number): void {
  if (state.y + needed <= BOTTOM_Y) return;
  startNewPage(doc, view, state);
}

function measureTextHeight(doc: PdfDoc, text: string, width: number, fontSize = 8): number {
  doc.font("Helvetica").fontSize(fontSize);
  return doc.heightOfString(text || " ", { width: Math.max(20, width - 8) });
}

function drawTableCells(
  doc: PdfDoc,
  state: PdfLayoutState,
  y: number,
  rowH: number,
  values: string[],
  bold = false
): void {
  const widths = colWidths(state);
  let x = MARGIN;
  drawTableRowBorder(doc, y, rowH);
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(SLATE_900);
  if (bold) {
    doc.rect(MARGIN, y, W, rowH).fill("#f8fafc");
  }
  for (let i = 0; i < state.cols.length; i++) {
    const c = state.cols[i]!;
    const cw = widths[i]!;
    const text = values[i] ?? "";
    doc.fillColor(SLATE_900).text(text, x + 4, y + 6, {
      width: cw - 8,
      align: c.align as CellAlign,
      height: rowH - 10,
      lineBreak: true,
    });
    x += cw;
  }
}

function lineRowValues(view: InvoiceViewDto, s: InvoiceSettingsDto): string[] {
  return [
    view.lineDescription,
    ...(s.showHsn ? [view.lineHsnDisplay] : []),
    ...(s.showSac ? [view.lineSacDisplay] : []),
    view.quantity.toFixed(1),
    view.unitPriceFormatted,
    ...(s.showTaxableValue ? [view.taxableFormatted] : []),
    ...(s.showCgst ? [view.cgstFormatted] : []),
    ...(s.showSgst ? [view.sgstFormatted] : []),
    ...(s.showIgst ? [view.igstFormatted] : []),
    view.lineTotalFormatted,
  ];
}

function totalRowValues(view: InvoiceViewDto, s: InvoiceSettingsDto): string[] {
  return [
    "Total",
    ...(s.showHsn ? [""] : []),
    ...(s.showSac ? [""] : []),
    "",
    "",
    ...(s.showTaxableValue ? [view.taxableFormatted] : []),
    ...(s.showCgst ? [view.cgstFormatted] : []),
    ...(s.showSgst ? [view.sgstFormatted] : []),
    ...(s.showIgst ? [view.igstFormatted] : []),
    `${view.lineTotalFormatted} ${view.currencyLabel}`,
  ];
}

function splitTextForHeight(doc: PdfDoc, text: string, width: number, maxHeight: number): { chunk: string; rest: string } {
  const trimmed = text.trim();
  if (!trimmed) return { chunk: "", rest: "" };
  if (measureTextHeight(doc, trimmed, width) <= maxHeight) return { chunk: trimmed, rest: "" };

  const words = trimmed.split(/\s+/);
  let chunk = "";
  let i = 0;
  while (i < words.length) {
    const next = chunk ? `${chunk} ${words[i]}` : (words[i] ?? "");
    if (measureTextHeight(doc, next, width) > maxHeight && chunk) break;
    chunk = next;
    i += 1;
  }
  if (!chunk && words[0]) {
    return { chunk: words[0]!.slice(0, 80), rest: words.slice(1).join(" ") };
  }
  return { chunk, rest: words.slice(i).join(" ") };
}

function drawDataRow(doc: PdfDoc, view: InvoiceViewDto, state: PdfLayoutState, values: string[], bold = false): void {
  const widths = colWidths(state);
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
  let maxOtherH = MIN_DATA_ROW_H;
  for (let i = 1; i < values.length; i++) {
    const h = measureTextHeight(doc, values[i] ?? "", widths[i] ?? 40);
    maxOtherH = Math.max(maxOtherH, h + 10);
  }

  let descRest = values[0] ?? "";
  let firstSegment = true;

  while (descRest || firstSegment) {
    ensureSpace(doc, view, state, MIN_DATA_ROW_H + 4);
    const availableH = BOTTOM_Y - state.y - 4;
    const maxDescH = Math.max(MIN_DATA_ROW_H, availableH - 10, maxOtherH);
    const { chunk, rest } = splitTextForHeight(doc, descRest, state.descColWidth, maxDescH);
    descRest = rest;

    const isFirstSegment = firstSegment;
    const rowValues = isFirstSegment
      ? [chunk || " ", ...values.slice(1)]
      : [chunk || " ", ...values.slice(1).map(() => "")];
    firstSegment = false;

    const descH = measureTextHeight(doc, rowValues[0] ?? "", state.descColWidth);
    const rowH = Math.max(MIN_DATA_ROW_H, descH + 10, isFirstSegment ? maxOtherH : MIN_DATA_ROW_H);

    drawTableCells(doc, state, state.y, rowH, rowValues, bold);
    state.y += rowH;

    if (!descRest) break;
  }
}

function drawBlockText(
  doc: PdfDoc,
  view: InvoiceViewDto,
  state: PdfLayoutState,
  text: string,
  opts: { italic?: boolean; centered?: boolean; fontSize?: number }
): void {
  const fontSize = opts.fontSize ?? 8;
  doc
    .font(opts.italic ? "Helvetica-Oblique" : "Helvetica")
    .fontSize(fontSize)
    .fillColor(opts.centered ? SLATE_500 : SLATE_700);
  const h = measureTextHeight(doc, text, W, fontSize) + 10;
  ensureSpace(doc, view, state, h);
  drawHr(doc, state.y);
  state.y += 10;
  doc.text(text, MARGIN, state.y, {
    width: W,
    align: opts.centered ? "center" : "left",
    lineBreak: true,
  });
  state.y = doc.y + 14;
}

export function generateInvoicePdf(view: InvoiceViewDto): Promise<Buffer> {
  const s = view.settings;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, autoFirstPage: true, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const cols = buildColumns(s, view);
    const scale = W / cols.reduce((a, c) => a + c.w, 0);
    const descColWidth = cols[0]!.w * scale;

    const state: PdfLayoutState = {
      y: MARGIN,
      page: 1,
      cols,
      scale,
      descColWidth,
    };

    state.y = drawFirstPageHeader(doc, view);
    drawTableHeaderRow(doc, state);

    drawDataRow(doc, view, state, lineRowValues(view, s));
    drawDataRow(doc, view, state, totalRowValues(view, s), true);

    state.y += 8;

    if (s.showTotalInWords && view.totalInWords) {
      drawBlockText(doc, view, state, view.totalInWords, { italic: true });
    }

    if (view.displayNotes?.trim()) {
      drawBlockText(doc, view, state, view.displayNotes.trim(), { fontSize: 8 });
    }

    if (s.showSystemFooter && s.systemFooterText) {
      drawBlockText(doc, view, state, s.systemFooterText, { italic: true, centered: true });
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(7).fillColor(SLATE_500).text(
        `Page ${i - range.start + 1} of ${range.count}`,
        MARGIN,
        PAGE_H - 28,
        { width: W, align: "center" }
      );
    }

    doc.end();
  });
}
