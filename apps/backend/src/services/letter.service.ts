import { LetterModel, LETTER_TYPE, LETTER_STATUS } from "../models/Letter.model.js";
import { generateLetterId } from "../utils/funtIdGenerator.js";
import { generateOfferLetterPdf, generateExperienceLetterPdf } from "../utils/pdfLetter.js";
import { signLetterPayload, verifyLetterSignatures, getLetterIssuerConfig, type LetterSignablePayload } from "../utils/letterSigning.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

export interface CreateLetterInput {
  type: string;
  recipientName: string;
  recipientEmail?: string;
  employmentType: string;
  department: string;
  designation: string;
  joiningDate: Date;
  endDate?: Date;
  stipend?: string;
  ctc?: string;
  location?: string;
  reportingTo?: string;
  performanceSummary?: string;
  issuedBy: string;
}

export async function createLetter(input: CreateLetterInput) {
  const letterId = await generateLetterId();

  if (input.type === LETTER_TYPE.EXPERIENCE_LETTER && !input.endDate) {
    throw new AppError("End date is required for experience letters", 400);
  }

  const issuedAt = new Date();

  // Compute digital signature
  const signablePayload: LetterSignablePayload = {
    letterId,
    type: input.type,
    recipientName: input.recipientName.trim(),
    designation: input.designation.trim(),
    department: input.department,
    employmentType: input.employmentType,
    joiningDate: input.joiningDate.toISOString(),
    endDate: input.endDate?.toISOString(),
    issuedAt: issuedAt.toISOString(),
  };
  const { documentHash, electronicSignature } = signLetterPayload(signablePayload);

  const letter = await LetterModel.create({
    letterId,
    type: input.type,
    recipientName: input.recipientName.trim(),
    recipientEmail: input.recipientEmail?.trim() || undefined,
    employmentType: input.employmentType,
    department: input.department,
    designation: input.designation.trim(),
    joiningDate: input.joiningDate,
    endDate: input.endDate ?? undefined,
    stipend: input.stipend?.trim() || undefined,
    ctc: input.ctc?.trim() || undefined,
    location: input.location?.trim() || "Remote",
    reportingTo: input.reportingTo?.trim() || undefined,
    performanceSummary: input.performanceSummary?.trim() || undefined,
    issuedBy: input.issuedBy,
    issuedAt,
    status: LETTER_STATUS.ACTIVE,
    documentHash,
    electronicSignature,
  });

  await createAuditLog("LETTER_ISSUED", input.issuedBy, "Letter", letterId, {
    type: input.type,
    recipientName: input.recipientName,
  });

  return {
    id: String(letter._id),
    letterId: letter.letterId,
    type: letter.type,
    recipientName: letter.recipientName,
    status: letter.status,
    issuedAt: letter.issuedAt,
  };
}

export async function getLetterById(letterId: string) {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).lean().exec();
  if (!letter) throw new AppError("Letter not found", 404);
  return letter;
}

export async function listLetters(filters?: { type?: string; status?: string; search?: string }) {
  const query: Record<string, unknown> = {};
  if (filters?.type) query.type = filters.type;
  if (filters?.status) query.status = filters.status;
  if (filters?.search) {
    const term = filters.search.trim();
    query.$or = [
      { recipientName: { $regex: term, $options: "i" } },
      { letterId: { $regex: term, $options: "i" } },
      { recipientEmail: { $regex: term, $options: "i" } },
    ];
  }
  return LetterModel.find(query).sort({ issuedAt: -1 }).lean().exec();
}

export async function revokeLetter(letterId: string, revokedBy: string, reason: string) {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.status === LETTER_STATUS.REVOKED) throw new AppError("Letter is already revoked", 400);

  letter.status = LETTER_STATUS.REVOKED;
  (letter as unknown as { revokedAt: Date }).revokedAt = new Date();
  (letter as unknown as { revokedBy: string }).revokedBy = revokedBy;
  (letter as unknown as { revokedReason: string }).revokedReason = reason.trim();
  await letter.save();

  await createAuditLog("LETTER_REVOKED", revokedBy, "Letter", letterId, { reason });

  return { letterId: letter.letterId, status: letter.status };
}

export async function generateLetterPdf(letterId: string): Promise<Buffer> {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).lean().exec();
  if (!letter) throw new AppError("Letter not found", 404);

  if (letter.type === LETTER_TYPE.OFFER_LETTER) {
    return generateOfferLetterPdf({
      letterId: letter.letterId!,
      recipientName: letter.recipientName,
      designation: letter.designation,
      department: letter.department,
      employmentType: letter.employmentType,
      joiningDate: new Date(letter.joiningDate),
      stipend: letter.stipend ?? undefined,
      ctc: letter.ctc ?? undefined,
      location: letter.location ?? undefined,
      reportingTo: letter.reportingTo ?? undefined,
      issuedAt: new Date(letter.issuedAt),
    });
  }

  if (letter.type === LETTER_TYPE.EXPERIENCE_LETTER) {
    return generateExperienceLetterPdf({
      letterId: letter.letterId!,
      recipientName: letter.recipientName,
      designation: letter.designation,
      department: letter.department,
      employmentType: letter.employmentType,
      joiningDate: new Date(letter.joiningDate),
      endDate: new Date(letter.endDate!),
      performanceSummary: letter.performanceSummary ?? undefined,
      issuedAt: new Date(letter.issuedAt),
    });
  }

  throw new AppError("Unknown letter type", 400);
}

export async function verifyLetterPublic(letterId: string) {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() })
    .select("letterId type recipientName designation department employmentType joiningDate endDate status issuedAt revokedAt documentHash electronicSignature")
    .lean()
    .exec();

  if (!letter) return null;

  await createAuditLog("LETTER_VERIFY_ACCESSED", "public", "Letter", letterId).catch(() => {});

  // Verify digital signature integrity
  const issuer = getLetterIssuerConfig();
  let signatureValid = false;
  if (letter.documentHash && letter.electronicSignature) {
    const signablePayload: LetterSignablePayload = {
      letterId: letter.letterId!,
      type: letter.type,
      recipientName: letter.recipientName,
      designation: letter.designation,
      department: letter.department,
      employmentType: letter.employmentType,
      joiningDate: new Date(letter.joiningDate).toISOString(),
      endDate: letter.endDate ? new Date(letter.endDate).toISOString() : undefined,
      issuedAt: new Date(letter.issuedAt).toISOString(),
    };
    signatureValid = verifyLetterSignatures(signablePayload, letter.documentHash, letter.electronicSignature);
  }

  return {
    letterId: letter.letterId,
    type: letter.type,
    recipientName: letter.recipientName,
    designation: letter.designation,
    department: letter.department,
    employmentType: letter.employmentType,
    joiningDate: letter.joiningDate,
    endDate: letter.endDate,
    status: letter.status,
    issuedAt: letter.issuedAt,
    isValid: letter.status === LETTER_STATUS.ACTIVE,
    signatureValid,
    signedBy: issuer.signedBy,
    issuer: issuer.legalName,
  };
}
