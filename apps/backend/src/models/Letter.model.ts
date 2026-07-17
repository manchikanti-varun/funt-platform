import mongoose, { Schema } from "mongoose";

export const LETTER_TYPE = {
  OFFER_LETTER: "OFFER_LETTER",
  EXPERIENCE_LETTER: "EXPERIENCE_LETTER",
} as const;

export const LETTER_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  PENDING_ACCEPTANCE: "PENDING_ACCEPTANCE",
  ACCEPTED: "ACCEPTED",
  REJECTED_BY_INTERN: "REJECTED_BY_INTERN",
  EXPIRED: "EXPIRED",
  WITHDRAWN: "WITHDRAWN",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
} as const;

export const APPROVAL_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED_BY_SA: "REJECTED_BY_SA",
} as const;

export const EMPLOYMENT_TYPE = {
  INTERN: "INTERN",
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACT",
} as const;

export const DEPARTMENT = {
  ENGINEERING: "ENGINEERING",
  DESIGN: "DESIGN",
  SUPPORT: "SUPPORT",
  MARKETING: "MARKETING",
  OPERATIONS: "OPERATIONS",
  EDUCATION: "EDUCATION",
  HR: "HR",
  FINANCE: "FINANCE",
  ROBOTICS: "ROBOTICS",
  AI: "AI",
} as const;

const letterSchema = new Schema(
  {
    letterId: { type: String, required: false, unique: true, sparse: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(LETTER_TYPE),
    },
    // Recipient
    recipientName: { type: String, required: true },
    recipientEmail: { type: String, required: false },
    recipientMobile: { type: String, required: false },
    recipientGender: { type: String, required: false, enum: ["Mr", "Ms", "Mrs", "Mx"], default: "Mr" },

    // Employment details
    employmentType: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },

    // Dates
    joiningDate: { type: Date, required: true },
    endDate: { type: Date, required: false },

    // Offer letter fields
    stipend: { type: String, required: false },
    stipendAmount: { type: Number, required: false },
    ctc: { type: String, required: false },
    location: { type: String, required: false, default: "Hyderabad" },
    reportingTo: { type: String, required: false },
    duration: { type: String, required: false },
    responsibilities: { type: String, required: false },

    // Experience letter fields
    performanceSummary: { type: String, required: false },
    dutiesDescription: { type: String, required: false },
    linkedLetterId: { type: String, required: false },
    internshipGroup: { type: String, required: false },

    // ── Approval Workflow ──
    approvalStatus: {
      type: String,
      required: true,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.DRAFT,
    },
    approvalRequestedAt: { type: Date, required: false },
    approvedBy: { type: String, required: false },
    approvedAt: { type: Date, required: false },
    approvalRejectReason: { type: String, required: false },

    // ── Intern Response ──
    internResponse: { type: String, required: false, enum: ["ACCEPTED", "REJECTED", null] },
    internRespondedAt: { type: Date, required: false },
    internRejectReason: { type: String, required: false },

    // ── Signatory ──
    signatoryName: { type: String, required: false },
    signatoryRole: { type: String, required: false },
    signatoryImageUrl: { type: String, required: false },
    stampImageUrl: { type: String, required: false },

    // Metadata
    issuedBy: { type: String, required: true },
    issuedAt: { type: Date, required: false },
    status: {
      type: String,
      required: true,
      enum: Object.values(LETTER_STATUS),
      default: LETTER_STATUS.DRAFT,
    },
    revokedAt: { type: Date, required: false },
    revokedBy: { type: String, required: false },
    revokedReason: { type: String, required: false },
    // Acceptance workflow
    acceptanceDeadlineDays: { type: Number, required: false, default: 3 },
    acceptanceDeadline: { type: Date, required: false },
    acceptedAt: { type: Date, required: false },
    withdrawnAt: { type: Date, required: false },
    withdrawnBy: { type: String, required: false },
    // Digital signature
    documentHash: { type: String, required: false },
    electronicSignature: { type: String, required: false },
    // Template snapshot — preserves the letter template config at creation time
    // so future template changes don't affect previously issued letters
    templateSnapshot: { type: Schema.Types.Mixed, required: false },
    templateVersion: { type: Number, required: false },
  },
  { timestamps: true }
);

letterSchema.index({ letterId: 1 });
letterSchema.index({ status: 1, type: 1 });
letterSchema.index({ approvalStatus: 1 });
letterSchema.index({ recipientEmail: 1 });
letterSchema.index({ internshipGroup: 1 });
letterSchema.index({ issuedAt: -1 });

export const LetterModel = mongoose.model("Letter", letterSchema);
