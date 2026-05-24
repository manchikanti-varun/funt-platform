import { createHash, createHmac, timingSafeEqual } from "crypto";

/** Canonical payload version for electronic invoice integrity (IT Act 2000–style record). */
export const INVOICE_SIGNATURE_VERSION = 1;

export interface InvoiceSignablePayload {
  invoiceNumber: string;
  studentId: string;
  batchId: string;
  courseId: string;
  amountInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
  currency: string;
  lineDescription: string;
  status: string;
  issuedAt: Date;
}

export function getInvoiceIssuerConfig() {
  return {
    legalName: (process.env.INVOICE_ISSUER_LEGAL_NAME ?? "FUNT Robotics Academy").trim(),
    signedBy:
      (process.env.INVOICE_ISSUER_SIGNED_BY ?? process.env.INVOICE_ISSUER_LEGAL_NAME ?? "FUNT Robotics Academy").trim(),
    address: (process.env.INVOICE_ISSUER_ADDRESS ?? "").trim(),
    gstin: (process.env.INVOICE_ISSUER_GSTIN ?? "").trim(),
    pan: (process.env.INVOICE_ISSUER_PAN ?? "").trim(),
    state: (process.env.INVOICE_ISSUER_STATE ?? "").trim(),
    email: (process.env.INVOICE_ISSUER_EMAIL ?? "").trim(),
    phone: (process.env.INVOICE_ISSUER_PHONE ?? "").trim(),
  };
}

function signingSecret(): string {
  const secret =
    process.env.INVOICE_SIGNING_SECRET?.trim() || process.env.JWT_SECRET?.trim() || "";
  if (!secret) {
    throw new Error("INVOICE_SIGNING_SECRET or JWT_SECRET is required for invoice signing");
  }
  return secret;
}

export function buildCanonicalInvoicePayload(payload: InvoiceSignablePayload): string {
  const body = {
    v: INVOICE_SIGNATURE_VERSION,
    invoiceNumber: payload.invoiceNumber,
    studentId: payload.studentId,
    batchId: payload.batchId,
    courseId: payload.courseId,
    amountInPaise: payload.amountInPaise,
    discountInPaise: payload.discountInPaise,
    totalInPaise: payload.totalInPaise,
    currency: payload.currency,
    lineDescription: payload.lineDescription,
    status: payload.status,
    issuedAt: payload.issuedAt.toISOString(),
  };
  return JSON.stringify(body);
}

export function computeInvoiceDocumentHash(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function computeInvoiceElectronicSignature(canonical: string): string {
  return createHmac("sha256", signingSecret()).update(canonical, "utf8").digest("hex");
}

export function signInvoicePayload(payload: InvoiceSignablePayload): {
  documentHash: string;
  electronicSignature: string;
} {
  const canonical = buildCanonicalInvoicePayload(payload);
  return {
    documentHash: computeInvoiceDocumentHash(canonical),
    electronicSignature: computeInvoiceElectronicSignature(canonical),
  };
}

export function verifyInvoiceSignatures(
  payload: InvoiceSignablePayload,
  documentHash: string,
  electronicSignature: string
): boolean {
  const canonical = buildCanonicalInvoicePayload(payload);
  const expectedHash = computeInvoiceDocumentHash(canonical);
  const expectedSig = computeInvoiceElectronicSignature(canonical);
  try {
    const hashOk =
      documentHash.length === expectedHash.length &&
      timingSafeEqual(Buffer.from(documentHash, "hex"), Buffer.from(expectedHash, "hex"));
    const sigOk =
      electronicSignature.length === expectedSig.length &&
      timingSafeEqual(Buffer.from(electronicSignature, "hex"), Buffer.from(expectedSig, "hex"));
    return hashOk && sigOk;
  } catch {
    return false;
  }
}

export function getPublicInvoiceVerifyUrl(invoiceNumber: string): string {
  const base = (process.env.BACKEND_PUBLIC_URL ?? "http://localhost:38472").replace(/\/+$/, "");
  return `${base}/verify/invoice/${encodeURIComponent(invoiceNumber)}`;
}
