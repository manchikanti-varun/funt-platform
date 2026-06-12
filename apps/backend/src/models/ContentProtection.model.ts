/**
 * ContentProtection — singleton settings document.
 *
 * One document with key="ACTIVE" holds the global protection policy.
 * Course and batch level overrides are stored directly on their respective
 * documents (see Course.model.ts and Batch.model.ts patches).
 *
 * Watermark config (opacity, fontSize, rotation, refreshInterval) lives
 * here because it is global-only — per-course/batch watermark content is
 * derived dynamically from the student's identity.
 */

import mongoose, { Schema } from "mongoose";

const contentProtectionPolicySchema = new Schema(
  {
    disableRightClick: { type: Boolean, default: true },
    disableKeyboardShortcuts: { type: Boolean, default: true },
    disableTextSelection: { type: Boolean, default: true },
    enableWatermark: { type: Boolean, default: true },
    screenshotProtection: { type: Boolean, default: true },
    screenRecordingProtection: { type: Boolean, default: false },
    screenShareProtection: { type: Boolean, default: false },
    devToolsProtection: { type: Boolean, default: true },
  },
  { _id: false }
);

const contentProtectionSchema = new Schema(
  {
    /** Singleton key — always "ACTIVE". */
    key: { type: String, required: true, unique: true, default: "ACTIVE" },

    /** LMS (student portal) global policy. */
    lmsProtection: { type: contentProtectionPolicySchema, default: () => ({}) },

    /** Admin portal global policy. */
    adminProtection: { type: contentProtectionPolicySchema, default: () => ({}) },

    /** Watermark visual settings. */
    watermark: {
      opacity: { type: Number, default: 0.12, min: 0.02, max: 0.5 },
      fontSize: { type: Number, default: 14, min: 8, max: 32 },
      rotation: { type: Number, default: -30, min: -90, max: 90 },
      /** How often the watermark shifts position, in seconds. */
      refreshIntervalSeconds: { type: Number, default: 8, min: 1, max: 120 },
    },

    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const ContentProtectionModel = mongoose.model("ContentProtection", contentProtectionSchema);
