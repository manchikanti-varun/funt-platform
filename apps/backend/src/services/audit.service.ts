/**
 * Audit logging service – records actions for governance.
 * List response enriches performedBy and targetId with FUNT display IDs where applicable.
 */

import mongoose from "mongoose";
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
  | "MODULE_DUPLICATED"
  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_UPDATED"
  | "ASSIGNMENT_ARCHIVED"
  | "ASSIGNMENT_DUPLICATED"
  | "COURSE_CREATED"
  | "COURSE_DUPLICATED"
  | "COURSE_UPDATED"
  | "COURSE_ARCHIVED"
  | "BATCH_CREATED"
  | "BATCH_DUPLICATED"
  | "BATCH_UPDATED"
  | "BATCH_ARCHIVED"
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
  | "BADGE_AWARDED"
  | "SKILL_RECALCULATED"
  | "VERIFY_ACCESSED";

export async function createAuditLog(
  action: AuditAction,
  performedBy: string,
  targetEntity: string,
  targetId: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await AuditLogModel.create({
    action,
    performedBy,
    targetEntity,
    targetId,
    timestamp: new Date(),
    ...(meta ? { meta } : {}),
  });
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
      const user = await UserModel.findOne({ funtId: performedByFilter.trim() }).select("_id").lean().exec();
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
    const users = await UserModel.find({ _id: { $in: performedByIds } }).select("_id funtId").lean().exec();
    for (const u of users) {
      const id = String((u as { _id: unknown })._id);
      const funtId = (u as { funtId?: string }).funtId;
      if (funtId) userMap.set(id, funtId);
    }
  }

  const certIds = logs.filter((d) => d.targetEntity === "Certificate").map((d) => d.targetId);
  const certMap = new Map<string, string>();
  if (certIds.length > 0) {
    const certs = await CertificateModel.find({ _id: { $in: certIds } }).select("_id certificateId").lean().exec();
    for (const c of certs) {
      certMap.set(String((c as { _id: unknown })._id), (c as { certificateId: string }).certificateId);
    }
  }

  const batchIds = logs.filter((d) => d.targetEntity === "Batch").map((d) => d.targetId);
  const batchMap = new Map<string, string>();
  if (batchIds.length > 0) {
    const batches = await BatchModel.find({ _id: { $in: batchIds } }).select("_id batchId").lean().exec();
    for (const b of batches) {
      const bid = (b as { batchId?: string }).batchId;
      if (bid) batchMap.set(String((b as { _id: unknown })._id), bid);
    }
  }

  const courseIds = logs.filter((d) => d.targetEntity === "Course").map((d) => d.targetId);
  const courseMap = new Map<string, string>();
  if (courseIds.length > 0) {
    const courses = await CourseModel.find({ _id: { $in: courseIds } }).select("_id courseId").lean().exec();
    for (const c of courses) {
      const cid = (c as { courseId?: string }).courseId;
      if (cid) courseMap.set(String((c as { _id: unknown })._id), cid);
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
