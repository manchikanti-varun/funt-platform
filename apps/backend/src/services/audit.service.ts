
import mongoose, { type ClientSession } from "mongoose";
import { AuditLogModel } from "../models/AuditLog.model.js";
import { UserModel } from "../models/User.model.js";
import { CertificateModel } from "../models/Certificate.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { CourseModel } from "../models/Course.model.js";
import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { GlobalModuleModel } from "../models/GlobalModule.model.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.model.js";

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function isMongoId(s: string): boolean {
  return typeof s === "string" && s.length === 24 && OBJECT_ID_REGEX.test(s) && mongoose.Types.ObjectId.isValid(s);
}

export type AuditAction =
  | "USER_CREATED"
  | "USER_SUSPENDED"
  | "USER_ARCHIVED"
  | "USER_ACTIVATED"
  | "USER_ROLE_CHANGED"
  | "USER_PASSWORD_RESET"
  | "USER_USERNAME_CHANGED"
  | "USER_LOGIN_SUCCESS"
  | "USER_LOGIN_FAILED"
  | "USER_SIGNUP"
  | "USER_GOOGLE_SIGNUP"
  | "MODULE_CREATED"
  | "MODULE_UPDATED"
  | "MODULE_ARCHIVED"
  | "MODULE_UNARCHIVED"
  | "MODULE_DELETED"
  | "MODULE_DUPLICATED"
  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_UPDATED"
  | "ASSIGNMENT_ARCHIVED"
  | "ASSIGNMENT_UNARCHIVED"
  | "ASSIGNMENT_DELETED"
  | "ASSIGNMENT_DUPLICATED"
  | "COURSE_CREATED"
  | "COURSE_DUPLICATED"
  | "COURSE_UPDATED"
  | "COURSE_ARCHIVED"
  | "COURSE_UNARCHIVED"
  | "COURSE_STATUS_CHANGED"
  | "COURSE_DELETED"
  | "BATCH_CREATED"
  | "BATCH_DUPLICATED"
  | "BATCH_UPDATED"
  | "BATCH_ARCHIVED"
  | "BATCH_UNARCHIVED"
  | "BATCH_DELETED"
  | "TRAINER_ASSIGNED"
  | "ENROLLMENT_CREATED"
  | "ENROLLMENT_REMOVED"
  | "ASSIGNMENT_SUBMITTED"
  | "ASSIGNMENT_APPROVED"
  | "ASSIGNMENT_REJECTED"
  | "PROGRESS_OVERRIDE"
  | "ATTENDANCE_MARKED"
  | "GENERAL_ATTENDANCE_CREATED"
  | "CERTIFICATE_GENERATED"
  | "CERTIFICATE_COIN_REWARD_SET"
  | "CERTIFICATE_COINS_GRANTED"
  | "SHOP_PRODUCT_CREATED"
  | "SHOP_PRODUCT_UPDATED"
  | "SHOP_PRODUCT_DELETED"
  | "SHOP_PURCHASE"
  | "BADGE_AWARDED"
  | "SKILL_RECALCULATED"
  | "VERIFY_ACCESSED"
  | "PAYMENT_UPI_UPDATED"
  | "PAYMENT_UPI_CHANGE_REQUESTED"
  | "PAYMENT_UPI_CHANGE_APPROVED"
  | "PAYMENT_UPI_CHANGE_REJECTED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "INVOICE_ISSUED"
  | "INVOICE_MANUAL_ISSUED"
  | "CONTENT_PROTECTION_UPDATED"
  | "CONTENT_PROTECTION_COPY_BLOCKED"
  | "CONTENT_PROTECTION_DEVTOOLS_DETECTED"
  | "CONTENT_PROTECTION_SCREEN_SHARE_DETECTED"
  | "CONTENT_PROTECTION_SCREEN_RECORDING_DETECTED"
  | "CONTENT_PROTECTION_SHORTCUT_BLOCKED"
  | "CONTENT_PROTECTION_RIGHT_CLICK_BLOCKED"
  | "LEAVE_APPLIED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_CANCELLED"
  | "LEAVE_UPDATED"
  | "LEAVE_POLICY_UPDATED"
  | "TICKET_CREATED"
  | "TICKET_ASSIGNED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_PRIORITY_CHANGED"
  | "TICKET_ESCALATED"
  | "TICKET_RESOLVED"
  | "TICKET_CLOSED"
  | "TICKET_REOPENED"
  | "TICKET_REPLIED"
  | "LEARNING_PLAN_CONFIGURED"
  | "MILESTONE_CREATED"
  | "MILESTONE_UPDATED"
  | "MILESTONE_DELETED"
  | "MILESTONE_REORDERED"
  | "MILESTONE_UNLOCKED"
  | "MILESTONE_LOCKED"
  | "MILESTONE_COMPLETED"
  | "MILESTONE_RESET"
  | "MILESTONE_LICENSE_REDEEMED"
  | "MILESTONE_MANUAL_UNLOCK"
  | "MILESTONE_PAYMENT_UNLOCK"
  | "MILESTONE_SCHOLARSHIP_GRANTED"
  | "MILESTONE_OVERDUE_FLAGGED"
  | "MILESTONE_PAYMENT_DUE_EXTENDED"
  | "EXPORT_CREATED"
  | "EXPORT_DOWNLOADED"
  | "IMPORT_STARTED"
  | "IMPORT_COMPLETED"
  | "RESTORE_STARTED"
  | "RESTORE_COMPLETED"
  | "COUPON_REDEEMED"
  | "LICENSE_KEY_REDEEMED"
  | "PAYMENT_PROMISE_REQUESTED"
  | "PAYMENT_PROMISE_APPROVED"
  | "PAYMENT_PROMISE_REJECTED"
  | "PAYMENT_PROMISE_PAID"
  | "PAYMENT_PROMISE_OVERDUE"
  | "PAYMENT_PROMISE_SUSPENDED"
  | "PAYMENT_PROMISE_CANCELLED"
  | "PAYMENT_PROMISE_DUE_DATE_CHANGED"
  | "PAYMENT_PROMISE_REACTIVATED"
  | "FRANCHISE_CENTER_CREATED"
  | "FRANCHISE_CENTER_UPDATED"
  | "FRANCHISE_CENTER_DELETED"
  | "FRANCHISE_BATCH_CREATED"
  | "FRANCHISE_PAYOUT_CREATED"
  | "FRANCHISE_TRAINER_CREATED"
  | "BATCH_TRANSFER"
  | "LETTER_ISSUED"
  | "LETTER_REVOKED"
  | "LETTER_CREATED_DRAFT"
  | "LETTER_SUBMITTED_FOR_APPROVAL"
  | "LETTER_APPROVED"
  | "LETTER_APPROVAL_REJECTED"
  | "LETTER_ACCEPTED_BY_INTERN"
  | "LETTER_REJECTED_BY_INTERN"
  | "LETTER_WITHDRAWN"
  | "LETTER_UPDATED"
  | "LETTER_VERIFY_ACCESSED"
  | "LETTER_DELETED"
  | "USER_DELETED"
  | "DEVICE_CHANGE_APPROVED"
  | "DEVICE_CHANGE_REJECTED"
  | "ACCOUNT_MARKED_INACTIVE"
  | "ACCOUNT_REACTIVATED";

