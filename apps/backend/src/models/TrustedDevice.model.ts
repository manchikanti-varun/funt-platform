/**
 * TrustedDevice model
 *
 * Tracks registered devices for account security.
 * Rules:
 * - Each student can have 1 trusted desktop + 1 trusted mobile
 * - Office Wi-Fi devices bypass trusted device checks
 * - Students cannot change devices themselves — must request via Admin approval
 */

import mongoose, { Schema } from "mongoose";

export const DEVICE_TYPE = {
  DESKTOP: "DESKTOP",
  MOBILE: "MOBILE",
} as const;

export const DEVICE_STATUS = {
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  PENDING_CHANGE: "PENDING_CHANGE",
} as const;

export const DEVICE_CHANGE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

const trustedDeviceSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    deviceType: { type: String, required: true, enum: Object.values(DEVICE_TYPE) },
    fingerprint: { type: String, required: true },
    deviceName: { type: String, required: false, default: "Unknown Device" },
    os: { type: String, required: false, default: "" },
    browser: { type: String, required: false, default: "" },
    linkedAt: { type: Date, required: true, default: Date.now },
    lastLoginAt: { type: Date, required: false },
    lastLoginCity: { type: String, required: false },
    lastLoginIp: { type: String, required: false },
    status: {
      type: String,
      required: true,
      enum: Object.values(DEVICE_STATUS),
      default: DEVICE_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

trustedDeviceSchema.index({ userId: 1, deviceType: 1, status: 1 });
trustedDeviceSchema.index({ fingerprint: 1 });

export const TrustedDeviceModel = mongoose.model("TrustedDevice", trustedDeviceSchema);

// ─── Device Change Request ────────────────────────────────────────────────────

const deviceChangeRequestSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String, required: false },
    studentName: { type: String, required: false },
    deviceType: { type: String, required: true, enum: Object.values(DEVICE_TYPE) },
    currentFingerprint: { type: String, required: false },
    currentDeviceName: { type: String, required: false },
    newFingerprint: { type: String, required: true },
    newDeviceName: { type: String, required: false, default: "Unknown Device" },
    newOs: { type: String, required: false },
    newBrowser: { type: String, required: false },
    reason: { type: String, required: false },
    status: {
      type: String,
      required: true,
      enum: Object.values(DEVICE_CHANGE_STATUS),
      default: DEVICE_CHANGE_STATUS.PENDING,
    },
    reviewedBy: { type: String, required: false },
    reviewedAt: { type: Date, required: false },
    reviewNote: { type: String, required: false },
  },
  { timestamps: true }
);

deviceChangeRequestSchema.index({ status: 1, createdAt: -1 });
deviceChangeRequestSchema.index({ userId: 1, status: 1 });

export const DeviceChangeRequestModel = mongoose.model("DeviceChangeRequest", deviceChangeRequestSchema);
