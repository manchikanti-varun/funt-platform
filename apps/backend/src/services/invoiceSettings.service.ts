import { InvoiceSettingsModel } from "../models/InvoiceSettings.model.js";
import { AppError } from "../utils/AppError.js";
import { sanitizeGstCode } from "../utils/invoiceCodes.js";

const CONFIG_KEY = "ACTIVE";

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
  updatedAt?: Date;
  updatedBy?: string;
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

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
}

function toDto(doc: Record<string, unknown> | null): InvoiceSettingsDto {
  if (!doc) return { ...DEFAULT_INVOICE_SETTINGS };
  const legacySac = String(doc.hsnSac ?? doc.sacCode ?? DEFAULT_INVOICE_SETTINGS.sacCode);
  const legacyHsn = String(doc.hsnCode ?? "");
  const legacyShow = doc.showHsnSac !== false;

  return {
    legalName: String(doc.legalName ?? DEFAULT_INVOICE_SETTINGS.legalName),
    address: String(doc.address ?? DEFAULT_INVOICE_SETTINGS.address),
    gstin: String(doc.gstin ?? ""),
    pan: String(doc.pan ?? ""),
    placeOfSupply: String(doc.placeOfSupply ?? DEFAULT_INVOICE_SETTINGS.placeOfSupply),
    hsnCode: sanitizeGstCode(legacyHsn, 8),
    sacCode: sanitizeGstCode(legacySac, 6),
    cgstPercent: num(doc.cgstPercent, DEFAULT_INVOICE_SETTINGS.cgstPercent),
    sgstPercent: num(doc.sgstPercent, DEFAULT_INVOICE_SETTINGS.sgstPercent),
    igstPercent: num(doc.igstPercent, DEFAULT_INVOICE_SETTINGS.igstPercent),
    defaultNotes: String(doc.defaultNotes ?? ""),
    systemFooterText: String(
      doc.systemFooterText ?? DEFAULT_INVOICE_SETTINGS.systemFooterText
    ),
    showLegalName: doc.showLegalName !== false,
    showAddress: doc.showAddress !== false,
    showGstin: doc.showGstin !== false,
    showPan: doc.showPan === true,
    showRecipient: (doc.showRecipient ?? doc.showBillTo) !== false,
    showRecipientEmail: doc.showRecipientEmail !== false,
    showRecipientAddress: doc.showRecipientAddress !== false,
    showRecipientPhone: doc.showRecipientPhone !== false,
    showHsn: doc.showHsn !== undefined ? doc.showHsn === true : legacyShow,
    showSac: doc.showSac !== undefined ? doc.showSac === true : legacyShow,
    showTaxableValue: doc.showTaxableValue !== false,
    showCgst: doc.showCgst === true,
    showSgst: doc.showSgst === true,
    showIgst: doc.showIgst !== undefined ? doc.showIgst === true : DEFAULT_INVOICE_SETTINGS.showIgst,
    showTotalInWords: doc.showTotalInWords === true,
    showSystemFooter: doc.showSystemFooter !== false,
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
    "showRecipient",
    "showRecipientEmail",
    "showRecipientAddress",
    "showRecipientPhone",
    "showHsn",
    "showSac",
    "showTaxableValue",
    "showCgst",
    "showSgst",
    "showIgst",
    "showTotalInWords",
    "showSystemFooter",
  ] as const;
  const strKeys = [
    "legalName",
    "address",
    "gstin",
    "pan",
    "placeOfSupply",
    "defaultNotes",
    "systemFooterText",
  ] as const;
  const numKeys = ["cgstPercent", "sgstPercent", "igstPercent"] as const;

  for (const k of strKeys) {
    if (input[k] !== undefined) patch[k] = String(input[k]).trim();
  }
  if (input.hsnCode !== undefined) patch.hsnCode = sanitizeGstCode(input.hsnCode, 8);
  if (input.sacCode !== undefined) patch.sacCode = sanitizeGstCode(input.sacCode, 6);
  for (const k of boolKeys) {
    if (input[k] !== undefined) patch[k] = Boolean(input[k]);
  }
  for (const k of numKeys) {
    if (input[k] !== undefined) patch[k] = num(input[k], 0);
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
