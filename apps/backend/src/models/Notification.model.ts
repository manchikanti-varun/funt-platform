import mongoose, { Schema } from "mongoose";

/**
 * In-app notification document.
 */
const notificationSchema = new Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 1000 },
    type: {
      type: String,
      required: true,
      enum: [
        "LEAVE_APPLIED",
        "LEAVE_APPROVED",
        "LEAVE_REJECTED",
        "LEAVE_CANCELLED",
        "LEAVE_PENDING_REVIEW",
        "MILESTONE_UNLOCKED",
        "MILESTONE_COMPLETED",
        "MILESTONE_PAYMENT_DUE",
        "MILESTONE_OVERDUE",
        "GENERAL",
      ],
      default: "GENERAL",
    },
    referenceId: { type: String, required: false },   // leave request id etc.
    read: { type: Boolean, required: true, default: false },
    readAt: { type: Date, required: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const NotificationModel = mongoose.model("Notification", notificationSchema);
