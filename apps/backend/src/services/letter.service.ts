import { LetterModel, LETTER_TYPE, LETTER_STATUS, APPROVAL_STATUS } from "../models/Letter.model.js";
import { generateLetterId } from "../utils/funtIdGenerator.js";
import { generateOfferLetterPdf, generateExperienceLetterPdf } from "../utils/pdfLetter.js";
import { signLetterPayload, verifyLetterSignatures, getLetterIssuerConfig, type LetterSignablePayload } from "../utils/letterSigning.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateLetterInput {
  type: string;
  recipientName: string;
  recipientEmail?: string;
  recipientMobile?: string;
  recipientGender?: string;
  employmentType: string;
  department: string;
  designation: string;
  joiningDate: Date;
  endDate?: Date;
  duration?: string;
  stipend?: string;
  stipendAmount?: number;
  ctc?: string;
  location?: string;
  reportingTo?: string;
  responsibilities?: string;
  performanceSummary?: string;
  dutiesDescription?: string;
  signatoryName?: string;
  signatoryRole?: string;
  signatoryImageUrl?: string;
  stampImageUrl?: string;
  linkedLetterId?: string;
  issuedBy: string;
  /** If true, skip approval (super admin creating directly) */
  autoApprove?: boolean;
}

export interface UpdateLetterInput {
  recipientName?: string;
  recipientEmail?: string;
  recipientMobile?: string;
  recipientGender?: string;
  employmentType?: string;
  department?: string;
  designation?: string;
  joiningDate?: Date;
  endDate?: Date;
  duration?: string;
  stipend?: string;
  stipendAmount?: number;
  ctc?: string;
  location?: string;
  reportingTo?: string;
  responsibilities?: string;
  performanceSummary?: string;
  dutiesDescription?: string;
  signatoryName?: string;
  signatoryRole?: string;
  signatoryImageUrl?: string;
  stampImageUrl?: string;
  acceptanceDeadlineDays?: number;
}

// ─── Create Letter (Draft or Auto-Approved) ───────────────────────────────────

