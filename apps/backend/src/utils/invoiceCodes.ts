/** Digits-only GST code (HSN 4–8 digits, SAC 6 digits). */
export function sanitizeGstCode(raw: string, maxLen = 8): string {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, maxLen);
}

export type InvoiceLineItemType = "SERVICE" | "GOODS";

export function resolveLineHsnSac(input: {
  lineItemType: InvoiceLineItemType | string;
  settings: { hsnCode: string; sacCode: string };
  lineHsnCode?: string;
  lineSacCode?: string;
}): { lineHsnDisplay: string; lineSacDisplay: string; lineItemType: InvoiceLineItemType } {
  const lineItemType: InvoiceLineItemType = input.lineItemType === "GOODS" ? "GOODS" : "SERVICE";
  const hsnOverride = sanitizeGstCode(input.lineHsnCode ?? "", 8);
  const sacOverride = sanitizeGstCode(input.lineSacCode ?? "", 6);

  const hsn =
    hsnOverride ||
    (lineItemType === "GOODS" ? sanitizeGstCode(input.settings.hsnCode, 8) : "");
  const sac =
    sacOverride ||
    (lineItemType === "SERVICE" ? sanitizeGstCode(input.settings.sacCode, 6) : "");

  return {
    lineItemType,
    lineHsnDisplay: hsn || "—",
    lineSacDisplay: sac || "—",
  };
}
