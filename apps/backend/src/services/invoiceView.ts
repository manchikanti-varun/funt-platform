import { amountInIndianRupeeWords } from "../utils/amountInWords.js";
import { getPublicInvoiceVerifyUrl } from "../utils/invoiceSigning.js";
import type { InvoiceSettingsDto } from "./invoiceSettings.service.js";

export interface InvoiceBaseDto {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentUsername: string;
  batchName: string;
  courseTitle: string;
  lineDescription: string;
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

function formatAmountPlain(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDdMmYyyy(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatSignedDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface InvoiceViewDto extends InvoiceBaseDto {
  settings: InvoiceSettingsDto;
  subtotalInPaise: number;
  igstInPaise: number;
  grandTotalInPaise: number;
  subtotalFormatted: string;
  igstFormatted: string;
  igstLabel: string;
  grandTotalFormatted: string;
  balanceDueFormatted: string;
  totalInWords: string;
  invoiceDate: string;
  dueDate: string;
  shipToName: string;
  shipToLines: string;
  displayNotes: string;
  signedAtFormatted: string;
}

export function buildInvoiceView(
  invoice: InvoiceBaseDto,
  settings: InvoiceSettingsDto
): InvoiceViewDto {
  const issued = invoice.issuedAt instanceof Date ? invoice.issuedAt : new Date(invoice.issuedAt);
  const signedAtRaw = invoice.electronicallySignedAt ?? invoice.issuedAt;
  const signedAt = signedAtRaw instanceof Date ? signedAtRaw : new Date(signedAtRaw);

  const discount = Math.max(0, invoice.discountInPaise ?? 0);
  const subtotalInPaise = Math.max(0, invoice.amountInPaise);
  const igstRate = settings.showIgst ? settings.igstPercent : 0;
  const igstInPaise = Math.round((subtotalInPaise * igstRate) / 100);
  const grandTotalInPaise = Math.max(0, subtotalInPaise + igstInPaise - discount);

  const shipToName = invoice.studentName || invoice.studentUsername || "Student";
  const shipToLines = [invoice.batchName, settings.placeOfSupply].filter(Boolean).join("\n");

  const displayNotes = invoice.notes?.trim() || settings.defaultNotes;

  return {
    ...invoice,
    settings,
    subtotalInPaise,
    igstInPaise,
    grandTotalInPaise,
    totalInPaise: grandTotalInPaise,
    amountFormatted: formatRupees(grandTotalInPaise),
    subtotalFormatted: formatAmountPlain(subtotalInPaise),
    igstFormatted: formatAmountPlain(igstInPaise),
    igstLabel: `IGST${igstRate} (${igstRate}%)`,
    grandTotalFormatted: formatRupees(grandTotalInPaise),
    balanceDueFormatted: formatRupees(grandTotalInPaise),
    totalInWords: amountInIndianRupeeWords(grandTotalInPaise),
    invoiceDate: formatDdMmYyyy(issued),
    dueDate: formatDdMmYyyy(issued),
    electronicallySignedAt: signedAt,
    verifyUrl: invoice.verifyUrl ?? getPublicInvoiceVerifyUrl(invoice.invoiceNumber),
    shipToName,
    shipToLines,
    displayNotes,
    signedAtFormatted: formatSignedDateTime(signedAt),
  };
}
