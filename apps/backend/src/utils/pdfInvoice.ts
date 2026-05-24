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
const BOTTOM_Y = PAGE_H - MARGIN;
const TABLE_HEADER_H = 18;
const MIN_DATA_ROW_H = 22;
const CONTINUATION_HEADER_H = 36;

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATHS = [
  path.resolve(__dirname, "../../../admin/public/funt-logo.png"),
  path.resolve(__dirname, "../../../lms/public/funt-logo.png"),
];

function resolveLogoPath(): string | null {
  for (const p of LOGO_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function drawHr(doc: PdfDoc, y: number) {
  doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
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
    const logoH = 56;
    const logoW = 140;
    doc.image(logoPath, MARGIN, y, { fit: [logoW, logoH], align: "left", valign: "top" });
    return y + logoH;
  } catch {
    return y;
  }
}

function drawInvoiceMeta(doc: PdfDoc, view: InvoiceViewDto, topY: number): number {
  let y = topY;
  doc.font("Helvetica").fontSize(8).fillColor("#666666").text("ORIGINAL FOR RECIPIENT", MARGIN, y, {
    width: W,
    align: "right",
  });
  y += 12;
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#000").text("INVOICE", MARGIN, y, { width: W, align: "right" });
  y += 22;
  doc.font("Helvetica").fontSize(9).text(`Invoice #: ${view.invoiceNumber}`, MARGIN, y, { width: W, align: "right" });
  y += 12;
  doc.text(`Invoice date: ${view.invoiceDate}`, MARGIN, y, { width: W, align: "right" });
  return y + 14;
}

function drawFirstPageHeader(doc: PdfDoc, view: InvoiceViewDto): number {
  const s = view.settings;
  const logoBottom = drawLogo(doc, MARGIN);
  const metaBottom = drawInvoiceMeta(doc, view, MARGIN);
  const headerBottom = Math.max(logoBottom, metaBottom) + 8;

  let y = headerBottom;
  drawHr(doc, y);
  y += 12;

  const half = W / 2 - 8;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text("Company details:", MARGIN, y);
  if (s.showRecipient) {
    doc.text("Recipient details:", MARGIN + half + 16, y);
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
    ly += 10;
  }

  let ry = y + 14;
  if (s.showRecipient) {
    doc.font("Helvetica").fontSize(8);
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
      ry += 10;
    }
  }

  return Math.max(ly, ry, doc.y) + 16;
}

function drawContinuationHeader(doc: PdfDoc, view: InvoiceViewDto, page: number): number {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text("INVOICE (continued)", MARGIN, MARGIN);
  doc.font("Helvetica").fontSize(8).fillColor("#666666").text(
    `${view.invoiceNumber} · ${view.invoiceDate} · Page ${page}`,
    MARGIN,
    MARGIN + 14,
    { width: W, align: "right" }
  );
  drawHr(doc, MARGIN + CONTINUATION_HEADER_H - 6);
  return MARGIN + CONTINUATION_HEADER_H;
}

function drawTableHeaderRow(doc: PdfDoc, state: PdfLayoutState): void {
  const widths = colWidths(state);
  let x = MARGIN;
  doc.rect(MARGIN, state.y, W, TABLE_HEADER_H).fill("#f0f0f0");
  doc.fillColor("#333333").font("Helvetica-Bold").fontSize(7);
  for (let i = 0; i < state.cols.length; i++) {
    const c = state.cols[i]!;
    const cw = widths[i]!;
    doc.text(c.label, x + 2, state.y + 4, { width: cw - 4, align: c.align });
    x += cw;
  }
  state.y += TABLE_HEADER_H;
}

function startNewPage(doc: PdfDoc, view: InvoiceViewDto, state: PdfLayoutState): void {
  doc.addPage();
  state.page += 1;
  state.y = drawContinuationHeader(doc, view, state.page);
  drawTableHeaderRow(doc, state);
}

/** Ensure vertical space; opens a new page with continuation + table header when needed. */
function ensureSpace(doc: PdfDoc, view: InvoiceViewDto, state: PdfLayoutState, needed: number): void {
  if (state.y + needed <= BOTTOM_Y) return;
  startNewPage(doc, view, state);
}

function measureTextHeight(doc: PdfDoc, text: string, width: number, fontSize = 8): number {
  doc.font("Helvetica").fontSize(fontSize);
  return doc.heightOfString(text || " ", { width: Math.max(20, width - 4) });
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
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor("#000000");
  for (let i = 0; i < state.cols.length; i++) {
    const c = state.cols[i]!;
    const cw = widths[i]!;
    const text = values[i] ?? "";
    doc.text(text, x + 2, y + 4, {
      width: cw - 4,
      align: c.align as CellAlign,
      height: rowH - 6,
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
    maxOtherH = Math.max(maxOtherH, h + 8);
  }

  let descRest = values[0] ?? "";
  let firstSegment = true;

  while (descRest || firstSegment) {
    ensureSpace(doc, view, state, MIN_DATA_ROW_H + 4);
    const availableH = BOTTOM_Y - state.y - 4;
    const maxDescH = Math.max(MIN_DATA_ROW_H, availableH - 8, maxOtherH);
    const { chunk, rest } = splitTextForHeight(doc, descRest, state.descColWidth, maxDescH);
    descRest = rest;

    const isFirstSegment = firstSegment;
    const rowValues = isFirstSegment
      ? [chunk || " ", ...values.slice(1)]
      : [chunk || " ", ...values.slice(1).map(() => "")];
    firstSegment = false;

    const descH = measureTextHeight(doc, rowValues[0] ?? "", state.descColWidth);
    const rowH = Math.max(MIN_DATA_ROW_H, descH + 8, isFirstSegment ? maxOtherH : MIN_DATA_ROW_H);

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
  doc.font(opts.italic ? "Helvetica-Oblique" : "Helvetica").fontSize(fontSize).fillColor(opts.centered ? "#555555" : "#000000");
  const h = measureTextHeight(doc, text, W, fontSize) + 8;
  ensureSpace(doc, view, state, h);
  doc.text(text, MARGIN, state.y, {
    width: W,
    align: opts.centered ? "center" : "left",
    lineBreak: true,
  });
  state.y = doc.y + 12;
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
      doc.font("Helvetica").fontSize(7).fillColor("#999999").text(
        `Page ${i - range.start + 1} of ${range.count}`,
        MARGIN,
        PAGE_H - 24,
        { width: W, align: "center" }
      );
    }

    doc.end();
  });
}
