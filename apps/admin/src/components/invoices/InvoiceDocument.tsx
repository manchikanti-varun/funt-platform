import type { InvoiceSettingsDto } from "./invoiceSettingsTypes";
import { DEFAULT_INVOICE_SETTINGS } from "./invoiceSettingsTypes";

export interface InvoiceDocumentData {
  invoiceNumber: string;
  issuedAt: string | Date;
  electronicallySignedAt?: string | Date;
  studentName: string;
  studentEmail?: string;
  studentUsername?: string;
  courseTitle: string;
  batchName: string;
  lineDescription: string;
  amountInPaise: number;
  discountInPaise?: number;
  totalInPaise?: number;
  amountFormatted?: string;
  currency?: string;
  notes?: string;
  settings?: InvoiceSettingsDto;
  subtotalInPaise?: number;
  igstInPaise?: number;
  grandTotalInPaise?: number;
  subtotalFormatted?: string;
  igstFormatted?: string;
  igstLabel?: string;
  grandTotalFormatted?: string;
  balanceDueFormatted?: string;
  totalInWords?: string;
  invoiceDate?: string;
  dueDate?: string;
  shipToName?: string;
  shipToLines?: string;
  displayNotes?: string;
  signedAtFormatted?: string;
  documentHash?: string;
  verifyUrl?: string;
  isPreview?: boolean;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const SAMPLE_INVOICE: InvoiceDocumentData = {
  invoiceNumber: "FUNT-INV-20250524-0001",
  issuedAt: new Date("2025-05-24T10:30:00"),
  electronicallySignedAt: new Date("2025-05-24T10:30:00"),
  studentName: "Srikar Ch",
  studentEmail: "srikar@example.com",
  studentUsername: "srikar.ch",
  courseTitle: "Robotics Fundamentals",
  batchName: "Batch 2025 — Morning",
  lineDescription: "Course enrollment — Robotics Fundamentals (Batch 2025 — Morning)",
  amountInPaise: 499900,
  discountInPaise: 0,
  totalInPaise: 499900,
  subtotalInPaise: 499900,
  igstInPaise: 0,
  grandTotalInPaise: 499900,
  subtotalFormatted: "4,999.00",
  igstFormatted: "0.00",
  igstLabel: "IGST0 (0%)",
  grandTotalFormatted: "₹4,999.00",
  balanceDueFormatted: "₹4,999.00",
  totalInWords: "Indian Rupee Four Thousand Nine Hundred Ninety Nine Only",
  invoiceDate: "24/05/2025",
  dueDate: "24/05/2025",
  signedAtFormatted: "24-05-2025 10:30:00",
  shipToName: "Srikar Ch",
  shipToLines: "Batch 2025 — Morning\nTelangana (36)",
  displayNotes: DEFAULT_INVOICE_SETTINGS.defaultNotes,
  settings: DEFAULT_INVOICE_SETTINGS,
  isPreview: true,
};

export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
  const s = invoice.settings ?? DEFAULT_INVOICE_SETTINGS;
  const discount = invoice.discountInPaise ?? 0;
  const subtotal = invoice.subtotalInPaise ?? invoice.amountInPaise;
  const igst = invoice.igstInPaise ?? 0;
  const grandTotal = invoice.grandTotalInPaise ?? invoice.totalInPaise ?? subtotal + igst - discount;
  const subtotalFmt = invoice.subtotalFormatted ?? formatRupees(subtotal).replace("₹", "");
  const igstFmt = invoice.igstFormatted ?? "0.00";
  const igstLabel = invoice.igstLabel ?? `IGST${s.igstPercent} (${s.igstPercent}%)`;

