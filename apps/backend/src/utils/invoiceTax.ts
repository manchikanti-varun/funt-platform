import type { InvoiceSettingsDto } from "../services/invoiceSettings.service.js";

export interface InvoiceTaxBreakdown {
  taxableInPaise: number;
  cgstInPaise: number;
  sgstInPaise: number;
  igstInPaise: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  totalTaxInPaise: number;
  grandTotalInPaise: number;
  quantity: number;
  unitPriceInPaise: number;
}

/** Reverse-calculate taxable value and tax splits from inclusive total (INR). */
export function calculateInvoiceTax(
  totalInPaise: number,
  settings: InvoiceSettingsDto
): InvoiceTaxBreakdown {
  const grandTotalInPaise = Math.max(0, Math.floor(totalInPaise));
  const cgstPercent = settings.showCgst ? settings.cgstPercent : 0;
  const sgstPercent = settings.showSgst ? settings.sgstPercent : 0;
  const igstPercent = settings.showIgst ? settings.igstPercent : 0;
  const combinedRate = cgstPercent + sgstPercent + igstPercent;

  if (combinedRate <= 0) {
    return {
      taxableInPaise: grandTotalInPaise,
      cgstInPaise: 0,
      sgstInPaise: 0,
      igstInPaise: 0,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
      totalTaxInPaise: 0,
      grandTotalInPaise,
      quantity: 1,
      unitPriceInPaise: grandTotalInPaise,
    };
  }

  const taxableInPaise = Math.round(grandTotalInPaise / (1 + combinedRate / 100));
  const cgstInPaise = Math.round((taxableInPaise * cgstPercent) / 100);
  const sgstInPaise = Math.round((taxableInPaise * sgstPercent) / 100);
  const igstInPaise = Math.round((taxableInPaise * igstPercent) / 100);
  const totalTaxInPaise = cgstInPaise + sgstInPaise + igstInPaise;

  return {
    taxableInPaise,
    cgstInPaise,
    sgstInPaise,
    igstInPaise,
    cgstPercent,
    sgstPercent,
    igstPercent,
    totalTaxInPaise,
    grandTotalInPaise,
    quantity: 1,
    unitPriceInPaise: taxableInPaise,
  };
}