export async function createAuditLog(
  action: AuditAction,
  performedBy: string,
  targetEntity: string,
  targetId: string,
  meta?: Record<string, unknown>,
  session?: ClientSession
): Promise<void> {
  // Pre-compute display labels so listAuditLogs doesn't need to look them up
  let performedByDisplay: string | undefined;
  let targetIdDisplay: string | undefined;

  try {
    if (isMongoId(performedBy)) {
      const user = await UserModel.findById(performedBy).select("username").lean().exec();
      performedByDisplay = (user as { username?: string } | null)?.username ?? undefined;
    } else {
      performedByDisplay = performedBy; // e.g. "public", "system"
    }
  } catch {
    // Non-critical — proceed without display name
  }

  try {
    if (meta && typeof (meta as { username?: string }).username === "string") {
      targetIdDisplay = (meta as { username: string }).username;
    } else if (meta && typeof (meta as { ticketNumber?: string }).ticketNumber === "string") {
      targetIdDisplay = (meta as { ticketNumber: string }).ticketNumber;
    }
  } catch {
    // Non-critical
  }

  await AuditLogModel.create(
    [
      {
        action,
        performedBy,
        performedByDisplay,
        targetEntity,
        targetId,
        targetIdDisplay,
        timestamp: new Date(),
        ...(meta ? { meta } : {}),
      },
    ],
    session ? { session } : undefined
  );
}

