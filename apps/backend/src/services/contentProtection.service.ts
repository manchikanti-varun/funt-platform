/**
 * Content Protection service.
 *
 * Manages the global ContentProtection singleton document and provides
 * helpers to merge protection policies in priority order:
 *   batch > course > global
 */

import { ContentProtectionModel } from "../models/ContentProtection.model.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

const SINGLETON_KEY = "ACTIVE";

export interface ContentProtectionPolicy {
  disableRightClick: boolean;
  disableKeyboardShortcuts: boolean;
  disableTextSelection: boolean;
  enableWatermark: boolean;
  screenshotProtection: boolean;
  screenRecordingProtection: boolean;
  screenShareProtection: boolean;
  devToolsProtection: boolean;
}

export interface WatermarkConfig {
  opacity: number;
  fontSize: number;
  rotation: number;
  refreshIntervalSeconds: number;
}

export interface ContentProtectionSettings {
  lmsProtection: ContentProtectionPolicy;
  adminProtection: ContentProtectionPolicy;
  watermark: WatermarkConfig;
  updatedBy: string;
  updatedAt: Date;
}

const DEFAULT_POLICY: ContentProtectionPolicy = {
  disableRightClick: true,
  disableKeyboardShortcuts: true,
  disableTextSelection: true,
  enableWatermark: false,   // off by default — must be explicitly enabled by admin
  screenshotProtection: true,
  screenRecordingProtection: false,
  screenShareProtection: false,
  devToolsProtection: true,
};

const DEFAULT_WATERMARK: WatermarkConfig = {
  opacity: 0.12,
  fontSize: 14,
  rotation: -30,
  refreshIntervalSeconds: 8,
};

/** Get or create the singleton document. */
export async function getContentProtectionSettings(): Promise<ContentProtectionSettings> {
  let doc = await ContentProtectionModel.findOne({ key: SINGLETON_KEY }).lean().exec();
  if (!doc) {
    const created = await ContentProtectionModel.create({ key: SINGLETON_KEY });
    doc = created.toObject();
  }
  const d = doc as {
    lmsProtection?: Partial<ContentProtectionPolicy>;
    adminProtection?: Partial<ContentProtectionPolicy>;
    watermark?: Partial<WatermarkConfig>;
    updatedBy?: string;
    updatedAt?: Date;
  };
  return {
    lmsProtection: { ...DEFAULT_POLICY, ...(d.lmsProtection ?? {}) },
    adminProtection: { ...DEFAULT_POLICY, ...(d.adminProtection ?? {}) },
    watermark: { ...DEFAULT_WATERMARK, ...(d.watermark ?? {}) },
    updatedBy: d.updatedBy ?? "",
    updatedAt: (d as { updatedAt?: Date }).updatedAt ?? new Date(),
  };
}

export interface UpdateContentProtectionInput {
  lmsProtection?: Partial<ContentProtectionPolicy>;
  adminProtection?: Partial<ContentProtectionPolicy>;
  watermark?: Partial<WatermarkConfig>;
}

/** Update the singleton document. Partial — only provided keys are changed. */
export async function updateContentProtectionSettings(
  input: UpdateContentProtectionInput,
  updatedBy: string
): Promise<ContentProtectionSettings> {
  const current = await ContentProtectionModel.findOne({ key: SINGLETON_KEY }).exec();

  const updateFields: Record<string, unknown> = { updatedBy };

  if (input.lmsProtection) {
    const prev = (current?.lmsProtection ?? {}) as Partial<ContentProtectionPolicy>;
    updateFields.lmsProtection = { ...DEFAULT_POLICY, ...prev, ...input.lmsProtection };
  }
  if (input.adminProtection) {
    const prev = (current?.adminProtection ?? {}) as Partial<ContentProtectionPolicy>;
    updateFields.adminProtection = { ...DEFAULT_POLICY, ...prev, ...input.adminProtection };
  }
  if (input.watermark) {
    const prev = (current?.watermark ?? {}) as Partial<WatermarkConfig>;
    updateFields.watermark = { ...DEFAULT_WATERMARK, ...prev, ...input.watermark };
  }

  const doc = await ContentProtectionModel.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $set: updateFields },
    { new: true, upsert: true }
  ).lean().exec();

  await createAuditLog(
    "CONTENT_PROTECTION_UPDATED",
    updatedBy,
    "ContentProtection",
    SINGLETON_KEY,
    { fields: Object.keys(updateFields) }
  );

  const d = doc as {
    lmsProtection?: Partial<ContentProtectionPolicy>;
    adminProtection?: Partial<ContentProtectionPolicy>;
    watermark?: Partial<WatermarkConfig>;
    updatedBy?: string;
    updatedAt?: Date;
  };
  return {
    lmsProtection: { ...DEFAULT_POLICY, ...(d?.lmsProtection ?? {}) },
    adminProtection: { ...DEFAULT_POLICY, ...(d?.adminProtection ?? {}) },
    watermark: { ...DEFAULT_WATERMARK, ...(d?.watermark ?? {}) },
    updatedBy: d?.updatedBy ?? "",
    updatedAt: (d as { updatedAt?: Date })?.updatedAt ?? new Date(),
  };
}

/**
 * Merge a partial course/batch override with the global base policy.
 * Fields not specified in the override fall through to the base.
 */
export function mergeProtectionPolicy(
  base: ContentProtectionPolicy,
  override?: Partial<ContentProtectionPolicy> | null
): ContentProtectionPolicy {
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Resolve the effective protection policy for a given LMS session:
 *   batch override > course override > global LMS policy
 */
export function resolveEffectivePolicy(
  globalLms: ContentProtectionPolicy,
  courseOverride?: Partial<ContentProtectionPolicy> | null,
  batchOverride?: Partial<ContentProtectionPolicy> | null
): ContentProtectionPolicy {
  const withCourse = mergeProtectionPolicy(globalLms, courseOverride);
  return mergeProtectionPolicy(withCourse, batchOverride);
}

/** Log a content-protection security event from the LMS. */
export async function logProtectionEvent(
  action: string,
  studentId: string,
  meta: {
    courseId?: string;
    batchId?: string;
    event?: string;
    ip?: string;
    userAgent?: string;
  }
): Promise<void> {
  // Validate action is a known protection event
  const ALLOWED = new Set([
    "CONTENT_PROTECTION_COPY_BLOCKED",
    "CONTENT_PROTECTION_DEVTOOLS_DETECTED",
    "CONTENT_PROTECTION_SCREEN_SHARE_DETECTED",
    "CONTENT_PROTECTION_SCREEN_RECORDING_DETECTED",
    "CONTENT_PROTECTION_SHORTCUT_BLOCKED",
    "CONTENT_PROTECTION_RIGHT_CLICK_BLOCKED",
  ]);
  if (!ALLOWED.has(action)) {
    throw new AppError("Unknown protection event action", 400);
  }
  await createAuditLog(
    action as Parameters<typeof createAuditLog>[0],
    studentId,
    "ContentProtection",
    studentId,
    meta
  );
}