export async function createLetter(input: CreateLetterInput) {
  if (input.type === LETTER_TYPE.EXPERIENCE_LETTER && !input.endDate) {
    throw new AppError("End date is required for experience letters", 400);
  }

  // Generate an internshipGroup ID to link offer + experience letters
  const internshipGroup = input.linkedLetterId
    ? (await LetterModel.findOne({ letterId: input.linkedLetterId }).select("internshipGroup").lean().exec())?.internshipGroup ?? input.linkedLetterId
    : crypto.randomBytes(8).toString("hex");

  // If linkedLetterId is set, pre-fill from the offer letter
  let linkedLetterData: Record<string, unknown> = {};
  if (input.linkedLetterId && input.type === LETTER_TYPE.EXPERIENCE_LETTER) {
    const offerLetter = await LetterModel.findOne({ letterId: input.linkedLetterId }).lean().exec();
    if (!offerLetter) throw new AppError("Linked offer letter not found", 404);
    linkedLetterData = {
      recipientName: offerLetter.recipientName,
      recipientEmail: offerLetter.recipientEmail,
      employmentType: offerLetter.employmentType,
      department: offerLetter.department,
      designation: offerLetter.designation,
      joiningDate: offerLetter.joiningDate,
      location: offerLetter.location,
      reportingTo: offerLetter.reportingTo,
    };
  }

  const isAutoApproved = !!input.autoApprove;
  const now = new Date();

  const letterData: Record<string, unknown> = {
    ...linkedLetterData,
    type: input.type,
    recipientName: input.recipientName.trim(),
    recipientEmail: input.recipientEmail?.trim() || undefined,
    recipientMobile: input.recipientMobile?.trim() || undefined,
    recipientGender: input.recipientGender || "Mr",
    employmentType: input.employmentType,
    department: input.department,
    designation: input.designation.trim(),
    joiningDate: input.joiningDate,
    endDate: input.endDate ?? undefined,
    duration: input.duration?.trim() || undefined,
    stipend: input.stipend?.trim() || undefined,
    stipendAmount: input.stipendAmount ?? undefined,
    ctc: input.ctc?.trim() || undefined,
    location: input.location?.trim() || "Hyderabad",
    reportingTo: input.reportingTo?.trim() || undefined,
    responsibilities: input.responsibilities?.trim() || undefined,
    performanceSummary: input.performanceSummary?.trim() || undefined,
    dutiesDescription: input.dutiesDescription?.trim() || undefined,
    signatoryName: input.signatoryName?.trim() || undefined,
    signatoryRole: input.signatoryRole?.trim() || undefined,
    signatoryImageUrl: input.signatoryImageUrl?.trim() || undefined,
    stampImageUrl: input.stampImageUrl?.trim() || undefined,
    linkedLetterId: input.linkedLetterId || undefined,
    internshipGroup,
    issuedBy: input.issuedBy,
    acceptanceDeadlineDays: 3,
  };

  if (isAutoApproved) {
    // Super admin creates directly — auto-approve and generate ID
    const letterId = await generateLetterId();
    const deadlineDays = 3;
    const acceptanceDeadline = new Date(now);
    acceptanceDeadline.setDate(acceptanceDeadline.getDate() + deadlineDays);

    const signablePayload: LetterSignablePayload = {
      letterId,
      type: input.type,
      recipientName: input.recipientName.trim(),
      designation: input.designation.trim(),
      department: input.department,
      employmentType: input.employmentType,
      joiningDate: input.joiningDate.toISOString(),
      endDate: input.endDate?.toISOString(),
      issuedAt: now.toISOString(),
    };
    const { documentHash, electronicSignature } = signLetterPayload(signablePayload);

    const letter = await LetterModel.create({
      ...letterData,
      letterId,
      issuedAt: now,
      status: input.type === LETTER_TYPE.EXPERIENCE_LETTER ? LETTER_STATUS.ACTIVE : LETTER_STATUS.PENDING_ACCEPTANCE,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      approvedBy: input.issuedBy,
      approvedAt: now,
      acceptanceDeadline: input.type === LETTER_TYPE.OFFER_LETTER ? acceptanceDeadline : undefined,
      documentHash,
      electronicSignature,
    });

    await createAuditLog("LETTER_ISSUED", input.issuedBy, "Letter", letterId, {
      type: input.type, recipientName: input.recipientName, autoApproved: true,
    });

    return formatLetterResponse(letter);
  }

  // Admin creates — draft status, needs approval
  const letter = await LetterModel.create({
    ...letterData,
    status: LETTER_STATUS.DRAFT,
    approvalStatus: APPROVAL_STATUS.DRAFT,
  });

  await createAuditLog("LETTER_CREATED_DRAFT", input.issuedBy, "Letter", String(letter._id), {
    type: input.type, recipientName: input.recipientName,
  });

  return formatLetterResponse(letter);
}

// ─── Submit for Approval ──────────────────────────────────────────────────────

export async function submitForApproval(letterMongoId: string, submittedBy: string) {
  const letter = await LetterModel.findById(letterMongoId).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.approvalStatus !== APPROVAL_STATUS.DRAFT && letter.approvalStatus !== APPROVAL_STATUS.REJECTED_BY_SA) {
    throw new AppError(`Cannot submit — current approval status is ${letter.approvalStatus}`, 400);
  }

  letter.approvalStatus = APPROVAL_STATUS.PENDING_APPROVAL;
  (letter as unknown as { approvalRequestedAt: Date }).approvalRequestedAt = new Date();
  // Clear previous rejection reason
  (letter as unknown as { approvalRejectReason: string | undefined }).approvalRejectReason = undefined;
  await letter.save();

  await createAuditLog("LETTER_SUBMITTED_FOR_APPROVAL", submittedBy, "Letter", String(letter._id));
  return formatLetterResponse(letter);
}

// ─── Approve (Super Admin) ────────────────────────────────────────────────────