export interface ListAuditLogsFilters {
  action?: string;
  performedBy?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByDisplay: string;
  targetEntity: string;
  targetId: string;
  targetIdDisplay: string;
  timestamp: Date;
  meta?: unknown;
}

export async function listAuditLogs(
  filters: ListAuditLogsFilters,
  page: number,
  limit: number
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filters.action) query.action = filters.action;
  let performedByFilter = filters.performedBy;
  if (performedByFilter?.trim()) {
    if (!isMongoId(performedByFilter)) {
      const user = await UserModel.findOne({ username: performedByFilter.trim().toLowerCase() })
        .select("_id")
        .lean()
        .exec();
      if (user) performedByFilter = String((user as { _id: unknown })._id);
    }
    query.performedBy = performedByFilter;
  }
  if (filters.fromDate || filters.toDate) {
    query.timestamp = {};
    if (filters.fromDate) (query.timestamp as Record<string, Date>).$gte = filters.fromDate;
    if (filters.toDate) (query.timestamp as Record<string, Date>).$lte = filters.toDate;
  }
  const [logs, total] = await Promise.all([
    AuditLogModel.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    AuditLogModel.countDocuments(query).exec(),
  ]);

  // Separate logs that need lookups (legacy: missing pre-computed labels) from those that don't
  const needsPerformerLookup: string[] = [];
  const needsTargetLookup: Array<{ entity: string; targetId: string }> = [];

  for (const d of logs) {
    const doc = d as { performedByDisplay?: string; targetIdDisplay?: string; performedBy: string; targetEntity: string; targetId: string };
    if (!doc.performedByDisplay && isMongoId(doc.performedBy)) {
      needsPerformerLookup.push(doc.performedBy);
    }
    if (!doc.targetIdDisplay) {
      needsTargetLookup.push({ entity: doc.targetEntity, targetId: doc.targetId });
    }
  }

  // Only do legacy lookups if there are records missing pre-computed labels
  const userMap = new Map<string, string>();
  const uniquePerformerIds = [...new Set(needsPerformerLookup)];
  if (uniquePerformerIds.length > 0) {
    const users = await UserModel.find({ _id: { $in: uniquePerformerIds } }).select("_id username").lean().exec();
    for (const u of users) {
      const id = String((u as { _id: unknown })._id);
      const username = (u as { username?: string }).username;
      if (username) userMap.set(id, username);
    }
  }

  // Group target lookups by entity type — only for records missing targetIdDisplay
  const targetDisplayMap = new Map<string, string>();
  const entitiesNeedingLookup = new Set(needsTargetLookup.map((t) => t.entity));

  if (entitiesNeedingLookup.has("Certificate")) {
    const ids = needsTargetLookup.filter((t) => t.entity === "Certificate").map((t) => t.targetId);
    const certMongoIds = ids.filter(isMongoId);
    const certHumanIds = ids.filter((id) => !isMongoId(id));
    if (ids.length > 0) {
      const certs = await CertificateModel.find({
        $or: [
          ...(certMongoIds.length > 0 ? [{ _id: { $in: certMongoIds } }] : []),
          ...(certHumanIds.length > 0 ? [{ certificateId: { $in: certHumanIds } }] : []),
        ],
      }).select("_id certificateId").lean().exec();
      for (const c of certs) {
        const mongoId = String((c as { _id: unknown })._id);
        const humanId = String((c as { certificateId?: string }).certificateId ?? "").trim();
        if (humanId) { targetDisplayMap.set(`Certificate:${mongoId}`, humanId); targetDisplayMap.set(`Certificate:${humanId}`, humanId); }
      }
    }
  }

  if (entitiesNeedingLookup.has("Batch")) {
    const ids = needsTargetLookup.filter((t) => t.entity === "Batch").map((t) => t.targetId);
    if (ids.length > 0) {
      const batches = await BatchModel.find({ _id: { $in: ids } }).select("_id name batchId").lean().exec();
      for (const b of batches) {
        const id = String((b as { _id: unknown })._id);
        const name = ((b as { name?: string }).name ?? "").trim();
        const code = ((b as { batchId?: string }).batchId ?? "").trim();
        targetDisplayMap.set(`Batch:${id}`, name && code ? `${name} (${code})` : name || code || id);
      }
    }
  }

  if (entitiesNeedingLookup.has("Course")) {
    const ids = needsTargetLookup.filter((t) => t.entity === "Course").map((t) => t.targetId);
    if (ids.length > 0) {
      const courses = await CourseModel.find({ _id: { $in: ids } }).select("_id courseId title").lean().exec();
      for (const c of courses) {
        const id = String((c as { _id: unknown })._id);
        const title = ((c as { title?: string }).title ?? "").trim();
        const cid = ((c as { courseId?: string }).courseId ?? "").trim();
        targetDisplayMap.set(`Course:${id}`, title && cid ? `${title} (${cid})` : title || cid || id);
      }
    }
  }

  if (entitiesNeedingLookup.has("GlobalAssignment")) {
    const ids = needsTargetLookup.filter((t) => t.entity === "GlobalAssignment").map((t) => t.targetId);
    if (ids.length > 0) {
      const assignments = await GlobalAssignmentModel.find({ _id: { $in: ids } }).select("_id assignmentId").lean().exec();
      for (const a of assignments) { const aid = (a as { assignmentId?: string }).assignmentId; if (aid) targetDisplayMap.set(`GlobalAssignment:${String((a as { _id: unknown })._id)}`, aid); }
    }
  }

  if (entitiesNeedingLookup.has("GlobalModule")) {
    const ids = needsTargetLookup.filter((t) => t.entity === "GlobalModule").map((t) => t.targetId);
    if (ids.length > 0) {
      const modules = await GlobalModuleModel.find({ _id: { $in: ids } }).select("_id moduleId").lean().exec();
      for (const m of modules) { const mid = (m as { moduleId?: string }).moduleId; if (mid) targetDisplayMap.set(`GlobalModule:${String((m as { _id: unknown })._id)}`, mid); }
    }
  }

  if (entitiesNeedingLookup.has("AssignmentSubmission")) {
    const ids = needsTargetLookup.filter((t) => t.entity === "AssignmentSubmission").map((t) => t.targetId);
    if (ids.length > 0) {
      const submissions = await AssignmentSubmissionModel.find({ _id: { $in: ids } }).select("_id submissionId").lean().exec();
      for (const s of submissions) { const sid = (s as { submissionId?: string }).submissionId; if (sid) targetDisplayMap.set(`AssignmentSubmission:${String((s as { _id: unknown })._id)}`, sid); }
    }
  }

  return {
    logs: logs.map((d) => {
      const doc = d as { performedByDisplay?: string; targetIdDisplay?: string; performedBy: string; targetEntity: string; targetId: string };
      const performerDisplay = doc.performedByDisplay ?? userMap.get(doc.performedBy) ?? doc.performedBy;
      const targetDisplay = doc.targetIdDisplay ?? targetDisplayMap.get(`${doc.targetEntity}:${doc.targetId}`) ?? doc.targetId;
      return {
        id: String(d._id),
        action: d.action,
        performedBy: d.performedBy,
        performedByDisplay: performerDisplay,
        targetEntity: d.targetEntity,
        targetId: d.targetId,
        targetIdDisplay: targetDisplay,
        timestamp: d.timestamp,
        meta: d.meta,
      };
    }),
    total,
  };
}
