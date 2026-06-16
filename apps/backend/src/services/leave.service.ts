/**
 * Leave Management Service
 *
 * Approval matrix:
 *   TRAINER      → reviewed by ADMIN or SUPER_ADMIN
 *   ADMIN        → reviewed by SUPER_ADMIN only
 *   SUPER_ADMIN  → auto-approved on submission
 */

import { ROLE, LEAVE_STATUS, LEAVE_TYPE } from "@funt-platform/constants";
import { LeaveRequestModel } from "../models/LeaveRequest.model.js";
import { LeavePolicyModel } from "../models/LeavePolicy.model.js";
import { LeaveBalanceModel } from "../models/LeaveBalance.model.js";
import { UserModel } from "../models/User.model.js";
import { createAuditLog } from "./audit.service.js";
import { createNotification, createNotifications } from "./notification.service.js";
import { AppError } from "../utils/AppError.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Count calendar days between two dates, inclusive. */
function countDays(start: Date, end: Date): number {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1); // inclusive of both start and end
}

/** Get or create leave balance for user+year. */
async function getOrCreateBalance(userId: string, year: number) {
  const policy = await getEffectivePolicy(year);
  const balance = await LeaveBalanceModel.findOneAndUpdate(
    { userId, year },
    {
      $setOnInsert: {
        userId,
        year,
        totalLeaves: policy.annualLeaveLimit,
        usedLeaves: 0,
        remainingLeaves: policy.annualLeaveLimit,
      },
    },
    { upsert: true, new: true }
  ).exec();
  return balance!;
}

/** Effective policy for a year (falls back to year 0 global). */
async function getEffectivePolicy(year: number) {
  const policy =
    (await LeavePolicyModel.findOne({ year }).lean().exec()) ??
    (await LeavePolicyModel.findOne({ year: 0 }).lean().exec());
  return {
    annualLeaveLimit: (policy as { annualLeaveLimit?: number } | null)?.annualLeaveLimit ?? 12,
    allowHalfDay: (policy as { allowHalfDay?: boolean } | null)?.allowHalfDay ?? true,
    maxConsecutiveLeaves: (policy as { maxConsecutiveLeaves?: number } | null)?.maxConsecutiveLeaves ?? 7,
    leaveTypes: (policy as { leaveTypes?: string[] } | null)?.leaveTypes ?? Object.values(LEAVE_TYPE),
    customLeaveTypes: (policy as { customLeaveTypes?: string[] } | null)?.customLeaveTypes ?? [],
  };
}

