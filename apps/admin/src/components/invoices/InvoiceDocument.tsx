import type { InvoiceSettingsDto } from "./invoiceSettingsTypes";
import { DEFAULT_INVOICE_SETTINGS } from "./invoiceSettingsTypes";

export interface InvoiceDocumentData {
  invoiceNumber: string;
  issuedAt: string | Date;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  studentAddress?: string;
  studentUsername?: string;
  courseTitle: string;
  batchName: string;
  lineDescription: string;
  lineItemType?: "SERVICE" | "GOODS";
  lineHsnDisplay?: string;
  lineSacDisplay?: string;
  settings?: InvoiceSettingsDto;
  taxableFormatted?: string;
  cgstFormatted?: string;
  sgstFormatted?: string;
  igstFormatted?: string;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  unitPriceFormatted?: string;
  lineTotalFormatted?: string;
  quantity?: number;
  grandTotalFormatted?: string;
  totalInWords?: string;
  invoiceDate?: string;
  recipientState?: string;
  currencyLabel?: string;
  isPreview?: boolean;
}

const th = "border border-slate-300 bg-slate-100 px-2 py-2 text-left text-xs font-semibold text-slate-700";
const td = "border border-slate-300 px-2 py-2 text-xs text-slate-800";

export const SAMPLE_INVOICE: InvoiceDocumentData = {
  invoiceNumber: "FUNT-INV-20250524-0001",
  issuedAt: new Date("2025-05-24"),
  studentName: "Srikar Ch",
  studentEmail: "srikar@example.com",
  studentPhone: "+91 98765 43210",
  studentAddress: "Hyderabad, Telangana",
  lineDescription: "Robotics Fundamentals — Batch 2025 Morning",
  lineItemType: "SERVICE",
  lineHsnDisplay: "—",
  lineSacDisplay: "999293",
  courseTitle: "Robotics Fundamentals",
  batchName: "Batch 2025 — Morning",
  invoiceDate: "24/05/2025",
  quantity: 1,
  unitPriceFormatted: "4,236.44",
  taxableFormatted: "4,236.44",
  cgstFormatted: "0.00",
  sgstFormatted: "0.00",
  igstFormatted: "762.56",
  cgstPercent: 0,
  sgstPercent: 0,
  igstPercent: 18,
  lineTotalFormatted: "4,999.00",
  grandTotalFormatted: "₹4,999.00",
  recipientState: "Telangana (36)",
  currencyLabel: "INR",
  settings: DEFAULT_INVOICE_SETTINGS,
  isPreview: true,
};