export async function approveLetter(letterMongoId: string, approvedBy: string) {
  const letter = await LetterModel.findById(letterMongoId).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.approvalStatus !== APPROVAL_STATUS.PENDING_APPROVAL) {
    throw new AppError(`Cannot approve — current status is ${letter.approvalStatus}`, 400);
  }

  const now = new Date();
  const letterId = await generateLetterId();
  const deadlineDays = (letter as { acceptanceDeadlineDays?: number }).acceptanceDeadlineDays ?? 3;
  const acceptanceDeadline = new Date(now);
  acceptanceDeadline.setDate(acceptanceDeadline.getDate() + deadlineDays);

  // Generate digital signature
  const signablePayload: LetterSignablePayload = {
    letterId,
    type: letter.type,
    recipientName: letter.recipientName,
    designation: letter.designation,
    department: letter.department,
    employmentType: letter.employmentType,
    joiningDate: new Date(letter.joiningDate).toISOString(),
    endDate: letter.endDate ? new Date(letter.endDate).toISOString() : undefined,
    issuedAt: now.toISOString(),
  };
  const { documentHash, electronicSignature } = signLetterPayload(signablePayload);

  letter.letterId = letterId;
  letter.approvalStatus = APPROVAL_STATUS.APPROVED;
  (letter as unknown as { approvedBy: string }).approvedBy = approvedBy;
  (letter as unknown as { approvedAt: Date }).approvedAt = now;
  letter.issuedAt = now;
  letter.documentHash = documentHash;
  letter.electronicSignature = electronicSignature;

  if (letter.type === LETTER_TYPE.OFFER_LETTER) {
    letter.status = LETTER_STATUS.PENDING_ACCEPTANCE;
    (letter as unknown as { acceptanceDeadline: Date }).acceptanceDeadline = acceptanceDeadline;
  } else {
    letter.status = LETTER_STATUS.ACTIVE;
  }

  await letter.save();

  await createAuditLog("LETTER_APPROVED", approvedBy, "Letter", letterId, {
    type: letter.type, recipientName: letter.recipientName,
  });

  return formatLetterResponse(letter);
}

// ─── Reject (Super Admin) ─────────────────────────────────────────────────────

export async function rejectLetterApproval(letterMongoId: string, rejectedBy: string, reason: string) {
  const letter = await LetterModel.findById(letterMongoId).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.approvalStatus !== APPROVAL_STATUS.PENDING_APPROVAL) {
    throw new AppError(`Cannot reject — current status is ${letter.approvalStatus}`, 400);
  }

  letter.approvalStatus = APPROVAL_STATUS.REJECTED_BY_SA;
  (letter as unknown as { approvalRejectReason: string }).approvalRejectReason = reason.trim();
  letter.status = LETTER_STATUS.DRAFT;
  await letter.save();

  await createAuditLog("LETTER_APPROVAL_REJECTED", rejectedBy, "Letter", String(letter._id), { reason });
  return formatLetterResponse(letter);
}

// ─── Intern Accepts ───────────────────────────────────────────────────────────

export async function internAcceptLetter(letterId: string, acceptedBy: string) {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.status !== LETTER_STATUS.PENDING_ACCEPTANCE) {
    throw new AppError(`Cannot accept — current status is ${letter.status}`, 400);
  }

  const now = new Date();
  letter.status = LETTER_STATUS.ACCEPTED;
  (letter as unknown as { internResponse: string }).internResponse = "ACCEPTED";
  (letter as unknown as { internRespondedAt: Date }).internRespondedAt = now;
  (letter as unknown as { acceptedAt: Date }).acceptedAt = now;
  await letter.save();

  await createAuditLog("LETTER_ACCEPTED_BY_INTERN", acceptedBy, "Letter", letterId);
  return formatLetterResponse(letter);
}

// ─── Intern Rejects ───────────────────────────────────────────────────────────

