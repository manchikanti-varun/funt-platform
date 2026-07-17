import mongoose, { Schema } from "mongoose";

/**
 * Letter Settings — singleton document storing the current letter template configuration.
 * 
 * When a letter is created, the current settings are snapshotted onto the letter document
 * so that future changes to settings don't affect previously issued letters.
 */
const letterSettingsSchema = new Schema(
  {
    _id: { type: String, default: "global" },

    // ── Company Header ──
    companyName: { type: String, default: "FUNT ROBOTICS ACADEMY" },
    companyAddress: { type: String, default: "2-20-2/211, 1st Floor, Ganesh Nagar, Uppal, Hyderabad, TS PIN: 500039." },
    companyEmail: { type: String, default: "info@funt.in" },
    companyWeb: { type: String, default: "funt.in" },
    hrEmail: { type: String, default: "hr@funt.in" },
    companyLogoUrl: { type: String, required: false },

    // ── Offer Letter Template Paragraphs ──
    offerIntro: { type: String, default: "We are pleased to offer you an Internship at FUNT ROBOTICS (hereinafter referred to as \"FRA\" or \"we\") in the position of" },
    offerDuration: { type: String, default: "This internship is for a period of {{duration}}, beginning on {{startDate}} and ending on {{endDate}}." },
    offerReporting: { type: String, default: "As an intern, you will be reporting to Mr./Ms. {{reportingTo}}. Your primary responsibilities will include assisting in \"{{responsibilities}}\". Additionally, you will be expected to adhere to the company's policies and procedures at all times." },
    offerStipend: { type: String, default: "You will receive a stipend of INR {{stipend}} Per Month." },
    offerAcceptanceNote: { type: String, default: "please confirm your acceptance in writing via electronic mail to us on or before {{acceptanceDeadline}}." },
    offerCompletionNote: { type: String, default: "Please note that upon successful completion of your internship, you will be eligible for a full-time position or Internship extension with our company, subject to your performance and organizational requirements based on your performance during the internship and the final evaluation process." },
    offerClosing: { type: String, default: "We look forward to working with you." },
    offerAcceptanceBlock: { type: String, default: "I, {{recipientName}}, accept the above offer and agree to join as a {{designation}} on {{joiningDate}}." },

    // ── Page 2 ──
    page2Intro: { type: String, default: "Kindly sign and return a copy of this letter along with Annexure-1 to {{hrEmail}} to confirm your acceptance of this offer within 3 working days. If we do not receive your acceptance within the specified timeline, the offer will be automatically withdrawn without any further action from Funt Robotics Entity." },
    page2Welcome: { type: String, default: "We look forward to having you join our team and contribute to our growth. Best wishes and welcome to the team!" },
    page2Contact: { type: String, default: "Feel free to contact us at {{hrEmail}} for any further concerns." },

    // ── Annexure Items ──
    annexureItems: {
      type: [String],
      default: [
        "Professional / Educational Certificates (original) and Mark Sheets (original) towards:\n• 10th standard or equivalent examination\n• 12th standard or equivalent examination\n• Graduation\n• Post-graduation / Doctorate\nOther relevant educational or skill certifications",
        "Colour Scanned Copy of your Photographs and Hard copy of the offer letter (entire copy of offer letter)",
        "Scanned Copy of an Aadhaar Card, Voter ID, or Driving License.",
        "PAN Card, Bank Account Details: Bank Name, Your Name as per Bank records, Account Number, IFSC Code.",
        "Any of the below-mentioned Original Marksheet must be submitted for Employment verification During the Onboarding Process.\n• 10th Standard Original Marksheet\n• 12th Standard Original Marksheet\n• Degree Semester Marksheet / Consolidated Marksheet\n• Diploma Consolidated Marksheet",
      ],
    },

    // ── Experience Letter Template ──
    experienceTitle: { type: String, default: "INTERNSHIP EXPERIENCE LETTER" },
    experienceIntro: { type: String, default: "This is to certify that {{salutation}} {{recipientName}} was employed by Funt Robotics Academy as a {{employmentType}} employee to perform the duties of a {{designation}} from {{startDate}} to {{endDate}}." },
    experienceDuties: { type: String, default: "During the period of employment at Funt Robotics Academy, {{salutation}} {{recipientName}} duties included {{dutiesDescription}}." },
    experienceClosing: { type: String, default: "{{salutation}} {{recipientName}} has rendered his services satisfactorily and we wish him all the best in his future endeavours." },

    // ── Signatory Defaults ──
    defaultSignatoryName: { type: String, default: "Govind Raj" },
    defaultSignatoryRole: { type: String, default: "Human Resources" },
    defaultSignatoryImageUrl: { type: String, required: false },
    defaultStampImageUrl: { type: String, required: false },

    // ── Version ──
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const LetterSettingsModel = mongoose.model("LetterSettings", letterSettingsSchema);
