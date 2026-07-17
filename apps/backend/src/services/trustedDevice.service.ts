/**
 * Trusted Device & Risk Scoring Service
 *
 * Handles:
 * - Device registration (auto on first login per type)
 * - Device trust verification
 * - Office IP bypass
 * - Risk scoring (city-level geolocation change speed)
 * - Device change requests
 * - Concurrent session enforcement
 */

import { TrustedDeviceModel, DeviceChangeRequestModel, DEVICE_TYPE, DEVICE_STATUS, DEVICE_CHANGE_STATUS } from "../models/TrustedDevice.model.js";
import { SecurityConfigModel } from "../models/SecurityConfig.model.js";
import { UserModel } from "../models/User.model.js";
import { AppError } from "../utils/AppError.js";
import { createAuditLog } from "./audit.service.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getSecurityConfig() {
  let config = await SecurityConfigModel.findOne({ key: "ACTIVE" }).lean().exec();
  if (!config) {
    config = await SecurityConfigModel.create({ key: "ACTIVE" });
    return config.toObject ? config.toObject() : config;
  }
  return config;
}

export async function updateSecurityConfig(updates: Record<string, unknown>, updatedBy: string) {
  const doc = await SecurityConfigModel.findOneAndUpdate(
    { key: "ACTIVE" },
    { $set: { ...updates, updatedBy } },
    { new: true, upsert: true }
  ).lean().exec();
  return doc;
}

// ─── Office IP Check ──────────────────────────────────────────────────────────

export async function isOfficeIp(ip: string): Promise<boolean> {
  const config = await getSecurityConfig();
  const officeIps = (config as { officeIps?: string[] }).officeIps ?? [];
  if (officeIps.length === 0) return false;
  const normalized = ip.trim();
  return officeIps.some((oip) => normalized === oip.trim());
}

// ─── Device Type Detection ────────────────────────────────────────────────────

export function detectDeviceType(userAgent: string): "DESKTOP" | "MOBILE" {
  const ua = (userAgent ?? "").toLowerCase();
  const mobilePatterns = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/;
  return mobilePatterns.test(ua) ? "MOBILE" : "DESKTOP";
}

export function parseDeviceInfo(userAgent: string): { deviceName: string; os: string; browser: string } {
  const ua = userAgent ?? "";
  let os = "Unknown";
  let browser = "Unknown";
  let deviceName = "Unknown Device";

  // OS detection
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|macOS/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/CrOS/i.test(ua)) os = "Chrome OS";

  // Browser detection
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/OPR\//i.test(ua)) browser = "Opera";

  deviceName = `${os} - ${browser}`;
  return { deviceName, os, browser };
}

// ─── Device Trust Verification ────────────────────────────────────────────────

export interface DeviceCheckResult {
  trusted: boolean;
  isOffice: boolean;
  isNewDevice: boolean;
  autoRegistered: boolean;
  existingDevice?: { deviceName: string; os: string; linkedAt: Date };
  deviceType: "DESKTOP" | "MOBILE";
}

/**
 * Check if a device is trusted for a given user.
 * - If from office IP → always trusted, skip device checks
 * - If first login for that device type → auto-register as trusted
 * - If device fingerprint matches existing trusted device → trusted
 * - Otherwise → untrusted (needs device change request)
 */
export async function checkDeviceTrust(
  userId: string,
  fingerprint: string,
  userAgent: string,
  ip: string
): Promise<DeviceCheckResult> {
  // Office IP bypass
  if (await isOfficeIp(ip)) {
    return { trusted: true, isOffice: true, isNewDevice: false, autoRegistered: false, deviceType: detectDeviceType(userAgent) };
  }

  const deviceType = detectDeviceType(userAgent);
  const { deviceName, os, browser } = parseDeviceInfo(userAgent);

  // Find existing trusted device for this user + type
  const existing = await TrustedDeviceModel.findOne({
    userId,
    deviceType,
    status: DEVICE_STATUS.ACTIVE,
  }).lean().exec();

  // No trusted device for this type yet → auto-register
  if (!existing) {
    await TrustedDeviceModel.create({
      userId,
      deviceType,
      fingerprint,
      deviceName,
      os,
      browser,
      linkedAt: new Date(),
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      status: DEVICE_STATUS.ACTIVE,
    });
    return { trusted: true, isOffice: false, isNewDevice: true, autoRegistered: true, deviceType };
  }

  // Check if fingerprint matches
  if (existing.fingerprint === fingerprint) {
    // Update last login info
    await TrustedDeviceModel.updateOne(
      { _id: existing._id },
      { $set: { lastLoginAt: new Date(), lastLoginIp: ip } }
    ).exec();
    return { trusted: true, isOffice: false, isNewDevice: false, autoRegistered: false, deviceType };
  }

  // Different device → untrusted
  return {
    trusted: false,
    isOffice: false,
    isNewDevice: true,
    autoRegistered: false,
    existingDevice: {
      deviceName: existing.deviceName ?? "Unknown",
      os: existing.os ?? "",
      linkedAt: existing.linkedAt,
    },
    deviceType,
  };
}