  return (
    <article className="mx-auto max-w-[210mm] border border-slate-300 bg-white text-sm text-slate-900 print:border-slate-400">
      <div className="border-b border-slate-300 p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div className="max-w-md">
            {s.showLegalName ? (
              <p className="text-2xl font-bold text-slate-900">{s.legalName}</p>
            ) : null}
            {s.showAddress && s.address ? (
              <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{s.address}</p>
            ) : null}
            <div className="mt-2 space-y-0.5 text-xs text-slate-600">
              {s.showGstin && s.gstin ? <p>GSTIN: {s.gstin}</p> : null}
              {s.showPan && s.pan ? <p>PAN: {s.pan}</p> : null}
              {s.showEmail && s.email ? <p>{s.email}</p> : null}
              {s.showPhone && s.phone ? <p>{s.phone}</p> : null}
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">TAX INVOICE</h1>
        </div>
      </div>

      {s.showInvoiceMeta ? (
        <div className="grid border-b border-slate-300 sm:grid-cols-2">
          <div className="space-y-1 border-slate-300 p-4 text-xs sm:border-r">
            <p>
              <span className="text-slate-500"># </span>
              <span className="font-semibold">{invoice.invoiceNumber}</span>
            </p>
            <p>
              <span className="text-slate-500">Invoice Date </span>
              <span className="font-medium">{invoice.invoiceDate}</span>
            </p>
            {s.showTerms ? (
              <p>
                <span className="text-slate-500">Terms </span>
                <span className="font-medium">{s.terms}</span>
              </p>
            ) : null}
            {s.showDueDate ? (
              <p>
                <span className="text-slate-500">Due Date </span>
                <span className="font-medium">{invoice.dueDate}</span>
              </p>
            ) : null}
          </div>
          {s.showPlaceOfSupply ? (
            <div className="p-4 text-xs">
              <p>
                <span className="text-slate-500">Place Of Supply </span>
                <span className="font-medium">{s.placeOfSupply}</span>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {(s.showBillTo || s.showShipTo) && (
        <div className="grid border-b border-slate-300 sm:grid-cols-2">
          {s.showBillTo ? (
            <div className="border-slate-300 p-4 sm:border-r">
              <p className="text-xs font-semibold text-slate-500">Bill To</p>
              <p className="mt-1 font-semibold">
                {invoice.studentName || invoice.studentUsername || "Student"}
              </p>
              {invoice.studentEmail ? <p className="text-xs text-slate-600">{invoice.studentEmail}</p> : null}
            </div>
          ) : null}
          {s.showShipTo ? (
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-500">Ship To</p>
              <p className="mt-1 whitespace-pre-line text-xs">{invoice.shipToLines}</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50">
              <th className="px-2 py-2 text-left font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold">Item &amp; Description</th>
              {s.showHsnSac ? <th className="px-2 py-2 text-left font-semibold">HSN/SAC</th> : null}
              <th className="px-2 py-2 text-center font-semibold">Qty</th>
              <th className="px-2 py-2 text-right font-semibold">Rate</th>
              {s.showIgst && s.igstPercent > 0 ? (
                <>
                  <th className="px-2 py-2 text-center font-semibold">IGST %</th>
                  <th className="px-2 py-2 text-right font-semibold">IGST Amt</th>
                </>
              ) : null}
              <th className="px-2 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-3">1</td>
              <td className="px-2 py-3">{invoice.lineDescription}</td>
              {s.showHsnSac ? <td className="px-2 py-3">{s.hsnSac}</td> : null}
              <td className="px-2 py-3 text-center">1.00</td>
              <td className="px-2 py-3 text-right">{subtotalFmt}</td>
              {s.showIgst && s.igstPercent > 0 ? (
                <>
                  <td className="px-2 py-3 text-center">{s.igstPercent}%</td>
                  <td className="px-2 py-3 text-right">{igstFmt}</td>
                </>
              ) : null}
              <td className="px-2 py-3 text-right font-medium">{subtotalFmt}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="text-xs">
          {s.showTotalInWords && invoice.totalInWords ? (
            <>
              <p className="font-semibold">Total In Words</p>
              <p className="mt-1 italic text-slate-700">{invoice.totalInWords}</p>
            </>
          ) : null}
          {s.showNotes && invoice.displayNotes ? (
            <>
              <p className="mt-4 font-semibold">Notes</p>
              <p className="mt-1 text-slate-700">{invoice.displayNotes}</p>
            </>
          ) : null}
        </div>
        <div className="text-xs sm:ml-auto sm:max-w-xs sm:w-full">
          <div className="flex justify-between py-1">
            <span className="text-slate-600">Sub Total</span>
            <span>{subtotalFmt}</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Discount</span>
              <span>−{formatRupees(discount).replace("₹", "")}</span>
            </div>
          ) : null}
          {s.showIgst && igst > 0 ? (
            <div className="flex justify-between py-1">
              <span className="text-slate-600">{igstLabel}</span>
              <span>{igstFmt}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-300 py-2 font-bold">
            <span>Total</span>
            <span>{invoice.grandTotalFormatted ?? formatRupees(grandTotal)}</span>
          </div>
          {s.showBalanceDue ? (
            <div className="flex justify-between py-1 font-bold">
              <span>Balance Due</span>
              <span>{invoice.balanceDueFormatted ?? formatRupees(grandTotal)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {s.showDigitalSignature ? (
        <div className="border-t border-slate-300 p-6">
          <div className="ml-auto max-w-xs text-right text-xs">
            <p>Digitally signed by {s.signatoryName}</p>
            <p className="mt-1">Date: {invoice.signedAtFormatted}</p>
            <div className="mt-6 border-t border-slate-400 pt-1 text-center text-slate-600">
              Authorized Signature
            </div>
            <p className="mt-3 text-left text-[10px] leading-relaxed text-slate-500">
              This document is electronically generated and digitally signed under applicable
              electronic transaction standards. No handwritten signature is required.
            </p>
          </div>
        </div>
      ) : null}

      {invoice.isPreview ? (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
          Preview only — not a signed invoice.
        </p>
      ) : null}
    </article>
  );
}
