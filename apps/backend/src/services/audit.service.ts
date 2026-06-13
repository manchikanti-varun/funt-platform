
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
  | "TICKET_REPLIED";

export async function createAuditLog(
  action: AuditAction,
  performedBy: string,
  targetEntity: string,
  targetId: string,
  meta?: Record<string, unknown>,
  session?: ClientSession
): Promise<void> {
  await AuditLogModel.create(
    [
      {
        action,
        performedBy,
        targetEntity,
        targetId,
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

  const performedByIds = [...new Set(logs.map((d) => d.performedBy).filter(isMongoId))] as string[];
  const userMap = new Map<string, string>();
  if (performedByIds.length > 0) {
    const users = await UserModel.find({ _id: { $in: performedByIds } }).select("_id username").lean().exec();
    for (const u of users) {
      const id = String((u as { _id: unknown })._id);
      const username = (u as { username?: string }).username;
      if (username) userMap.set(id, username);
    }
  }

  const certIds = logs.filter((d) => d.targetEntity === "Certificate").map((d) => String(d.targetId ?? "").trim()).filter(Boolean);
  const certMap = new Map<string, string>();
  if (certIds.length > 0) {
    const certMongoIds = certIds.filter((id) => isMongoId(id));
    const certHumanIds = certIds.filter((id) => !isMongoId(id));
    const certs = await CertificateModel.find({
      $or: [
        ...(certMongoIds.length > 0 ? [{ _id: { $in: certMongoIds } }] : []),
        ...(certHumanIds.length > 0 ? [{ certificateId: { $in: certHumanIds } }] : []),
      ],
    })
      .select("_id certificateId")
      .lean()
      .exec();
    for (const c of certs) {
      const mongoId = String((c as { _id: unknown })._id);
      const humanId = String((c as { certificateId?: string }).certificateId ?? "").trim();
      if (humanId) {
        certMap.set(mongoId, humanId);
        certMap.set(humanId, humanId);
      }
    }
  }

  const batchIds = logs.filter((d) => d.targetEntity === "Batch").map((d) => d.targetId);
  const batchMap = new Map<string, string>();
  if (batchIds.length > 0) {
    const batches = await BatchModel.find({ _id: { $in: batchIds } }).select("_id name batchId").lean().exec();
    for (const b of batches) {
      const id = String((b as { _id: unknown })._id);
      const name = ((b as { name?: string }).name ?? "").trim();
      const code = ((b as { batchId?: string }).batchId ?? "").trim();
      const label = name && code ? `${name} (${code})` : name || code || id;
      batchMap.set(id, label);
    }
  }

  const courseIds = logs.filter((d) => d.targetEntity === "Course").map((d) => d.targetId);
  const courseMap = new Map<string, string>();
  if (courseIds.length > 0) {
    const courses = await CourseModel.find({ _id: { $in: courseIds } }).select("_id courseId title").lean().exec();
    for (const c of courses) {
      const id = String((c as { _id: unknown })._id);
      const title = ((c as { title?: string }).title ?? "").trim();
      const cid = ((c as { courseId?: string }).courseId ?? "").trim();
      const label = title && cid ? `${title} (${cid})` : title || cid || id;
      courseMap.set(id, label);
    }
  }

  const assignmentIds = logs.filter((d) => d.targetEntity === "GlobalAssignment").map((d) => d.targetId);
  const assignmentMap = new Map<string, string>();
  if (assignmentIds.length > 0) {
    const assignments = await GlobalAssignmentModel.find({ _id: { $in: assignmentIds } }).select("_id assignmentId").lean().exec();
    for (const a of assignments) {
      const aid = (a as { assignmentId?: string }).assignmentId;
      if (aid) assignmentMap.set(String((a as { _id: unknown })._id), aid);
    }
  }

  const moduleIds = logs.filter((d) => d.targetEntity === "GlobalModule").map((d) => d.targetId);
  const moduleMap = new Map<string, string>();
  if (moduleIds.length > 0) {
    const modules = await GlobalModuleModel.find({ _id: { $in: moduleIds } }).select("_id moduleId").lean().exec();
    for (const m of modules) {
      const mid = (m as { moduleId?: string }).moduleId;
      if (mid) moduleMap.set(String((m as { _id: unknown })._id), mid);
    }
  }

  const submissionIds = logs.filter((d) => d.targetEntity === "AssignmentSubmission").map((d) => d.targetId);
  const submissionMap = new Map<string, string>();
  if (submissionIds.length > 0) {
    const submissions = await AssignmentSubmissionModel.find({ _id: { $in: submissionIds } }).select("_id submissionId").lean().exec();
    for (const s of submissions) {
      const sid = (s as { submissionId?: string }).submissionId;
      if (sid) submissionMap.set(String((s as { _id: unknown })._id), sid);
    }
  }

  function targetIdDisplay(entity: string, targetId: string): string {
    if (entity === "Certificate") return certMap.get(targetId) ?? targetId;
    if (entity === "Batch") return batchMap.get(targetId) ?? targetId;
    if (entity === "Course") return courseMap.get(targetId) ?? targetId;
    if (entity === "GlobalAssignment") return assignmentMap.get(targetId) ?? targetId;
    if (entity === "GlobalModule") return moduleMap.get(targetId) ?? targetId;
    if (entity === "AssignmentSubmission") return submissionMap.get(targetId) ?? targetId;
    return targetId;
  }

  return {
    logs: logs.map((d) => ({
      id: String(d._id),
      action: d.action,
      performedBy: d.performedBy,
      performedByDisplay: userMap.get(d.performedBy) ?? d.performedBy,
      targetEntity: d.targetEntity,
      targetId: d.targetId,
      targetIdDisplay: targetIdDisplay(d.targetEntity, d.targetId),
      timestamp: d.timestamp,
      meta: d.meta,
    })),
    total,
  };
}
