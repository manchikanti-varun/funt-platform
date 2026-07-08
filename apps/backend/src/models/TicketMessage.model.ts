import mongoose, { Schema } from "mongoose";
import { ROLE } from "@funt-platform/constants";

const ticketMessageSchema = new Schema(
  {
    ticketId: { type: String, required: true },
    senderId: { type: String, required: true },
    senderRole: {
      type: String,
      required: true,
      enum: [ROLE.STUDENT, ROLE.PARENT, ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUPPORT_AGENT],
    },
    message: { type: String, required: true, maxlength: 10000 },
    attachments: { type: [String], required: false, default: [] },
    /** When true, visible only to staff (TRAINER / ADMIN / SUPER_ADMIN) */
    isInternalNote: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

export const TicketMessageModel = mongoose.model("TicketMessage", ticketMessageSchema);
