export function invoicePdfFilename(invoiceNumber: string): string {
  const raw = String(invoiceNumber ?? "").trim();
  const base = raw.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const name = base || "invoice";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* use plain filename */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim().replace(/^"|"$/g, "") ?? null;
}