export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
  const s = invoice.settings ?? DEFAULT_INVOICE_SETTINGS;
  const qty = invoice.quantity ?? 1;
  const currency = invoice.currencyLabel ?? "INR";

  return (
    <article className="mx-auto max-w-[210mm] border border-slate-400 bg-white text-slate-900">
      <div className="flex items-start justify-between gap-4 border-b border-slate-300 px-6 py-5">
        <img src="/funt-logo.png" alt="FUNT" className="h-10 w-auto" />
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Original for recipient
          </p>
          <h1 className="text-xl font-bold tracking-tight">TAX INVOICE</h1>
          <p className="mt-2 text-xs">
            <span className="text-slate-500">Invoice #: </span>
            <span className="font-semibold">{invoice.invoiceNumber}</span>
          </p>
          <p className="text-xs">
            <span className="text-slate-500">Invoice date: </span>
            <span className="font-medium">{invoice.invoiceDate}</span>
          </p>
        </div>
      </div>

      <div className="grid border-b border-slate-300 sm:grid-cols-2">
        <div className="border-slate-300 p-4 sm:border-r">
          <p className="text-xs font-bold text-slate-800">Company details:</p>
          <div className="mt-2 space-y-1 text-xs text-slate-700">
            {s.showLegalName ? <p className="font-semibold">{s.legalName}</p> : null}
            {s.showAddress && s.address ? <p className="whitespace-pre-line">{s.address}</p> : null}
            {s.showGstin && s.gstin ? <p>GSTIN: {s.gstin}</p> : null}
            {s.showPan && s.pan ? <p>PAN no.: {s.pan}</p> : null}
          </div>
        </div>
        {s.showRecipient ? (
          <div className="p-4">
            <p className="text-xs font-bold text-slate-800">Recipient details:</p>
            <div className="mt-2 space-y-1 text-xs text-slate-700">
              <p className="font-semibold">{invoice.studentName || invoice.studentUsername}</p>
              {s.showRecipientEmail && invoice.studentEmail ? <p>{invoice.studentEmail}</p> : null}
              {s.showRecipientAddress && invoice.studentAddress ? (
                <p className="whitespace-pre-line">{invoice.studentAddress}</p>
              ) : null}
              {s.showRecipientPhone && invoice.studentPhone ? <p>{invoice.studentPhone}</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className={th}>Description</th>
              {s.showHsn ? <th className={th}>HSN Code</th> : null}
              {s.showSac ? <th className={th}>SAC Code</th> : null}
              <th className={`${th} text-center`}>Quantity</th>
              <th className={`${th} text-right`}>Unit Price</th>
              {s.showTaxableValue ? <th className={`${th} text-right`}>Taxable Value</th> : null}
              {s.showCgst ? (
                <th className={`${th} text-center`}>CGST ({invoice.cgstPercent ?? s.cgstPercent}%)</th>
              ) : null}
              {s.showSgst ? (
                <th className={`${th} text-center`}>SGST/UGST ({invoice.sgstPercent ?? s.sgstPercent}%)</th>
              ) : null}
              {s.showIgst ? (
                <th className={`${th} text-center`}>IGST ({invoice.igstPercent ?? s.igstPercent}%)</th>
              ) : null}
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>{invoice.lineDescription}</td>
              {s.showHsn ? <td className={td}>{invoice.lineHsnDisplay ?? "—"}</td> : null}
              {s.showSac ? <td className={td}>{invoice.lineSacDisplay ?? "—"}</td> : null}
              <td className={`${td} text-center`}>{qty.toFixed(1)}</td>
              <td className={`${td} text-right`}>{invoice.unitPriceFormatted}</td>
              {s.showTaxableValue ? (
                <td className={`${td} text-right`}>{invoice.taxableFormatted}</td>
              ) : null}
              {s.showCgst ? <td className={`${td} text-right`}>{invoice.cgstFormatted}</td> : null}
              {s.showSgst ? <td className={`${td} text-right`}>{invoice.sgstFormatted}</td> : null}
              {s.showIgst ? <td className={`${td} text-right`}>{invoice.igstFormatted}</td> : null}
              <td className={`${td} text-right font-medium`}>{invoice.lineTotalFormatted}</td>
            </tr>
            <tr className="bg-slate-50 font-semibold">
              <td className={td}>Total</td>
              {s.showHsn ? <td className={td} /> : null}
              {s.showSac ? <td className={td} /> : null}
              <td className={td} />
              <td className={td} />
              {s.showTaxableValue ? (
                <td className={`${td} text-right`}>{invoice.taxableFormatted}</td>
              ) : null}
              {s.showCgst ? <td className={`${td} text-right`}>{invoice.cgstFormatted}</td> : null}
              {s.showSgst ? <td className={`${td} text-right`}>{invoice.sgstFormatted}</td> : null}
              {s.showIgst ? <td className={`${td} text-right`}>{invoice.igstFormatted}</td> : null}
              <td className={`${td} text-right`}>
                {invoice.lineTotalFormatted} {currency}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {s.showTotalInWords && invoice.totalInWords ? (
        <p className="border-t border-slate-200 px-4 py-2 text-xs italic text-slate-600">
          {invoice.totalInWords}
        </p>
      ) : null}

      {s.showSystemFooter ? (
        <p className="border-t border-slate-200 px-4 py-4 text-center text-xs italic text-slate-600">
          {s.systemFooterText}
        </p>
      ) : null}

      {invoice.isPreview ? (
        <p className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">Preview only</p>
      ) : null}
    </article>
  );
}