/** Resolve user ids of all admins/super-admins to notify. */
async function getAdminUserIds(includeSuperAdminOnly = false): Promise<string[]> {
  const roles = includeSuperAdminOnly ? [ROLE.SUPER_ADMIN] : [ROLE.ADMIN, ROLE.SUPER_ADMIN];
  const users = await UserModel.find({ roles: { $in: roles } }).select("_id").lean().exec();
  return users.map((u) => String(u._id));
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface CreateLeaveInput {
  requestedBy: string;
  requestedByRole: string;
  leaveType: string;
  customLeaveType?: string;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  reason: string;
  attachment?: string;
  affectedBatches?: string[];
  substituteTrainerId?: string;
  leaveImpactNotes?: string;
}

export async function createLeaveRequest(input: CreateLeaveInput) {
  const start = new Date(input.startDate + "T00:00:00.000Z");
  const end = new Date(input.endDate + "T00:00:00.000Z");

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("Invalid start or end date", 400);
  }
  if (end < start) {
    throw new AppError("End date cannot be before start date", 400);
  }

  const isHalfDay = !!input.isHalfDay;
  const policy = await getEffectivePolicy(start.getFullYear());

  if (isHalfDay && !policy.allowHalfDay) {
    throw new AppError("Half-day leaves are not allowed by current policy", 400);
  }

  let totalDays = isHalfDay ? 0.5 : countDays(start, end);
  if (totalDays === 0) totalDays = 0.5;

  if (totalDays > policy.maxConsecutiveLeaves) {
    throw new AppError(
      `Cannot apply for more than ${policy.maxConsecutiveLeaves} consecutive days`,
      400
    );
  }

  // Check for overlapping leaves
  const overlap = await LeaveRequestModel.findOne({
    requestedBy: input.requestedBy,
    status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).lean().exec();
  if (overlap) {
    throw new AppError("You already have a pending or approved leave overlapping these dates", 409);
  }

  // Super admin: auto-approve
  const isSuperAdmin = input.requestedByRole === ROLE.SUPER_ADMIN;
  const status = isSuperAdmin ? LEAVE_STATUS.APPROVED : LEAVE_STATUS.PENDING;
  const now = new Date();

  const doc = await LeaveRequestModel.create({
    requestedBy: input.requestedBy,
    requestedByRole: input.requestedByRole,
    leaveType: input.leaveType,
    customLeaveType: input.customLeaveType,
    startDate: start,
    endDate: end,
    totalDays,
    isHalfDay,
    reason: input.reason,
    attachment: input.attachment || undefined,
    status,
    affectedBatches: input.affectedBatches ?? [],
    substituteTrainerId: input.substituteTrainerId,
    leaveImpactNotes: input.leaveImpactNotes,
    ...(isSuperAdmin ? { reviewedBy: input.requestedBy, reviewedAt: now, reviewRemarks: "Auto-approved" } : {}),
  });

  const leaveId = String(doc._id);

  // Update balance if auto-approved
  if (isSuperAdmin) {
    await updateBalanceOnApproval(input.requestedBy, start.getFullYear(), totalDays);
  }

  await createAuditLog("LEAVE_APPLIED", input.requestedBy, "LeaveRequest", leaveId, {
    leaveType: input.leaveType,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    totalDays,
    status,
  });

  // Notify requester
  await createNotification({
    userId: input.requestedBy,
    title: "Leave Request Submitted",
    body: isSuperAdmin
      ? `Your ${input.leaveType} leave from ${start.toDateString()} to ${end.toDateString()} has been auto-approved.`
      : `Your ${input.leaveType} leave request from ${start.toDateString()} to ${end.toDateString()} has been submitted for approval.`,
    type: isSuperAdmin ? "LEAVE_APPROVED" : "LEAVE_APPLIED",
    referenceId: leaveId,
  });

  // Notify reviewers
  if (!isSuperAdmin) {
    const reviewerIds = await getAdminUserIds(input.requestedByRole === ROLE.ADMIN);
    const requesterName = await getUserDisplayName(input.requestedBy);
    await createNotifications(
      reviewerIds.map((uid) => ({
        userId: uid,
        title: "New Leave Request Pending",
        body: `${requesterName} has applied for ${input.leaveType} leave from ${start.toDateString()} to ${end.toDateString()}.`,
        type: "LEAVE_PENDING_REVIEW" as const,
        referenceId: leaveId,
      }))
    );
  }

  return formatLeave(doc.toObject());
}

async function getUserDisplayName(userId: string): Promise<string> {
  const user = await UserModel.findById(userId).select("name username").lean().exec();
  return (user as { name?: string } | null)?.name ?? (user as { username?: string } | null)?.username ?? userId;
}

async function updateBalanceOnApproval(userId: string, year: number, days: number) {
  const balance = await getOrCreateBalance(userId, year);
  const usedLeaves = Math.min(balance.usedLeaves + days, balance.totalLeaves);
  const remainingLeaves = Math.max(balance.remainingLeaves - days, 0);
  await LeaveBalanceModel.updateOne(
    { userId, year },
    { $set: { usedLeaves, remainingLeaves } }
  ).exec();
}

async function revertBalanceOnCancellation(userId: string, year: number, days: number) {
  const balance = await LeaveBalanceModel.findOne({ userId, year }).lean().exec();
  if (!balance) return;
  const usedLeaves = Math.max((balance as { usedLeaves: number }).usedLeaves - days, 0);
  const remainingLeaves = Math.min(
    (balance as { remainingLeaves: number }).remainingLeaves + days,
    (balance as { totalLeaves: number }).totalLeaves
  );
  await LeaveBalanceModel.updateOne({ userId, year }, { $set: { usedLeaves, remainingLeaves } }).exec();
}

export async function approveLeaveRequest(leaveId: string, reviewerId: string, reviewerRole: string, remarks?: string) {
  const leave = await LeaveRequestModel.findById(leaveId).exec();
  if (!leave) throw new AppError("Leave request not found", 404);
  if (leave.status !== LEAVE_STATUS.PENDING) throw new AppError("Only pending leaves can be approved", 400);

  // Role-based reviewer check
  if (leave.requestedByRole === ROLE.ADMIN && reviewerRole !== ROLE.SUPER_ADMIN) {
    throw new AppError("Only Super Admin can approve Admin leave requests", 403);
  }

  leave.status = LEAVE_STATUS.APPROVED;
  leave.reviewedBy = reviewerId;
  leave.reviewedAt = new Date();
  leave.reviewRemarks = remarks ?? "";
  await leave.save();

  const year = new Date(leave.startDate).getFullYear();
  await updateBalanceOnApproval(leave.requestedBy, year, leave.totalDays);

  await createAuditLog("LEAVE_APPROVED", reviewerId, "LeaveRequest", leaveId, { reviewerRole });

  const reviewerName = await getUserDisplayName(reviewerId);
  await createNotification({
    userId: leave.requestedBy,
    title: "Leave Request Approved",
    body: `Your ${leave.leaveType} leave request (${new Date(leave.startDate).toDateString()} – ${new Date(leave.endDate).toDateString()}) has been approved by ${reviewerName}.`,
    type: "LEAVE_APPROVED",
    referenceId: leaveId,
  });

  return formatLeave(leave.toObject());
}

export async function rejectLeaveRequest(leaveId: string, reviewerId: string, reviewerRole: string, remarks?: string) {
  const leave = await LeaveRequestModel.findById(leaveId).exec();
  if (!leave) throw new AppError("Leave request not found", 404);
  if (leave.status !== LEAVE_STATUS.PENDING) throw new AppError("Only pending leaves can be rejected", 400);

  if (leave.requestedByRole === ROLE.ADMIN && reviewerRole !== ROLE.SUPER_ADMIN) {
    throw new AppError("Only Super Admin can reject Admin leave requests", 403);
  }

  leave.status = LEAVE_STATUS.REJECTED;
  leave.reviewedBy = reviewerId;
  leave.reviewedAt = new Date();
  leave.reviewRemarks = remarks ?? "";
  await leave.save();

  await createAuditLog("LEAVE_REJECTED", reviewerId, "LeaveRequest", leaveId, { reviewerRole });

  const reviewerName = await getUserDisplayName(reviewerId);
  await createNotification({
    userId: leave.requestedBy,
    title: "Leave Request Rejected",
    body: `Your ${leave.leaveType} leave request (${new Date(leave.startDate).toDateString()} – ${new Date(leave.endDate).toDateString()}) has been rejected by ${reviewerName}.${remarks ? ` Reason: ${remarks}` : ""}`,
    type: "LEAVE_REJECTED",
    referenceId: leaveId,
  });

  return formatLeave(leave.toObject());
}

export async function cancelLeaveRequest(leaveId: string, requesterId: string, _requesterRole: string) {
  const leave = await LeaveRequestModel.findById(leaveId).exec();
  if (!leave) throw new AppError("Leave request not found", 404);

  // Only requester can cancel their own leave
  if (leave.requestedBy !== requesterId) {
    throw new AppError("You can only cancel your own leave requests", 403);
  }
  if (![LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED].includes(leave.status as LEAVE_STATUS)) {
    throw new AppError("Only pending or approved leaves can be cancelled", 400);
  }
  const wasApproved = leave.status === LEAVE_STATUS.APPROVED;

  leave.status = LEAVE_STATUS.CANCELLED;
  leave.cancelledAt = new Date();
  await leave.save();

  // Revert balance if it was approved
  if (wasApproved) {
    const year = new Date(leave.startDate).getFullYear();
    await revertBalanceOnCancellation(leave.requestedBy, year, leave.totalDays);
  }

  await createAuditLog("LEAVE_CANCELLED", requesterId, "LeaveRequest", leaveId, { wasApproved });

  await createNotification({
    userId: requesterId,
    title: "Leave Request Cancelled",
    body: `Your ${leave.leaveType} leave request (${new Date(leave.startDate).toDateString()} – ${new Date(leave.endDate).toDateString()}) has been cancelled.`,
    type: "LEAVE_CANCELLED",
    referenceId: leaveId,
  });

  // Notify reviewers about cancellation if it was approved
  if (wasApproved) {
    const reviewerIds = await getAdminUserIds(leave.requestedByRole === ROLE.ADMIN);
    const requesterName = await getUserDisplayName(requesterId);
    await createNotifications(
      reviewerIds.map((uid) => ({
        userId: uid,
        title: "Approved Leave Cancelled",
        body: `${requesterName} has cancelled their approved ${leave.leaveType} leave (${new Date(leave.startDate).toDateString()} – ${new Date(leave.endDate).toDateString()}).`,
        type: "LEAVE_CANCELLED" as const,
        referenceId: leaveId,
      }))
    );
  }

  return formatLeave(leave.toObject());
}

export async function getLeaveById(leaveId: string, requesterId: string, requesterRoles: string[]) {
  const leave = await LeaveRequestModel.findById(leaveId).lean().exec();
  if (!leave) throw new AppError("Leave request not found", 404);

  const isOwner = String((leave as { requestedBy: string }).requestedBy) === requesterId;
  const isStaff = requesterRoles.some((r) => [ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(r as ROLE));
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  return enrichLeave(leave);
}

export interface ListLeavesFilters {
  requestedBy?: string;
  status?: string;
  role?: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export async function listLeaves(filters: ListLeavesFilters, viewerRoles: string[]) {
  const isStaff = viewerRoles.some((r) => [ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(r as ROLE));
  const query: Record<string, unknown> = {};

  if (!isStaff) {
    // Non-admins can only see their own leaves — caller must set requestedBy
    if (!filters.requestedBy) return { leaves: [], total: 0 };
    query.requestedBy = filters.requestedBy;
  } else {
    if (filters.requestedBy) query.requestedBy = filters.requestedBy;
    if (filters.role) query.requestedByRole = filters.role;
  }

  if (filters.status) query.status = filters.status;
  if (filters.leaveType) query.leaveType = filters.leaveType;
  if (filters.fromDate || filters.toDate) {
    const dateRange: Record<string, Date> = {};
    if (filters.fromDate) dateRange.$gte = new Date(filters.fromDate);
    if (filters.toDate) dateRange.$lte = new Date(filters.toDate);
    query.startDate = dateRange;
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const [docs, total] = await Promise.all([
    LeaveRequestModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    LeaveRequestModel.countDocuments(query).exec(),
  ]);

  const enriched = await enrichLeaves(docs);
  return { leaves: enriched, total, page, limit };
}

export async function getLeaveCalendar(year: number, month: number, viewerRoles: string[]) {
  const isStaff = viewerRoles.some((r) => [ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(r as ROLE));
  if (!isStaff) throw new AppError("Forbidden", 403);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const leaves = await LeaveRequestModel.find({
    status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).lean().exec();

  return enrichLeaves(leaves);
}

export async function getLeaveAnalytics(viewerRoles: string[]) {
  const isStaff = viewerRoles.some((r) => [ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(r as ROLE));
  if (!isStaff) throw new AppError("Forbidden", 403);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [allThisYear, todayLeaves] = await Promise.all([
    LeaveRequestModel.find({ createdAt: { $gte: yearStart } }).lean().exec(),
    LeaveRequestModel.find({
      status: LEAVE_STATUS.APPROVED,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).lean().exec(),
  ]);

  // Monthly trend
  const monthlyMap: Record<string, { applied: number; approved: number; rejected: number }> = {};
  for (const l of allThisYear) {
    const key = new Date((l as { createdAt: Date }).createdAt).toISOString().slice(0, 7);
    if (!monthlyMap[key]) monthlyMap[key] = { applied: 0, approved: 0, rejected: 0 };
    monthlyMap[key].applied++;
    if ((l as { status: string }).status === LEAVE_STATUS.APPROVED) monthlyMap[key].approved++;
    if ((l as { status: string }).status === LEAVE_STATUS.REJECTED) monthlyMap[key].rejected++;
  }
  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // Leave type distribution
  const typeMap: Record<string, number> = {};
  for (const l of allThisYear) {
    const t = (l as unknown as { leaveType: string }).leaveType;
    typeMap[t] = (typeMap[t] ?? 0) + 1;
  }
  const leaveTypeDistribution = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

  // Approval rate
  const total = allThisYear.length;
  const approved = allThisYear.filter((l) => (l as { status: string }).status === LEAVE_STATUS.APPROVED).length;
  const rejected = allThisYear.filter((l) => (l as { status: string }).status === LEAVE_STATUS.REJECTED).length;
  const pending = allThisYear.filter((l) => (l as { status: string }).status === LEAVE_STATUS.PENDING).length;

  // Team availability today
  const todayTrainerIds = new Set(
    todayLeaves
      .filter((l) => (l as { requestedByRole: string }).requestedByRole === ROLE.TRAINER)
      .map((l) => (l as { requestedBy: string }).requestedBy)
  );
  const todayAdminIds = new Set(
    todayLeaves
      .filter((l) => (l as { requestedByRole: string }).requestedByRole === ROLE.ADMIN)
      .map((l) => (l as { requestedBy: string }).requestedBy)
  );

  const [totalTrainers, totalAdmins] = await Promise.all([
    UserModel.countDocuments({ roles: ROLE.TRAINER, status: "ACTIVE" }).exec(),
    UserModel.countDocuments({ roles: ROLE.ADMIN, status: "ACTIVE" }).exec(),
  ]);

  return {
    summary: { total, approved, rejected, pending },
    monthlyTrend,
    leaveTypeDistribution,
    approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
    teamAvailability: {
      trainers: {
        total: totalTrainers,
        onLeave: todayTrainerIds.size,
        available: Math.max(0, totalTrainers - todayTrainerIds.size),
      },
      admins: {
        total: totalAdmins,
        onLeave: todayAdminIds.size,
        available: Math.max(0, totalAdmins - todayAdminIds.size),
      },
    },
  };
}

export async function getMyLeaveBalance(userId: string) {
  const year = new Date().getFullYear();
  const balance = await getOrCreateBalance(userId, year);
  return {
    year: balance.year,
    totalLeaves: balance.totalLeaves,
    usedLeaves: balance.usedLeaves,
    remainingLeaves: balance.remainingLeaves,
  };
}

// ─── Leave Policy ────────────────────────────────────────────────────────────

export async function upsertLeavePolicy(
  year: number,
  data: {
    annualLeaveLimit: number;
    leaveTypes: string[];
    allowHalfDay: boolean;
    maxConsecutiveLeaves: number;
    customLeaveTypes?: string[];
  },
  createdBy: string
) {
  const doc = await LeavePolicyModel.findOneAndUpdate(
    { year },
    { $set: { ...data, createdBy } },
    { upsert: true, new: true }
  ).exec();

  await createAuditLog("LEAVE_POLICY_UPDATED", createdBy, "LeavePolicy", String(doc!._id), { year });
  return doc;
}

export async function getLeavePolicy(year?: number) {
  const y = year ?? 0;
  const policy = (await LeavePolicyModel.findOne({ year: y }).lean().exec()) ?? null;
  const allTypes = [...Object.values(LEAVE_TYPE), ...((policy as { customLeaveTypes?: string[] } | null)?.customLeaveTypes ?? [])];
  return {
    year: y,
    annualLeaveLimit: (policy as { annualLeaveLimit?: number } | null)?.annualLeaveLimit ?? 12,
    leaveTypes: allTypes,
    allowHalfDay: (policy as { allowHalfDay?: boolean } | null)?.allowHalfDay ?? true,
    maxConsecutiveLeaves: (policy as { maxConsecutiveLeaves?: number } | null)?.maxConsecutiveLeaves ?? 7,
    customLeaveTypes: (policy as { customLeaveTypes?: string[] } | null)?.customLeaveTypes ?? [],
  };
}

// ─── Substitute Trainer ──────────────────────────────────────────────────────

export async function assignSubstituteTrainer(
  leaveId: string,
  adminId: string,
  substituteTrainerId: string | null,
  leaveImpactNotes?: string
) {
  const leave = await LeaveRequestModel.findById(leaveId).exec();
  if (!leave) throw new AppError("Leave request not found", 404);
  if (leave.requestedByRole !== ROLE.TRAINER) {
    throw new AppError("Substitute trainer can only be assigned for trainer leaves", 400);
  }

  leave.substituteTrainerId = substituteTrainerId ?? undefined;
  if (leaveImpactNotes !== undefined) leave.leaveImpactNotes = leaveImpactNotes;
  await leave.save();

  await createAuditLog("LEAVE_UPDATED", adminId, "LeaveRequest", leaveId, {
    substituteTrainerId,
    leaveImpactNotes,
  });

  return formatLeave(leave.toObject());
}

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatLeave(doc: Record<string, unknown>) {
  const startRaw = doc.startDate;
  const endRaw = doc.endDate;
  // Always return dates as YYYY-MM-DD strings to avoid timezone display issues
  const startStr = startRaw instanceof Date ? startRaw.toISOString().slice(0, 10) : String(startRaw ?? "").slice(0, 10);
  const endStr = endRaw instanceof Date ? endRaw.toISOString().slice(0, 10) : String(endRaw ?? "").slice(0, 10);

  return {
    id: String(doc._id),
    requestedBy: doc.requestedBy,
    requestedByRole: doc.requestedByRole,
    leaveType: doc.leaveType,
    customLeaveType: doc.customLeaveType,
    startDate: startStr,
    endDate: endStr,
    totalDays: doc.totalDays,
    isHalfDay: doc.isHalfDay,
    reason: doc.reason,
    attachment: doc.attachment,
    status: doc.status,
    reviewedBy: doc.reviewedBy,
    reviewedAt: doc.reviewedAt,
    reviewRemarks: doc.reviewRemarks,
    cancelledAt: doc.cancelledAt,
    affectedBatches: doc.affectedBatches,
    substituteTrainerId: doc.substituteTrainerId,
    leaveImpactNotes: doc.leaveImpactNotes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function enrichLeave(doc: Record<string, unknown>) {
  const base = formatLeave(doc);
  // Enrich with user display name
  const user = await UserModel.findById(doc.requestedBy).select("name username").lean().exec();
  return {
    ...base,
    requestedByName: (user as { name?: string } | null)?.name ?? (user as { username?: string } | null)?.username ?? String(doc.requestedBy),
    requestedByUsername: (user as { username?: string } | null)?.username ?? "",
  };
}

async function enrichLeaves(docs: Record<string, unknown>[]) {
  if (!docs.length) return [];
  const userIds = [...new Set(docs.map((d) => String(d.requestedBy)).filter(Boolean))];
  const users = await UserModel.find({ _id: { $in: userIds } }).select("_id name username").lean().exec();
  const userMap = new Map(users.map((u) => [String(u._id), { name: (u as { name?: string }).name ?? "", username: (u as { username?: string }).username ?? "" }]));

  return docs.map((d) => {
    const u = userMap.get(String(d.requestedBy)) ?? { name: "", username: "" };
    return {
      ...formatLeave(d),
      requestedByName: u.name || u.username || String(d.requestedBy),
      requestedByUsername: u.username,
    };
  });
}