export async function internRejectLetter(letterId: string, rejectedBy: string, reason?: string) {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.status !== LETTER_STATUS.PENDING_ACCEPTANCE) {
    throw new AppError(`Cannot reject — current status is ${letter.status}`, 400);
  }

  const now = new Date();
  letter.status = LETTER_STATUS.REJECTED_BY_INTERN;
  (letter as unknown as { internResponse: string }).internResponse = "REJECTED";
  (letter as unknown as { internRespondedAt: Date }).internRespondedAt = now;
  (letter as unknown as { internRejectReason: string | undefined }).internRejectReason = reason?.trim() || undefined;
  await letter.save();

  await createAuditLog("LETTER_REJECTED_BY_INTERN", rejectedBy, "Letter", letterId, { reason });
  return formatLetterResponse(letter);
}

// ─── Admin Withdraws ──────────────────────────────────────────────────────────

export async function withdrawLetter(letterId: string, withdrawnBy: string) {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.status !== LETTER_STATUS.PENDING_ACCEPTANCE) {
    throw new AppError(`Cannot withdraw — current status is ${letter.status}`, 400);
  }

  letter.status = LETTER_STATUS.WITHDRAWN;
  (letter as unknown as { withdrawnAt: Date }).withdrawnAt = new Date();
  (letter as unknown as { withdrawnBy: string }).withdrawnBy = withdrawnBy;
  await letter.save();

  await createAuditLog("LETTER_WITHDRAWN", withdrawnBy, "Letter", letterId);
  return { letterId: letter.letterId, status: letter.status };
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

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

// ─── Update (only DRAFT or REJECTED_BY_SA) ───────────────────────────────────

export async function updateLetter(letterMongoId: string, input: UpdateLetterInput, updatedBy: string) {
  const letter = await LetterModel.findById(letterMongoId).exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (letter.approvalStatus !== APPROVAL_STATUS.DRAFT && letter.approvalStatus !== APPROVAL_STATUS.REJECTED_BY_SA) {
    throw new AppError("Can only edit letters in DRAFT or REJECTED status", 400);
  }

  const fields: Array<keyof UpdateLetterInput> = [
    "recipientName", "recipientEmail", "recipientMobile", "recipientGender",
    "employmentType", "department", "designation", "joiningDate", "endDate",
    "duration", "stipend", "stipendAmount", "ctc", "location", "reportingTo",
    "responsibilities", "performanceSummary", "dutiesDescription",
    "signatoryName", "signatoryRole", "signatoryImageUrl", "stampImageUrl",
    "acceptanceDeadlineDays",
  ];

  for (const field of fields) {
    if (input[field] !== undefined) {
      (letter as unknown as Record<string, unknown>)[field] = input[field];
    }
  }

  await letter.save();
  await createAuditLog("LETTER_UPDATED", updatedBy, "Letter", String(letter._id));
  return formatLetterResponse(letter);
}

// ─── Create Experience Letter from Offer ──────────────────────────────────────

export async function createExperienceFromOffer(offerLetterId: string, input: {
  endDate: Date;
  dutiesDescription: string;
  performanceSummary?: string;
  signatoryName?: string;
  signatoryRole?: string;
  signatoryImageUrl?: string;
  stampImageUrl?: string;
  issuedBy: string;
  autoApprove?: boolean;
}) {
  const offer = await LetterModel.findOne({ letterId: offerLetterId.trim().toUpperCase() }).lean().exec();
  if (!offer) throw new AppError("Offer letter not found", 404);
  if (offer.type !== LETTER_TYPE.OFFER_LETTER) throw new AppError("Can only create experience from an offer letter", 400);
  if (offer.status !== LETTER_STATUS.ACCEPTED && offer.status !== LETTER_STATUS.ACTIVE) {
    throw new AppError("Offer letter must be accepted before issuing experience letter", 400);
  }

  // Check if experience already exists for this group
  const existingExp = await LetterModel.findOne({
    internshipGroup: offer.internshipGroup,
    type: LETTER_TYPE.EXPERIENCE_LETTER,
    status: { $nin: [LETTER_STATUS.REVOKED, LETTER_STATUS.WITHDRAWN] },
  }).lean().exec();
  if (existingExp) throw new AppError("Experience letter already exists for this internship", 400);

  return createLetter({
    type: LETTER_TYPE.EXPERIENCE_LETTER,
    recipientName: offer.recipientName,
    recipientEmail: offer.recipientEmail ?? undefined,
    recipientMobile: (offer as { recipientMobile?: string }).recipientMobile ?? undefined,
    recipientGender: (offer as { recipientGender?: string }).recipientGender ?? "Mr",
    employmentType: offer.employmentType,
    department: offer.department,
    designation: offer.designation,
    joiningDate: new Date(offer.joiningDate),
    endDate: input.endDate,
    location: offer.location ?? undefined,
    reportingTo: offer.reportingTo ?? undefined,
    dutiesDescription: input.dutiesDescription,
    performanceSummary: input.performanceSummary,
    signatoryName: input.signatoryName,
    signatoryRole: input.signatoryRole,
    signatoryImageUrl: input.signatoryImageUrl,
    stampImageUrl: input.stampImageUrl,
    linkedLetterId: offerLetterId,
    issuedBy: input.issuedBy,
    autoApprove: input.autoApprove,
  });
}

