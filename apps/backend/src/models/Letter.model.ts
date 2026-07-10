import mongoose, { Schema } from "mongoose";

export const LETTER_TYPE = {
  OFFER_LETTER: "OFFER_LETTER",
  EXPERIENCE_LETTER: "EXPERIENCE_LETTER",
} as const;

export const LETTER_STATUS = {
  PENDING_ACCEPTANCE: "PENDING_ACCEPTANCE",
  ACCEPTED: "ACCEPTED",
  EXPIRED: "EXPIRED",
  WITHDRAWN: "WITHDRAWN",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
} as const;

export const EMPLOYMENT_TYPE = {
  INTERN: "INTERN",
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
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
} as const;

const letterSchema = new Schema(
  {
    letterId: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(LETTER_TYPE),
    },
    // Recipient
    recipientName: { type: String, required: true },
    recipientEmail: { type: String, required: false },

    // Employment details
    employmentType: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    designation: { type: String, required: true },

    // Dates
    joiningDate: { type: Date, required: true },
    endDate: { type: Date, required: false },

    // Offer letter fields
    stipend: { type: String, required: false },
    ctc: { type: String, required: false },
    location: { type: String, required: false, default: "Remote" },
    reportingTo: { type: String, required: false },

    // Experience letter fields
    performanceSummary: { type: String, required: false },
    // Offer letter additional fields
    duration: { type: String, required: false },
    responsibilities: { type: String, required: false },

    // Metadata
    issuedBy: { type: String, required: true },
    issuedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      required: true,
      enum: Object.values(LETTER_STATUS),
      default: LETTER_STATUS.ACTIVE,
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
  },
  { timestamps: true }
);

letterSchema.index({ letterId: 1 });
letterSchema.index({ status: 1, type: 1 });
letterSchema.index({ recipientEmail: 1 });
letterSchema.index({ issuedAt: -1 });

export const LetterModel = mongoose.model("Letter", letterSchema);