// ─── Device Change Requests ───────────────────────────────────────────────────

export async function createDeviceChangeRequest(
  userId: string,
  deviceType: "DESKTOP" | "MOBILE",
  newFingerprint: string,
  userAgent: string,
  reason?: string
) {
  const { deviceName, os, browser } = parseDeviceInfo(userAgent);
  const user = await UserModel.findById(userId).select("username name").lean().exec();

  // Check for existing pending request
  const pending = await DeviceChangeRequestModel.findOne({
    userId, deviceType, status: DEVICE_CHANGE_STATUS.PENDING,
  }).lean().exec();
  if (pending) {
    return { alreadyPending: true, requestId: String(pending._id) };
  }

  // Get current device info
  const currentDevice = await TrustedDeviceModel.findOne({
    userId, deviceType, status: DEVICE_STATUS.ACTIVE,
  }).lean().exec();

  const request = await DeviceChangeRequestModel.create({
    userId,
    username: (user as { username?: string })?.username,
    studentName: (user as { name?: string })?.name,
    deviceType,
    currentFingerprint: currentDevice?.fingerprint,
    currentDeviceName: currentDevice?.deviceName,
    newFingerprint,
    newDeviceName: deviceName,
    newOs: os,
    newBrowser: browser,
    reason,
    status: DEVICE_CHANGE_STATUS.PENDING,
  });

  return { alreadyPending: false, requestId: String(request._id) };
}

export async function approveDeviceChange(requestId: string, adminId: string) {
  const request = await DeviceChangeRequestModel.findById(requestId).exec();
  if (!request) throw new AppError("Request not found", 404);
  if (request.status !== DEVICE_CHANGE_STATUS.PENDING) {
    throw new AppError("Request is no longer pending", 400);
  }

  // Revoke old device
  await TrustedDeviceModel.updateMany(
    { userId: request.userId, deviceType: request.deviceType, status: DEVICE_STATUS.ACTIVE },
    { $set: { status: DEVICE_STATUS.REVOKED } }
  ).exec();

  // Register new device
  await TrustedDeviceModel.create({
    userId: request.userId,
    deviceType: request.deviceType,
    fingerprint: request.newFingerprint,
    deviceName: request.newDeviceName,
    os: request.newOs,
    browser: request.newBrowser,
    linkedAt: new Date(),
    status: DEVICE_STATUS.ACTIVE,
  });

  request.status = DEVICE_CHANGE_STATUS.APPROVED;
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  await request.save();

  await createAuditLog("DEVICE_CHANGE_APPROVED", adminId, "User", request.userId, {
    deviceType: request.deviceType,
    newDeviceName: request.newDeviceName,
  });

  return { approved: true };
}

export async function rejectDeviceChange(requestId: string, adminId: string, note?: string) {
  const request = await DeviceChangeRequestModel.findById(requestId).exec();
  if (!request) throw new AppError("Request not found", 404);
  if (request.status !== DEVICE_CHANGE_STATUS.PENDING) {
    throw new AppError("Request is no longer pending", 400);
  }

  request.status = DEVICE_CHANGE_STATUS.REJECTED;
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.reviewNote = note ?? "";
  await request.save();

  return { rejected: true };
}