// ─── List & Get ───────────────────────────────────────────────────────────────

export async function getLetterById(letterId: string) {
  // Try by letterId first (for approved letters), then by _id (for drafts)
  let letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).lean().exec();
  if (!letter && /^[a-f\d]{24}$/i.test(letterId)) {
    letter = await LetterModel.findById(letterId).lean().exec();
  }
  if (!letter) throw new AppError("Letter not found", 404);
  return letter;
}

export async function listLetters(filters?: { type?: string; status?: string; approvalStatus?: string; search?: string }) {
  const query: Record<string, unknown> = {};
  if (filters?.type) query.type = filters.type;
  if (filters?.status) query.status = filters.status;
  if (filters?.approvalStatus) query.approvalStatus = filters.approvalStatus;
  if (filters?.search) {
    const term = filters.search.trim();
    query.$or = [
      { recipientName: { $regex: term, $options: "i" } },
      { letterId: { $regex: term, $options: "i" } },
      { recipientEmail: { $regex: term, $options: "i" } },
      { designation: { $regex: term, $options: "i" } },
    ];
  }
  return LetterModel.find(query).sort({ createdAt: -1 }).lean().exec();
}

export async function listPendingApprovals() {
  return LetterModel.find({ approvalStatus: APPROVAL_STATUS.PENDING_APPROVAL })
    .sort({ approvalRequestedAt: -1 }).lean().exec();
}

// ─── Auto-expire ──────────────────────────────────────────────────────────────

export async function expireOverdueLetters(): Promise<number> {
  const now = new Date();
  const result = await LetterModel.updateMany(
    {
      status: LETTER_STATUS.PENDING_ACCEPTANCE,
      acceptanceDeadline: { $lte: now },
    },
    { $set: { status: LETTER_STATUS.EXPIRED } }
  ).exec();
  return result.modifiedCount;
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

export async function generateLetterPdf(letterId: string): Promise<Buffer> {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() }).lean().exec();
  if (!letter) throw new AppError("Letter not found", 404);
  if (!letter.letterId) throw new AppError("Letter not yet approved — no ID assigned", 400);

  if (letter.type === LETTER_TYPE.OFFER_LETTER) {
    return generateOfferLetterPdf({
      letterId: letter.letterId!,
      recipientName: letter.recipientName,
      designation: letter.designation,
      department: letter.department,
      employmentType: letter.employmentType,
      joiningDate: new Date(letter.joiningDate),
      endDate: letter.endDate ? new Date(letter.endDate) : undefined,
      duration: (letter as { duration?: string }).duration ?? undefined,
      stipend: letter.stipend ?? undefined,
      ctc: letter.ctc ?? undefined,
      location: letter.location ?? undefined,
      reportingTo: letter.reportingTo ?? undefined,
      responsibilities: (letter as { responsibilities?: string }).responsibilities ?? undefined,
      issuedAt: new Date(letter.issuedAt!),
      signatoryName: (letter as { signatoryName?: string }).signatoryName,
      signatoryRole: (letter as { signatoryRole?: string }).signatoryRole,
      signatoryImageUrl: (letter as { signatoryImageUrl?: string }).signatoryImageUrl,
    });
  }

  if (letter.type === LETTER_TYPE.EXPERIENCE_LETTER) {
    return generateExperienceLetterPdf({
      letterId: letter.letterId!,
      recipientName: letter.recipientName,
      recipientGender: (letter as { recipientGender?: string }).recipientGender ?? "Mr",
      designation: letter.designation,
      department: letter.department,
      employmentType: letter.employmentType,
      joiningDate: new Date(letter.joiningDate),
      endDate: new Date(letter.endDate!),
      dutiesDescription: (letter as { dutiesDescription?: string }).dutiesDescription,
      performanceSummary: letter.performanceSummary ?? undefined,
      issuedAt: new Date(letter.issuedAt!),
      signatoryName: (letter as { signatoryName?: string }).signatoryName,
      signatoryRole: (letter as { signatoryRole?: string }).signatoryRole,
      signatoryImageUrl: (letter as { signatoryImageUrl?: string }).signatoryImageUrl,
      stampImageUrl: (letter as { stampImageUrl?: string }).stampImageUrl,
    });
  }

  throw new AppError("Unknown letter type", 400);
}

