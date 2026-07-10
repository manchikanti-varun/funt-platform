import { createHash, createHmac, timingSafeEqual } from "crypto";

export const LETTER_SIGNATURE_VERSION = 1;

export interface LetterSignablePayload {
  letterId: string;
  type: string;
  recipientName: string;
  designation: string;
  department: string;
  employmentType: string;
  joiningDate: string;
  endDate?: string;
  issuedAt: string;
}

function signingSecret(): string {
  const secret =
    process.env.LETTER_SIGNING_SECRET?.trim() ||
    process.env.INVOICE_SIGNING_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() || "";
  if (!secret) {
    throw new Error("LETTER_SIGNING_SECRET, INVOICE_SIGNING_SECRET, or JWT_SECRET is required for letter signing");
  }
  return secret;
}

export function buildCanonicalLetterPayload(payload: LetterSignablePayload): string {
  const body = {
    v: LETTER_SIGNATURE_VERSION,
    letterId: payload.letterId,
    type: payload.type,
    recipientName: payload.recipientName,
    designation: payload.designation,
    department: payload.department,
    employmentType: payload.employmentType,
    joiningDate: payload.joiningDate,
    endDate: payload.endDate ?? null,
    issuedAt: payload.issuedAt,
  };
  return JSON.stringify(body);
}

export function computeLetterDocumentHash(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function computeLetterElectronicSignature(canonical: string): string {
  return createHmac("sha256", signingSecret()).update(canonical, "utf8").digest("hex");
}

export function signLetterPayload(payload: LetterSignablePayload): {
  documentHash: string;
  electronicSignature: string;
} {
  const canonical = buildCanonicalLetterPayload(payload);
  return {
    documentHash: computeLetterDocumentHash(canonical),
    electronicSignature: computeLetterElectronicSignature(canonical),
  };
}

export function verifyLetterSignatures(
  payload: LetterSignablePayload,
  documentHash: string,
  electronicSignature: string
): boolean {
  const canonical = buildCanonicalLetterPayload(payload);
  const expectedHash = computeLetterDocumentHash(canonical);
  const expectedSig = computeLetterElectronicSignature(canonical);
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

export function getLetterIssuerConfig() {
  return {
    legalName: (process.env.INVOICE_ISSUER_LEGAL_NAME ?? "FUNT Robotics Academy").trim(),
    signedBy: (process.env.LETTER_SIGNED_BY ?? process.env.INVOICE_ISSUER_LEGAL_NAME ?? "FUNT Robotics Academy").trim(),
  };
}
