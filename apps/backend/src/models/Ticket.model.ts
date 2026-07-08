import mongoose, { Schema } from "mongoose";
import { TICKET_CATEGORY, TICKET_PRIORITY, TICKET_STATUS, ROLE } from "@funt-platform/constants";

const ticketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },  // TKT-2026-000001

    createdBy: { type: String, required: true },         // userId
    createdByRole: {
      type: String,
      required: true,
      enum: [ROLE.STUDENT, ROLE.PARENT, ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUPPORT_AGENT],
    },
    /** For parent tickets — the linked student userId */
    studentId: { type: String, required: false },

    category: {
      type: String,
      required: true,
      enum: [...Object.values(TICKET_CATEGORY), "CUSTOM"],
    },
    customCategory: { type: String, required: false, maxlength: 100 },

    priority: {
      type: String,
      required: true,
      enum: Object.values(TICKET_PRIORITY),
      default: TICKET_PRIORITY.MEDIUM,
    },

    subject: { type: String, required: true, maxlength: 300 },
    description: { type: String, required: true, maxlength: 10000 },
    attachments: { type: [String], required: false, default: [] },

    status: {
      type: String,
      required: true,
      enum: Object.values(TICKET_STATUS),
      default: TICKET_STATUS.OPEN,
    },

    assignedTo: { type: String, required: false },         // userId of assigned staff
    assignedToRole: { type: String, required: false },

    resolvedBy: { type: String, required: false },
    resolution: { type: String, required: false, maxlength: 5000 },
    resolvedAt: { type: Date, required: false },
    closedAt: { type: Date, required: false },
    escalatedAt: { type: Date, required: false },

    tags: { type: [String], required: false, default: [] },

    /** ISO string of when first staff reply was made — for SLA first response tracking */
    firstResponseAt: { type: Date, required: false },
    /** SLA due date computed from priority at creation */
    slaDueAt: { type: Date, required: false },
    slaBreached: { type: Boolean, required: false, default: false },

    // ── Live Chat fields ──────────────────────────────────────────────
    /** True if this ticket was created via the live chat widget */
    isLiveChat: { type: Boolean, required: false, default: false },
    /** Live chat session status: WAITING → ACTIVE → CLOSED */
    liveChatStatus: {
      type: String,
      required: false,
      enum: ["WAITING", "ACTIVE", "CLOSED", null],
      default: null,
    },
    /** Student rating of the live chat session (1-5 stars) */
    chatRating: { type: Number, required: false, min: 1, max: 5 },
  },
  { timestamps: true }
);

ticketSchema.index({ createdBy: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ ticketNumber: 1 }, { unique: true });
ticketSchema.index({ slaDueAt: 1, slaBreached: 1 });

export const TicketModel = mongoose.model("Ticket", ticketSchema);
