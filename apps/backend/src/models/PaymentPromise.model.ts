/**
 * PaymentPromise — tracks "pay later" commitments from students/parents.
 *
 * Lifecycle:
 *   PROMISED  → Student requests, awaiting admin approval
 *   ACTIVE    → Admin approved, temporary access granted
 *   PAID      → Payment received (before or after due date)
 *   OVERDUE   → Due date passed without payment, access suspended
 *   SUSPENDED → Admin manually suspended
 *   CANCELLED → Admin or student cancelled before due date
 *   REJECTED  → Admin rejected the request
 */

import mongoose, { Schema } from "mongoose";
import { PAYMENT_PROMISE_STATUS } from "@funt-platform/constants";

const paymentPromiseSchema = new Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────
    promiseId:    { type: String, required: true, unique: true },
    studentId:    { type: String, required: true },
    batchId:      { type: String, required: true },
    courseId:     { type: String, required: true },
    milestoneId:  { type: String, required: true },

    // ── Financial ───────────────────────────────────────────────────────
    amountPaise:  { type: Number, required: true, min: 0 },
    currency:     { type: String, required: true, default: "INR" },

    // ── Status ──────────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_PROMISE_STATUS),
      default: PAYMENT_PROMISE_STATUS.PROMISED,
    },

    // ── Promise details ─────────────────────────────────────────────────
    promiseDate:  { type: Date, required: true },  // date the student promises to pay by
    reason:       { type: String, required: false, maxlength: 500 },

    // ── Timestamps ──────────────────────────────────────────────────────
    requestedAt:  { type: Date, required: true, default: Date.now },
    approvedAt:   { type: Date, required: false },
    approvedBy:   { type: String, required: false },
    rejectedAt:   { type: Date, required: false },
    rejectedBy:   { type: String, required: false },
    rejectionNote:{ type: String, required: false },
    paidAt:       { type: Date, required: false },
    paymentId:    { type: String, required: false },  // ref PaymentSubmission._id
    suspendedAt:  { type: Date, required: false },
    cancelledAt:  { type: Date, required: false },
    cancelledBy:  { type: String, required: false },

    // ── Admin overrides ─────────────────────────────────────────────────
    /** Admin can override the due date at approval time or later */
    adminDueDate: { type: Date, required: false },
    remarks:      { type: String, required: false, maxlength: 1000 },

    // ── Reminder tracking ───────────────────────────────────────────────
    lastReminderSentAt: { type: Date, required: false },
    remindersSent:      { type: Number, required: true, default: 0 },

    // ── Snapshot for display ────────────────────────────────────────────
    milestoneTitle: { type: String, required: false },
    studentName:    { type: String, required: false },
    studentUsername:{ type: String, required: false },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Primary lookup: student's promises for a milestone
paymentPromiseSchema.index(
  { studentId: 1, batchId: 1, courseId: 1, milestoneId: 1, status: 1 }
);
// Admin dashboard: pending approval
paymentPromiseSchema.index({ status: 1, requestedAt: -1 });
// Overdue processing: active promises past due date
paymentPromiseSchema.index({ status: 1, promiseDate: 1 });
// Per-student active count (for max limit enforcement)
paymentPromiseSchema.index({ studentId: 1, status: 1 });

export const PaymentPromiseModel = mongoose.model("PaymentPromise", paymentPromiseSchema);
