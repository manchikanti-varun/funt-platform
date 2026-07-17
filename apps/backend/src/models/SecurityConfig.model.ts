/**
 * SecurityConfig — singleton settings for platform security.
 *
 * Stores:
 * - Office IP whitelist (bypass trusted device checks)
 * - Risk score thresholds
 * - Auto-inactive rules
 * - Concurrent session policy
 */

import mongoose, { Schema } from "mongoose";

const securityConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "ACTIVE" },

    /** Office public IPs — devices from these IPs bypass trusted device checks. */
    officeIps: { type: [String], required: true, default: [] },

    /** Risk score threshold (0-1000). Accounts exceeding this get flagged. */
    riskScoreThreshold: { type: Number, required: true, default: 100 },

    /** Minutes threshold for suspicious city change (e.g. 15 = flagged if city changes within 15min). */
    suspiciousTravelMinutes: { type: Number, required: true, default: 15 },

    /** Max trusted desktops per student. */
    maxDesktopDevices: { type: Number, required: true, default: 1 },

    /** Max trusted mobiles per student. */
    maxMobileDevices: { type: Number, required: true, default: 1 },

    /** Years of inactivity before auto-inactive. */
    inactiveAfterYearsNoLogin: { type: Number, required: true, default: 5 },

    /** Years after first enrollment for auto-inactive. */
    inactiveAfterYearsFromEnrollment: { type: Number, required: true, default: 12 },

    /** Whether concurrent session enforcement is enabled. */
    concurrentSessionEnabled: { type: Boolean, required: true, default: true },

    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const SecurityConfigModel = mongoose.model("SecurityConfig", securityConfigSchema);
