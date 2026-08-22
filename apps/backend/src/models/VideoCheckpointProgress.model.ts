import mongoose, { Schema } from "mongoose";

/**
 * VideoCheckpointProgress — per-student progress for video checkpoints.
 *
 * One document per student+module combination. Tracks which checkpoints
 * have been completed, attempts, streaks, and XP earned.
 */

const checkpointEntrySchema = new Schema(
  {
    checkpointId: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, required: true, default: false },
    /** True if completed on first attempt (for bonus XP) */
    firstAttemptCorrect: { type: Boolean, required: false, default: false },
    completedAt: { type: Date, required: false },
  },
  { _id: false }
);

const videoCheckpointProgressSchema = new Schema(
  {
    userId: { type: String, required: true },
    moduleId: { type: String, required: true },

    checkpoints: { type: [checkpointEntrySchema], required: true, default: [] },

    /** Last known video position (seconds) — for resume */
    lastPosition: { type: Number, required: false, default: 0 },

    /** Current streak of consecutive correct answers */
    currentStreak: { type: Number, required: false, default: 0 },

    /** Best streak achieved in this module */
    bestStreak: { type: Number, required: false, default: 0 },

    /** Total XP earned from checkpoints in this module */
    totalXpEarned: { type: Number, required: false, default: 0 },
  },
  { timestamps: true }
);

// One progress doc per user+module
videoCheckpointProgressSchema.index({ userId: 1, moduleId: 1 }, { unique: true });

export const VideoCheckpointProgressModel = mongoose.model(
  "VideoCheckpointProgress",
  videoCheckpointProgressSchema
);
