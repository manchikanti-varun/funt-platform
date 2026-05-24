export interface InvoiceSettingsDto {
  legalName: string;
  address: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  placeOfSupply: string;
  terms: string;
  hsnSac: string;
  igstPercent: number;
  defaultNotes: string;
  signatoryName: string;
  showLegalName: boolean;
  showAddress: boolean;
  showGstin: boolean;
  showPan: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showInvoiceMeta: boolean;
  showTerms: boolean;
  showDueDate: boolean;
  showPlaceOfSupply: boolean;
  showBillTo: boolean;
  showShipTo: boolean;
  showHsnSac: boolean;
  showIgst: boolean;
  showTotalInWords: boolean;
  showNotes: boolean;
  showBalanceDue: boolean;
  showDigitalSignature: boolean;
  showVerifyLink: boolean;
  showDocumentHash: boolean;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettingsDto = {
  legalName: "Funt Robotics",
  address:
    "1st Floor, 2-20-2/211, Ganesh Nagar, Sai Nagar, Uppal, Hyderabad, Telangana 500039",
  gstin: "",
  pan: "",
  email: "",
  phone: "",
  placeOfSupply: "Telangana (36)",
  terms: "Due on Receipt",
  hsnSac: "999293",
  igstPercent: 0,
  defaultNotes: "Thanks for your business.",
  signatoryName: "Funt Robotics",
  showLegalName: true,
  showAddress: true,
  showGstin: true,
  showPan: false,
  showEmail: false,
  showPhone: false,
  showInvoiceMeta: true,
  showTerms: true,
  showDueDate: true,
  showPlaceOfSupply: true,
  showBillTo: true,
  showShipTo: false,
  showHsnSac: true,
  showIgst: false,
  showTotalInWords: true,
  showNotes: true,
  showBalanceDue: true,
  showDigitalSignature: true,
  showVerifyLink: false,
  showDocumentHash: false,
};
