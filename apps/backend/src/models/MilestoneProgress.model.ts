/**
 * MilestoneProgress — one document per student per milestone per batch.
 *
 * Stores:
 *   - Access state (unlocked / locked)
 *   - Unlock source (PAYMENT | LICENSE_KEY | MANUAL | FREE | DATE_AUTO)
 *   - Payment / license key references
 *   - Completion cache (derived from ChapterProgress, stored here to avoid
 *     expensive re-aggregation on every page load)
 *   - Eligibility for the next milestone
 *   - Payment due tracking (OVERDUE detection)
 *
 * This collection does NOT duplicate progress logic.
 * completionPct / completedChapters are updated by the milestone service
 * after each chapter completion event, reading from ChapterProgress.
 */

import mongoose, { Schema } from "mongoose";
import {
  MILESTONE_UNLOCK_SOURCE,
  MILESTONE_PAYMENT_STATUS,
} from "@funt-platform/constants";

const milestoneProgressSchema = new Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────
    studentId:       { type: String, required: true },
    batchId:         { type: String, required: true },
    courseId:        { type: String, required: true },  // courseId in snapshot
    milestoneId:     { type: String, required: true },  // stable UUID, never reordered

    // Snapshot fields for display (avoids joins on every read)
    milestoneOrder:  { type: Number, required: true },  // display order at unlock time
    milestoneTitle:  { type: String, required: true },

    // ── Access state ─────────────────────────────────────────────────────
    unlocked:        { type: Boolean, required: true, default: false },
    unlockedAt:      { type: Date,    required: false },
    unlockSource:    {
      type: String,
      required: false,
      enum: Object.values(MILESTONE_UNLOCK_SOURCE),
    },
    unlockedBy:      { type: String, required: false },  // userId for MANUAL; "system" for auto

    // Admin can hard-lock a previously unlocked milestone
    locked:          { type: Boolean, required: true, default: false },
    lockedAt:        { type: Date,    required: false },
    lockedBy:        { type: String,  required: false },

    // ── Payment state ─────────────────────────────────────────────────────
    paymentId:       { type: String, required: false },  // ref PaymentSubmission._id
    paidAt:          { type: Date,   required: false },

    // Payment due tracking
    paymentDueAt:    { type: Date,   required: false },  // computed from paymentDueInDays
    paymentStatus:   {
      type: String,
      required: false,
      enum: Object.values(MILESTONE_PAYMENT_STATUS),
      default: MILESTONE_PAYMENT_STATUS.ACTIVE,
    },

    // ── License key state ─────────────────────────────────────────────────
    licenseKeyId:    { type: String, required: false },
    licenseKeyCode:  { type: String, required: false },  // for audit display

    // ── Scheduled unlock (DATE_BASED / RELATIVE_DATE) ────────────────────
    scheduledUnlockAt: { type: Date, required: false },

    // ── Completion state (cached from ChapterProgress) ───────────────────
    completedChapters: { type: Number, required: true, default: 0 },
    totalChapters:     { type: Number, required: true, default: 0 },
    completionPct:     { type: Number, required: true, default: 0 },  // 0-100
    completed:         { type: Boolean, required: true, default: false },
    completedAt:       { type: Date,    required: false },

    // ── Eligibility ───────────────────────────────────────────────────────
    eligibleForNext:   { type: Boolean, required: true, default: false },
    eligibleAt:        { type: Date,    required: false },

    // Milestone cert issued for this milestone
    milestoneCertificateId: { type: String, required: false },
  },
  { timestamps: true }
);

// Primary lookup: all milestones for a student in a course
milestoneProgressSchema.index(
  { studentId: 1, batchId: 1, courseId: 1, milestoneId: 1 },
  { unique: true }
);
// Admin dashboard: all students in a milestone
milestoneProgressSchema.index({ batchId: 1, milestoneId: 1, unlocked: 1 });
// Analytics: students eligible but not paid
milestoneProgressSchema.index({ eligibleForNext: 1, completed: 1, unlocked: 1 });
// Overdue detection
milestoneProgressSchema.index({ paymentDueAt: 1, paymentStatus: 1 });
// Scheduled unlock processing
milestoneProgressSchema.index({ scheduledUnlockAt: 1, unlocked: 1 });

export const MilestoneProgressModel = mongoose.model(
  "MilestoneProgress",
  milestoneProgressSchema
);
