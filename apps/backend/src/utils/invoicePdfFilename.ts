/** Safe PDF filename from invoice number, e.g. FUNT-INV-20260524-0001.pdf */
export function invoicePdfFilename(invoiceNumber: string): string {
  const raw = String(invoiceNumber ?? "").trim();
  const base = raw.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const name = base || "invoice";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

export function invoicePdfContentDisposition(invoiceNumber: string, inline = false): string {
  const filename = invoicePdfFilename(invoiceNumber);
  const disposition = inline ? "inline" : "attachment";
  return `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