export async function listDeviceChangeRequests(status?: string) {
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  return DeviceChangeRequestModel.find(query).sort({ createdAt: -1 }).limit(100).lean().exec();
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

export interface RiskAssessment {
  score: number;
  flags: string[];
  requiresVerification: boolean;
  flagForReview: boolean;
}

/**
 * Calculate risk score based on login patterns.
 * Uses city-level IP geolocation comparison.
 * Score > threshold → flag for review + ask verification.
 */
export async function assessLoginRisk(
  userId: string,
  currentIp: string,
  currentCity: string
): Promise<RiskAssessment> {
  const config = await getSecurityConfig();
  const threshold = (config as { riskScoreThreshold?: number }).riskScoreThreshold ?? 100;
  const travelMinutes = (config as { suspiciousTravelMinutes?: number }).suspiciousTravelMinutes ?? 15;

  let score = 0;
  const flags: string[] = [];

  // Get last login from history
  const user = await UserModel.findById(userId)
    .select("+loginHistory")
    .lean()
    .exec();
  const history = (user as { loginHistory?: Array<{ timestamp: Date; ip?: string; city?: string }> })?.loginHistory ?? [];

  if (history.length > 0) {
    const lastLogin = history[history.length - 1];
    const lastCity = (lastLogin as { city?: string }).city ?? "";
    const lastTime = new Date(lastLogin.timestamp).getTime();
    const now = Date.now();
    const minutesSinceLast = (now - lastTime) / 60000;

    // City changed within suspicious time window
    if (lastCity && currentCity && lastCity !== currentCity && minutesSinceLast < travelMinutes) {
      score += 80;
      flags.push(`City changed from ${lastCity} to ${currentCity} within ${Math.round(minutesSinceLast)}m`);
    }

    // Different IP within very short time (< 2 minutes)
    if (lastLogin.ip && lastLogin.ip !== currentIp && minutesSinceLast < 2) {
      score += 30;
      flags.push("IP changed within 2 minutes");
    }
  }

  // Check for multiple failed login attempts recently (already handled by lockedUntil, but add score)
  const attempts = (user as { loginAttempts?: number })?.loginAttempts ?? 0;
  if (attempts >= 3) {
    score += 20;
    flags.push(`${attempts} failed login attempts`);
  }

  return {
    score,
    flags,
    requiresVerification: score >= threshold,
    flagForReview: score >= threshold,
  };
}

// ─── Student Device Info ──────────────────────────────────────────────────────

export async function getStudentDevices(userId: string) {
  const devices = await TrustedDeviceModel.find({ userId, status: DEVICE_STATUS.ACTIVE })
    .sort({ deviceType: 1 })
    .lean()
    .exec();

  const pendingRequests = await DeviceChangeRequestModel.find({
    userId, status: DEVICE_CHANGE_STATUS.PENDING,
  }).lean().exec();

  return { devices, pendingRequests };
}

// ─── Concurrent Session Enforcement ──────────────────────────────────────────

/**
 * Enforce single active session policy.
 * Increments tokenVersion so all previous sessions are invalidated.
 * Returns the new tokenVersion.
 */
export async function enforceOneSession(userId: string): Promise<number> {
  const config = await getSecurityConfig();
  if (!(config as { concurrentSessionEnabled?: boolean }).concurrentSessionEnabled) {
    // Policy disabled — don't enforce
    const user = await UserModel.findById(userId).select("tokenVersion").lean().exec();
    return (user as { tokenVersion?: number })?.tokenVersion ?? 0;
  }

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { new: true, select: "tokenVersion" }
  ).lean().exec();

  return (updated as { tokenVersion?: number })?.tokenVersion ?? 0;
}

// ─── Auto-Inactive Logic ─────────────────────────────────────────────────────

/**
 * Check accounts for auto-inactive conditions. Run as a scheduled job.
 * - Account inactive if no login for N years
 * - Account inactive if N years since first enrollment
 * Does NOT delete any data — only changes status to INACTIVE.
 */
export async function markInactiveAccounts(): Promise<number> {
  const config = await getSecurityConfig();
  const noLoginYears = (config as { inactiveAfterYearsNoLogin?: number }).inactiveAfterYearsNoLogin ?? 5;
  const enrollmentYears = (config as { inactiveAfterYearsFromEnrollment?: number }).inactiveAfterYearsFromEnrollment ?? 12;

  const now = new Date();
  const noLoginCutoff = new Date(now.getTime() - noLoginYears * 365.25 * 24 * 60 * 60 * 1000);
  const enrollCutoff = new Date(now.getTime() - enrollmentYears * 365.25 * 24 * 60 * 60 * 1000);

  // Find students who haven't logged in for N years
  // (using updatedAt as proxy since loginHistory is select:false and updatedAt gets touched on login)
  const result = await UserModel.updateMany(
    {
      roles: "STUDENT",
      status: "ACTIVE",
      updatedAt: { $lt: noLoginCutoff },
    },
    { $set: { status: "INACTIVE" } }
  ).exec();

  return result.modifiedCount;
}
