import { amountInIndianRupeeWords } from "../utils/amountInWords.js";
import { calculateInvoiceTax } from "../utils/invoiceTax.js";
import { getPublicInvoiceVerifyUrl } from "../utils/invoiceSigning.js";
import { resolveLineHsnSac, type InvoiceLineItemType } from "../utils/invoiceCodes.js";
import type { InvoiceSettingsDto } from "./invoiceSettings.service.js";

export interface InvoiceBaseDto {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress: string;
  studentUsername: string;
  batchName: string;
  courseTitle: string;
  lineDescription: string;
  lineItemType?: InvoiceLineItemType | string;
  lineHsnCode?: string;
  lineSacCode?: string;
  amountInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
  amountFormatted: string;
  currency: string;
  notes: string;
  issuedAt: Date | string;
  electronicallySignedAt?: Date | string;
  documentHash?: string;
  verifyUrl?: string;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInrPlain(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDdMmYyyy(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export interface InvoiceViewDto extends InvoiceBaseDto {
  settings: InvoiceSettingsDto;
  taxableInPaise: number;
  taxableFormatted: string;
  cgstInPaise: number;
  sgstInPaise: number;
  igstInPaise: number;
  cgstFormatted: string;
  sgstFormatted: string;
  igstFormatted: string;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  unitPriceFormatted: string;
  lineTotalFormatted: string;
  quantity: number;
  grandTotalInPaise: number;
  grandTotalFormatted: string;
  totalInWords: string;
  invoiceDate: string;
  recipientState: string;
  displayNotes: string;
  currencyLabel: string;
  lineItemType: InvoiceLineItemType;
  lineHsnDisplay: string;
  lineSacDisplay: string;
}

export function buildInvoiceView(
  invoice: InvoiceBaseDto,
  settings: InvoiceSettingsDto
): InvoiceViewDto {
  const issued = invoice.issuedAt instanceof Date ? invoice.issuedAt : new Date(invoice.issuedAt);
  const grandTotalInPaise = Math.max(0, invoice.totalInPaise);
  const tax = calculateInvoiceTax(grandTotalInPaise, settings);

  const displayNotes = invoice.notes?.trim() || settings.defaultNotes;
  const codes = resolveLineHsnSac({
    lineItemType: invoice.lineItemType ?? "SERVICE",
    settings,
    lineHsnCode: invoice.lineHsnCode,
    lineSacCode: invoice.lineSacCode,
  });

  return {
    ...invoice,
    settings,
    currency: "INR",
    currencyLabel: "INR",
    totalInPaise: grandTotalInPaise,
    amountFormatted: formatRupees(grandTotalInPaise),
    taxableInPaise: tax.taxableInPaise,
    taxableFormatted: formatInrPlain(tax.taxableInPaise),
    cgstInPaise: tax.cgstInPaise,
    sgstInPaise: tax.sgstInPaise,
    igstInPaise: tax.igstInPaise,
    cgstFormatted: formatInrPlain(tax.cgstInPaise),
    sgstFormatted: formatInrPlain(tax.sgstInPaise),
    igstFormatted: formatInrPlain(tax.igstInPaise),
    cgstPercent: tax.cgstPercent,
    sgstPercent: tax.sgstPercent,
    igstPercent: tax.igstPercent,
    unitPriceFormatted: formatInrPlain(tax.unitPriceInPaise),
    lineTotalFormatted: formatInrPlain(grandTotalInPaise),
    quantity: tax.quantity,
    grandTotalInPaise,
    grandTotalFormatted: formatRupees(grandTotalInPaise),
    totalInWords: amountInIndianRupeeWords(grandTotalInPaise),
    invoiceDate: formatDdMmYyyy(issued),
    recipientState: settings.placeOfSupply,
    displayNotes,
    verifyUrl: invoice.verifyUrl ?? getPublicInvoiceVerifyUrl(invoice.invoiceNumber),
    lineItemType: codes.lineItemType,
    lineHsnDisplay: codes.lineHsnDisplay,
    lineSacDisplay: codes.lineSacDisplay,
  };
}
