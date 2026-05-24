export interface InvoiceSettingsDto {
  legalName: string;
  address: string;
  gstin: string;
  pan: string;
  placeOfSupply: string;
  hsnCode: string;
  sacCode: string;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  defaultNotes: string;
  systemFooterText: string;
  showLegalName: boolean;
  showAddress: boolean;
  showGstin: boolean;
  showPan: boolean;
  showRecipient: boolean;
  showRecipientEmail: boolean;
  showRecipientAddress: boolean;
  showRecipientPhone: boolean;
  showHsn: boolean;
  showSac: boolean;
  showTaxableValue: boolean;
  showCgst: boolean;
  showSgst: boolean;
  showIgst: boolean;
  showTotalInWords: boolean;
  showSystemFooter: boolean;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettingsDto = {
  legalName: "Funt Robotics",
  address:
    "1st Floor, 2-20-2/211, Ganesh Nagar, Sai Nagar, Uppal, Hyderabad, Telangana 500039",
  gstin: "",
  pan: "",
  placeOfSupply: "Telangana (36)",
  hsnCode: "",
  sacCode: "999293",
  cgstPercent: 0,
  sgstPercent: 0,
  igstPercent: 18,
  defaultNotes: "",
  systemFooterText:
    "This is a system generated invoice and does not require a signature or a digital signature",
  showLegalName: true,
  showAddress: true,
  showGstin: true,
  showPan: false,
  showRecipient: true,
  showRecipientEmail: true,
  showRecipientAddress: true,
  showRecipientPhone: true,
  showHsn: true,
  showSac: true,
  showTaxableValue: true,
  showCgst: false,
  showSgst: false,
  showIgst: true,
  showTotalInWords: false,
  showSystemFooter: true,
};
