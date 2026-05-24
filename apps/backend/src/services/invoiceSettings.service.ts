import { InvoiceSettingsModel } from "../models/InvoiceSettings.model.js";
import { AppError } from "../utils/AppError.js";

const CONFIG_KEY = "ACTIVE";

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
  updatedAt?: Date;
  updatedBy?: string;
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

function toDto(doc: Record<string, unknown> | null): InvoiceSettingsDto {
  if (!doc) return { ...DEFAULT_INVOICE_SETTINGS };
  return {
    legalName: String(doc.legalName ?? DEFAULT_INVOICE_SETTINGS.legalName),
    address: String(doc.address ?? DEFAULT_INVOICE_SETTINGS.address),
    gstin: String(doc.gstin ?? ""),
    pan: String(doc.pan ?? ""),
    email: String(doc.email ?? ""),
    phone: String(doc.phone ?? ""),
    placeOfSupply: String(doc.placeOfSupply ?? DEFAULT_INVOICE_SETTINGS.placeOfSupply),
    terms: String(doc.terms ?? DEFAULT_INVOICE_SETTINGS.terms),
    hsnSac: String(doc.hsnSac ?? DEFAULT_INVOICE_SETTINGS.hsnSac),
    igstPercent: Math.min(100, Math.max(0, Number(doc.igstPercent ?? 0))),
    defaultNotes: String(doc.defaultNotes ?? DEFAULT_INVOICE_SETTINGS.defaultNotes),
    signatoryName: String(doc.signatoryName ?? DEFAULT_INVOICE_SETTINGS.signatoryName),
    showLegalName: doc.showLegalName !== false,
    showAddress: doc.showAddress !== false,
    showGstin: doc.showGstin !== false,
    showPan: doc.showPan === true,
    showEmail: doc.showEmail === true,
    showPhone: doc.showPhone === true,
    showInvoiceMeta: doc.showInvoiceMeta !== false,
    showTerms: doc.showTerms !== false,
    showDueDate: doc.showDueDate !== false,
    showPlaceOfSupply: doc.showPlaceOfSupply !== false,
    showBillTo: doc.showBillTo !== false,
    showShipTo: doc.showShipTo === true,
    showHsnSac: doc.showHsnSac !== false,
    showIgst: doc.showIgst === true,
    showTotalInWords: doc.showTotalInWords !== false,
    showNotes: doc.showNotes !== false,
    showBalanceDue: doc.showBalanceDue !== false,
    showDigitalSignature: doc.showDigitalSignature !== false,
    showVerifyLink: doc.showVerifyLink === true,
    showDocumentHash: doc.showDocumentHash === true,
    updatedAt: doc.updatedAt as Date | undefined,
    updatedBy: String(doc.updatedBy ?? ""),
  };
}

export async function getInvoiceSettings(): Promise<InvoiceSettingsDto> {
  let doc = await InvoiceSettingsModel.findOne({ key: CONFIG_KEY }).lean().exec();
  if (!doc) {
    doc = (
      await InvoiceSettingsModel.create({ key: CONFIG_KEY, ...DEFAULT_INVOICE_SETTINGS })
    ).toObject();
  }
  return toDto(doc as Record<string, unknown>);
}

export async function updateInvoiceSettings(
  input: Partial<InvoiceSettingsDto>,
  updatedBy: string
): Promise<InvoiceSettingsDto> {
  const patch: Record<string, unknown> = { updatedBy };
  const boolKeys = [
    "showLegalName",
    "showAddress",
    "showGstin",
    "showPan",
    "showEmail",
    "showPhone",
    "showInvoiceMeta",
    "showTerms",
    "showDueDate",
    "showPlaceOfSupply",
    "showBillTo",
    "showShipTo",
    "showHsnSac",
    "showIgst",
    "showTotalInWords",
    "showNotes",
    "showBalanceDue",
    "showDigitalSignature",
    "showVerifyLink",
    "showDocumentHash",
  ] as const;
  const strKeys = [
    "legalName",
    "address",
    "gstin",
    "pan",
    "email",
    "phone",
    "placeOfSupply",
    "terms",
    "hsnSac",
    "defaultNotes",
    "signatoryName",
  ] as const;

  for (const k of strKeys) {
    if (input[k] !== undefined) patch[k] = String(input[k]).trim();
  }
  for (const k of boolKeys) {
    if (input[k] !== undefined) patch[k] = Boolean(input[k]);
  }
  if (input.igstPercent !== undefined) {
    patch.igstPercent = Math.min(100, Math.max(0, Number(input.igstPercent)));
  }

  const doc = await InvoiceSettingsModel.findOneAndUpdate(
    { key: CONFIG_KEY },
    { $set: patch },
    { upsert: true, new: true }
  )
    .lean()
    .exec();

  if (!doc) throw new AppError("Failed to save invoice settings", 500);
  return toDto(doc as Record<string, unknown>);
}