// ─── Public Verification ──────────────────────────────────────────────────────

export async function verifyLetterPublic(letterId: string) {
  const letter = await LetterModel.findOne({ letterId: letterId.trim().toUpperCase() })
    .select("letterId type recipientName designation department employmentType joiningDate endDate status issuedAt revokedAt documentHash electronicSignature internResponse")
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
      issuedAt: new Date(letter.issuedAt!).toISOString(),
    };
    signatureValid = verifyLetterSignatures(signablePayload, letter.documentHash, letter.electronicSignature);
  }

  const validStatuses = [LETTER_STATUS.ACCEPTED, LETTER_STATUS.ACTIVE, LETTER_STATUS.PENDING_ACCEPTANCE];
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
    internResponse: (letter as { internResponse?: string }).internResponse ?? null,
    issuedAt: letter.issuedAt,
    isValid: validStatuses.includes(letter.status as typeof validStatuses[number]),
    signatureValid,
    signedBy: issuer.signedBy,
    issuer: issuer.legalName,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLetterResponse(letter: unknown) {
  const doc = (letter && typeof letter === "object" && "toJSON" in letter)
    ? (letter as { toJSON: () => Record<string, unknown> }).toJSON()
    : letter as Record<string, unknown>;
  return {
    id: String(doc._id),
    letterId: doc.letterId ?? null,
    type: doc.type,
    recipientName: doc.recipientName,
    recipientEmail: doc.recipientEmail ?? null,
    recipientGender: doc.recipientGender ?? "Mr",
    designation: doc.designation,
    department: doc.department,
    employmentType: doc.employmentType,
    joiningDate: doc.joiningDate,
    endDate: doc.endDate ?? null,
    duration: doc.duration ?? null,
    stipend: doc.stipend ?? null,
    reportingTo: doc.reportingTo ?? null,
    responsibilities: doc.responsibilities ?? null,
    dutiesDescription: doc.dutiesDescription ?? null,
    performanceSummary: doc.performanceSummary ?? null,
    signatoryName: doc.signatoryName ?? null,
    signatoryRole: doc.signatoryRole ?? null,
    status: doc.status,
    approvalStatus: doc.approvalStatus,
    approvalRejectReason: doc.approvalRejectReason ?? null,
    internResponse: doc.internResponse ?? null,
    internRejectReason: doc.internRejectReason ?? null,
    linkedLetterId: doc.linkedLetterId ?? null,
    internshipGroup: doc.internshipGroup ?? null,
    issuedAt: doc.issuedAt ?? null,
    acceptanceDeadline: doc.acceptanceDeadline ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Legacy export for backward compatibility
export async function acceptLetter(letterId: string, acceptedBy: string) {
  return internAcceptLetter(letterId, acceptedBy);
}
