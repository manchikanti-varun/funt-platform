/**
 * Payment Promise Service
 *
 * Manages the full lifecycle of "pay later" commitments:
 *   - Student/parent requests a promise (selects a date)
 *   - Admin approves/rejects
 *   - On approval: temporary milestone access granted
 *   - Reminders sent before due date
 *   - Auto-suspension if payment not received by due date
 *   - Payment completion at any time restores permanent access
 */

import {
  PAYMENT_PROMISE_STATUS,
  PAYMENT_PROMISE_DEFAULTS,
  MILESTONE_UNLOCK_SOURCE,
} from "@funt-platform/constants";
import { PaymentPromiseModel } from "../models/PaymentPromise.model.js";
import { MilestoneProgressModel } from "../models/MilestoneProgress.model.js";
import { UserModel } from "../models/User.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { unlockMilestone, getMilestonesFromSnapshot } from "./learningPlan.service.js";
import { createAuditLog } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { AppError } from "../utils/AppError.js";
import { generatePromiseId } from "../utils/funtIdGenerator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestPromiseInput {
  studentId: string;
  batchId: string;
  courseId: string;
  milestoneId: string;
  promiseDate: string; // ISO date string
  reason?: string;
}

export interface ApprovePromiseInput {
  promiseId: string;
  adminId: string;
  adminDueDate?: string; // optional override
  remarks?: string;
}

export interface RejectPromiseInput {
  promiseId: string;
  adminId: string;
  rejectionNote?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function effectiveDueDate(promise: { promiseDate: Date; adminDueDate?: Date }): Date {
  return promise.adminDueDate ?? promise.promiseDate;
}

function daysUntilDue(promise: { promiseDate: Date; adminDueDate?: Date }): number {
  const due = effectiveDueDate(promise);
  return Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

// ─── Request a Payment Promise (Student/Parent) ──────────────────────────────

export async function requestPaymentPromise(input: RequestPromiseInput): Promise<object> {
  const { studentId, batchId, courseId, milestoneId, promiseDate, reason } = input;

  // Validate promise date
  const date = new Date(promiseDate);
  if (isNaN(date.getTime())) throw new AppError("Invalid promise date", 400);

  const now = new Date();
  if (date <= now) throw new AppError("Promise date must be in the future", 400);

  const maxDays = PAYMENT_PROMISE_DEFAULTS.MAX_PROMISE_DAYS;
  const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
  if (date > maxDate) {
    throw new AppError(`Promise date cannot exceed ${maxDays} days from today`, 400);
  }

  // Check max active promises per student
  const activeCount = await PaymentPromiseModel.countDocuments({
    studentId,
    status: { $in: [PAYMENT_PROMISE_STATUS.PROMISED, PAYMENT_PROMISE_STATUS.ACTIVE] },
  }).exec();

  if (activeCount >= PAYMENT_PROMISE_DEFAULTS.MAX_ACTIVE_PROMISES_PER_STUDENT) {
    throw new AppError(
      `You can only have ${PAYMENT_PROMISE_DEFAULTS.MAX_ACTIVE_PROMISES_PER_STUDENT} active payment promise(s) at a time`,
      400
    );
  }

  // Check no existing promise for this exact milestone
  const existing = await PaymentPromiseModel.findOne({
    studentId, batchId, courseId, milestoneId,
    status: { $in: [PAYMENT_PROMISE_STATUS.PROMISED, PAYMENT_PROMISE_STATUS.ACTIVE] },
  }).exec();

  if (existing) {
    throw new AppError("A payment promise already exists for this milestone", 400);
  }

  // Resolve milestone info from batch snapshot
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) throw new AppError("Course not found in batch", 404);

  const milestones = getMilestonesFromSnapshot(snap);
  const milestone = milestones.find((m) => m.milestoneId === milestoneId);
  if (!milestone) throw new AppError("Milestone not found", 404);

  // Get student info for snapshot
  const student = await UserModel.findById(studentId).select("name username").lean().exec();
  const studentName = (student as { name?: string } | null)?.name ?? "";
  const studentUsername = (student as { username?: string } | null)?.username ?? "";

  const promiseId = await generatePromiseId();

  const doc = await PaymentPromiseModel.create({
    promiseId,
    studentId,
    batchId,
    courseId,
    milestoneId,
    amountPaise: milestone.feeInPaise,
    currency: "INR",
    status: PAYMENT_PROMISE_STATUS.PROMISED,
    promiseDate: date,
    reason: reason?.trim().slice(0, 500) || undefined,
    requestedAt: now,
    milestoneTitle: milestone.title,
    studentName,
    studentUsername,
  });

  await createAuditLog(
    "PAYMENT_PROMISE_REQUESTED",
    studentId,
    "PaymentPromise",
    promiseId,
    { milestoneId, milestoneTitle: milestone.title, promiseDate, amountPaise: milestone.feeInPaise }
  );

  return {
    promiseId: doc.promiseId,
    status: doc.status,
    milestoneTitle: milestone.title,
    amountPaise: milestone.feeInPaise,
    promiseDate: date,
  };
}

// ─── Approve a Payment Promise (Admin) ───────────────────────────────────────

export async function approvePaymentPromise(input: ApprovePromiseInput): Promise<object> {
  const { promiseId, adminId, adminDueDate, remarks } = input;

  const promise = await PaymentPromiseModel.findOne({ promiseId }).exec();
  if (!promise) throw new AppError("Payment promise not found", 404);
  if (promise.status !== PAYMENT_PROMISE_STATUS.PROMISED) {
    throw new AppError(`Cannot approve a promise in status: ${promise.status}`, 400);
  }

  // Validate admin due date if provided
  let resolvedAdminDueDate: Date | undefined;
  if (adminDueDate) {
    resolvedAdminDueDate = new Date(adminDueDate);
    if (isNaN(resolvedAdminDueDate.getTime())) throw new AppError("Invalid admin due date", 400);
    if (resolvedAdminDueDate <= new Date()) throw new AppError("Admin due date must be in the future", 400);
  }

  const now = new Date();
  promise.status = PAYMENT_PROMISE_STATUS.ACTIVE;
  promise.approvedAt = now;
  promise.approvedBy = adminId;
  if (resolvedAdminDueDate) promise.adminDueDate = resolvedAdminDueDate;
  if (remarks) promise.remarks = remarks.trim().slice(0, 1000);
  await promise.save();

  // Grant temporary milestone access
  const batch = await findBatchByParam(promise.batchId);
  if (batch) {
    const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    const snap = snaps.find((s) => (s as { courseId?: string }).courseId === promise.courseId) ?? snaps[0];
    if (snap) {
      const milestones = getMilestonesFromSnapshot(snap);
      const milestone = milestones.find((m) => m.milestoneId === promise.milestoneId);
      if (milestone) {
        await unlockMilestone({
          studentId: promise.studentId,
          batchId: promise.batchId,
          courseId: promise.courseId,
          milestoneId: promise.milestoneId,
          milestone,
          source: MILESTONE_UNLOCK_SOURCE.MANUAL,
          actorId: adminId,
        });
      }
    }
  }

  // Update MilestoneProgress to indicate temporary access
  await MilestoneProgressModel.updateOne(
    { studentId: promise.studentId, batchId: promise.batchId, courseId: promise.courseId, milestoneId: promise.milestoneId },
    { $set: { paymentStatus: "PAYMENT_PENDING", paymentDueAt: effectiveDueDate(promise) } }
  ).exec();

  await createAuditLog(
    "PAYMENT_PROMISE_APPROVED",
    adminId,
    "PaymentPromise",
    promiseId,
    { studentId: promise.studentId, milestoneId: promise.milestoneId, dueDate: effectiveDueDate(promise).toISOString() }
  );

  await createNotification({
    userId: promise.studentId,
    title: "Payment Promise Approved",
    body: `Your request for "${promise.milestoneTitle}" has been approved. Please pay by ${effectiveDueDate(promise).toLocaleDateString("en-IN")}.`,
    type: "PAYMENT_PROMISE_APPROVED",
    referenceId: promiseId,
  });

  return {
    promiseId,
    status: PAYMENT_PROMISE_STATUS.ACTIVE,
    dueDate: effectiveDueDate(promise),
  };
}

// ─── Reject a Payment Promise (Admin) ────────────────────────────────────────

export async function rejectPaymentPromise(input: RejectPromiseInput): Promise<object> {
  const { promiseId, adminId, rejectionNote } = input;

  const promise = await PaymentPromiseModel.findOne({ promiseId }).exec();
  if (!promise) throw new AppError("Payment promise not found", 404);
  if (promise.status !== PAYMENT_PROMISE_STATUS.PROMISED) {
    throw new AppError(`Cannot reject a promise in status: ${promise.status}`, 400);
  }

  promise.status = PAYMENT_PROMISE_STATUS.REJECTED;
  promise.rejectedAt = new Date();
  promise.rejectedBy = adminId;
  if (rejectionNote) promise.rejectionNote = rejectionNote.trim().slice(0, 500);
  await promise.save();

  await createAuditLog(
    "PAYMENT_PROMISE_REJECTED",
    adminId,
    "PaymentPromise",
    promiseId,
    { studentId: promise.studentId, milestoneId: promise.milestoneId }
  );

  await createNotification({
    userId: promise.studentId,
    title: "Payment Promise Rejected",
    body: `Your pay-later request for "${promise.milestoneTitle}" was not approved.${rejectionNote ? ` Reason: ${rejectionNote}` : ""}`,
    type: "PAYMENT_PROMISE_REJECTED",
    referenceId: promiseId,
  });

  return { promiseId, status: PAYMENT_PROMISE_STATUS.REJECTED };
}

// ─── Mark Promise as Paid ────────────────────────────────────────────────────

export async function markPromisePaid(
  promiseId: string,
  paymentId: string,
  actorId: string
): Promise<object> {
  const promise = await PaymentPromiseModel.findOne({ promiseId }).exec();
  if (!promise) throw new AppError("Payment promise not found", 404);

  if (![PAYMENT_PROMISE_STATUS.ACTIVE, PAYMENT_PROMISE_STATUS.OVERDUE, PAYMENT_PROMISE_STATUS.SUSPENDED].includes(promise.status as PAYMENT_PROMISE_STATUS)) {
    throw new AppError(`Cannot mark paid for status: ${promise.status}`, 400);
  }

  const wasSuspended = promise.status === PAYMENT_PROMISE_STATUS.SUSPENDED || promise.status === PAYMENT_PROMISE_STATUS.OVERDUE;
  promise.status = PAYMENT_PROMISE_STATUS.PAID;
  promise.paidAt = new Date();
  promise.paymentId = paymentId;
  await promise.save();

  // Restore/confirm milestone access
  await MilestoneProgressModel.updateOne(
    { studentId: promise.studentId, batchId: promise.batchId, courseId: promise.courseId, milestoneId: promise.milestoneId },
    { $set: { paymentStatus: "COMPLETED", paymentId, paidAt: new Date(), locked: false } }
  ).exec();

  await createAuditLog(
    "PAYMENT_PROMISE_PAID",
    actorId,
    "PaymentPromise",
    promiseId,
    { studentId: promise.studentId, milestoneId: promise.milestoneId, paymentId, wasSuspended }
  );

  await createNotification({
    userId: promise.studentId,
    title: "Payment Received",
    body: wasSuspended
      ? `Payment for "${promise.milestoneTitle}" received. Your access has been restored.`
      : `Payment for "${promise.milestoneTitle}" received. Thank you!`,
    type: "PAYMENT_PROMISE_PAID",
    referenceId: promiseId,
  });

  return { promiseId, status: PAYMENT_PROMISE_STATUS.PAID };
}

// ─── Cancel a Promise (Admin or Student before approval) ─────────────────────

export async function cancelPaymentPromise(promiseId: string, actorId: string): Promise<object> {
  const promise = await PaymentPromiseModel.findOne({ promiseId }).exec();
  if (!promise) throw new AppError("Payment promise not found", 404);

  if (![PAYMENT_PROMISE_STATUS.PROMISED, PAYMENT_PROMISE_STATUS.ACTIVE].includes(promise.status as PAYMENT_PROMISE_STATUS)) {
    throw new AppError(`Cannot cancel a promise in status: ${promise.status}`, 400);
  }

  const wasActive = promise.status === PAYMENT_PROMISE_STATUS.ACTIVE;
  promise.status = PAYMENT_PROMISE_STATUS.CANCELLED;
  promise.cancelledAt = new Date();
  promise.cancelledBy = actorId;
  await promise.save();

  // If was active, lock milestone access
  if (wasActive) {
    await MilestoneProgressModel.updateOne(
      { studentId: promise.studentId, batchId: promise.batchId, courseId: promise.courseId, milestoneId: promise.milestoneId },
      { $set: { locked: true, lockedAt: new Date(), lockedBy: actorId } }
    ).exec();
  }

  await createAuditLog(
    "PAYMENT_PROMISE_CANCELLED",
    actorId,
    "PaymentPromise",
    promiseId,
    { studentId: promise.studentId, milestoneId: promise.milestoneId, wasActive }
  );

  return { promiseId, status: PAYMENT_PROMISE_STATUS.CANCELLED };
}

// ─── Change Due Date (Admin) ─────────────────────────────────────────────────

export async function changeDueDate(
  promiseId: string,
  newDueDate: string,
  adminId: string
): Promise<object> {
  const promise = await PaymentPromiseModel.findOne({ promiseId }).exec();
  if (!promise) throw new AppError("Payment promise not found", 404);

  if (![PAYMENT_PROMISE_STATUS.ACTIVE, PAYMENT_PROMISE_STATUS.OVERDUE].includes(promise.status as PAYMENT_PROMISE_STATUS)) {
    throw new AppError(`Cannot change due date for status: ${promise.status}`, 400);
  }

  const date = new Date(newDueDate);
  if (isNaN(date.getTime()) || date <= new Date()) {
    throw new AppError("New due date must be a valid future date", 400);
  }

  const oldDueDate = effectiveDueDate(promise);
  promise.adminDueDate = date;
  // If overdue, reactivate on extension
  if (promise.status === PAYMENT_PROMISE_STATUS.OVERDUE) {
    promise.status = PAYMENT_PROMISE_STATUS.ACTIVE;
  }
  await promise.save();

  // Update MilestoneProgress due date
  await MilestoneProgressModel.updateOne(
    { studentId: promise.studentId, batchId: promise.batchId, courseId: promise.courseId, milestoneId: promise.milestoneId },
    { $set: { paymentDueAt: date, paymentStatus: "PAYMENT_PENDING", locked: false } }
  ).exec();

  await createAuditLog(
    "PAYMENT_PROMISE_DUE_DATE_CHANGED",
    adminId,
    "PaymentPromise",
    promiseId,
    { studentId: promise.studentId, oldDueDate: oldDueDate.toISOString(), newDueDate: date.toISOString() }
  );

  await createNotification({
    userId: promise.studentId,
    title: "Payment Due Date Updated",
    body: `Your payment due date for "${promise.milestoneTitle}" has been extended to ${date.toLocaleDateString("en-IN")}.`,
    type: "PAYMENT_PROMISE_REMINDER",
    referenceId: promiseId,
  });

  return { promiseId, status: promise.status, newDueDate: date };
}

// ─── Reactivate (Admin restores access after overdue/suspend) ────────────────

export async function reactivatePromise(promiseId: string, adminId: string): Promise<object> {
  const promise = await PaymentPromiseModel.findOne({ promiseId }).exec();
  if (!promise) throw new AppError("Payment promise not found", 404);

  if (![PAYMENT_PROMISE_STATUS.OVERDUE, PAYMENT_PROMISE_STATUS.SUSPENDED].includes(promise.status as PAYMENT_PROMISE_STATUS)) {
    throw new AppError(`Can only reactivate OVERDUE or SUSPENDED promises`, 400);
  }

  promise.status = PAYMENT_PROMISE_STATUS.ACTIVE;
  await promise.save();

  // Unlock milestone
  await MilestoneProgressModel.updateOne(
    { studentId: promise.studentId, batchId: promise.batchId, courseId: promise.courseId, milestoneId: promise.milestoneId },
    { $set: { locked: false, paymentStatus: "PAYMENT_PENDING" } }
  ).exec();

  await createAuditLog(
    "PAYMENT_PROMISE_REACTIVATED",
    adminId,
    "PaymentPromise",
    promiseId,
    { studentId: promise.studentId, milestoneId: promise.milestoneId }
  );

  await createNotification({
    userId: promise.studentId,
    title: "Access Restored",
    body: `Your access to "${promise.milestoneTitle}" has been restored. Please complete payment soon.`,
    type: "PAYMENT_PROMISE_APPROVED",
    referenceId: promiseId,
  });

  return { promiseId, status: PAYMENT_PROMISE_STATUS.ACTIVE };
}

// ─── Process Overdue Promises (Cron/Manual) ──────────────────────────────────

/**
 * Finds all ACTIVE promises past their due date and suspends milestone access.
 * Should be called daily (via cron or admin trigger).
 */
export async function processOverduePromises(): Promise<{ flagged: number }> {
  const now = new Date();
  const grace = PAYMENT_PROMISE_DEFAULTS.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - grace);

  // Find active promises past due
  const overdue = await PaymentPromiseModel.find({
    status: PAYMENT_PROMISE_STATUS.ACTIVE,
    $or: [
      { adminDueDate: { $lt: cutoff } },
      { adminDueDate: { $exists: false }, promiseDate: { $lt: cutoff } },
    ],
  }).exec();

  let flagged = 0;
  for (const promise of overdue) {
    promise.status = PAYMENT_PROMISE_STATUS.OVERDUE;
    promise.suspendedAt = now;
    await promise.save();

    // Lock milestone access
    await MilestoneProgressModel.updateOne(
      { studentId: promise.studentId, batchId: promise.batchId, courseId: promise.courseId, milestoneId: promise.milestoneId },
      { $set: { locked: true, lockedAt: now, lockedBy: "system", paymentStatus: "OVERDUE" } }
    ).exec();

    await createAuditLog(
      "PAYMENT_PROMISE_OVERDUE",
      "system",
      "PaymentPromise",
      promise.promiseId,
      { studentId: promise.studentId, milestoneId: promise.milestoneId }
    );

    await createNotification({
      userId: promise.studentId,
      title: "Payment Overdue — Access Suspended",
      body: `Your payment for "${promise.milestoneTitle}" is overdue. Access has been suspended. Please pay to restore access.`,
      type: "PAYMENT_PROMISE_OVERDUE",
      referenceId: promise.promiseId,
    });

    flagged++;
  }

  return { flagged };
}

// ─── Send Reminders (Cron/Manual) ────────────────────────────────────────────

/**
 * Sends reminders for active promises approaching or past their due date.
 * Should be called daily.
 */
export async function sendPromiseReminders(): Promise<{ sent: number }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const active = await PaymentPromiseModel.find({
    status: PAYMENT_PROMISE_STATUS.ACTIVE,
  }).exec();

  let sent = 0;

  for (const promise of active) {
    const dueDate = effectiveDueDate(promise);
    const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    const allReminderDays = [
      ...PAYMENT_PROMISE_DEFAULTS.REMINDER_DAYS_BEFORE.map((d) => d),
      ...PAYMENT_PROMISE_DEFAULTS.REMINDER_DAYS_AFTER.map((d) => -d),
    ];

    const shouldRemind = allReminderDays.includes(daysLeft);
    if (!shouldRemind) continue;

    // Prevent duplicate reminders on the same day
    if (promise.lastReminderSentAt) {
      const lastDate = new Date(promise.lastReminderSentAt);
      const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      if (lastDay.getTime() === today.getTime()) continue;
    }

    let title: string;
    let body: string;
    if (daysLeft > 0) {
      title = `Payment Due in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}`;
      body = `Your payment of ₹${promise.amountPaise / 100} for "${promise.milestoneTitle}" is due on ${dueDate.toLocaleDateString("en-IN")}.`;
    } else if (daysLeft === 0) {
      title = "Payment Due Today";
      body = `Your payment of ₹${promise.amountPaise / 100} for "${promise.milestoneTitle}" is due today. Please pay to avoid access suspension.`;
    } else {
      title = "Payment Overdue";
      body = `Your payment of ₹${promise.amountPaise / 100} for "${promise.milestoneTitle}" is ${Math.abs(daysLeft)} day(s) overdue.`;
    }

    await createNotification({
      userId: promise.studentId,
      title,
      body,
      type: "PAYMENT_PROMISE_REMINDER",
      referenceId: promise.promiseId,
    });

    promise.lastReminderSentAt = now;
    promise.remindersSent = (promise.remindersSent ?? 0) + 1;
    await promise.save();
    sent++;
  }

  return { sent };
}

// ─── Query helpers ───────────────────────────────────────────────────────────

/** Get student's own promises */
export async function getStudentPromises(studentId: string) {
  const docs = await PaymentPromiseModel.find({ studentId })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return docs.map((d) => ({
    promiseId: d.promiseId,
    milestoneId: d.milestoneId,
    milestoneTitle: d.milestoneTitle,
    amountPaise: d.amountPaise,
    amountRupees: d.amountPaise / 100,
    currency: d.currency,
    status: d.status,
    promiseDate: d.promiseDate,
    dueDate: d.adminDueDate ?? d.promiseDate,
    daysRemaining: daysUntilDue(d as { promiseDate: Date; adminDueDate?: Date }),
    reason: d.reason,
    requestedAt: d.requestedAt,
    approvedAt: d.approvedAt,
    paidAt: d.paidAt,
    suspendedAt: d.suspendedAt,
  }));
}

/** Admin: list all promises (with filters) */
export async function getAdminPromises(filters: {
  status?: string;
  studentId?: string;
  batchId?: string;
  courseId?: string;
  page?: number;
  limit?: number;
}) {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.studentId) query.studentId = filters.studentId;
  if (filters.batchId) query.batchId = filters.batchId;
  if (filters.courseId) query.courseId = filters.courseId;

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;

  const [docs, total] = await Promise.all([
    PaymentPromiseModel.find(query)
      .sort({ requestedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    PaymentPromiseModel.countDocuments(query).exec(),
  ]);

  return {
    promises: docs.map((d) => ({
      promiseId: d.promiseId,
      studentId: d.studentId,
      studentName: d.studentName,
      studentUsername: d.studentUsername,
      batchId: d.batchId,
      courseId: d.courseId,
      milestoneId: d.milestoneId,
      milestoneTitle: d.milestoneTitle,
      amountPaise: d.amountPaise,
      amountRupees: d.amountPaise / 100,
      currency: d.currency,
      status: d.status,
      promiseDate: d.promiseDate,
      dueDate: d.adminDueDate ?? d.promiseDate,
      daysRemaining: daysUntilDue(d as { promiseDate: Date; adminDueDate?: Date }),
      reason: d.reason,
      remarks: d.remarks,
      requestedAt: d.requestedAt,
      approvedAt: d.approvedAt,
      approvedBy: d.approvedBy,
      paidAt: d.paidAt,
      suspendedAt: d.suspendedAt,
      remindersSent: d.remindersSent,
    })),
    total,
    page,
    limit,
  };
}

/** Admin: get overdue promises */
export async function getOverduePromises() {
  const docs = await PaymentPromiseModel.find({
    status: PAYMENT_PROMISE_STATUS.OVERDUE,
  })
    .sort({ suspendedAt: -1 })
    .lean()
    .exec();

  return docs.map((d) => ({
    promiseId: d.promiseId,
    studentId: d.studentId,
    studentName: d.studentName,
    studentUsername: d.studentUsername,
    batchId: d.batchId,
    courseId: d.courseId,
    milestoneId: d.milestoneId,
    milestoneTitle: d.milestoneTitle,
    amountPaise: d.amountPaise,
    amountRupees: d.amountPaise / 100,
    promiseDate: d.promiseDate,
    dueDate: d.adminDueDate ?? d.promiseDate,
    suspendedAt: d.suspendedAt,
    requestedAt: d.requestedAt,
  }));
}

/** Admin: analytics summary */
export async function getPromiseAnalytics() {
  const all = await PaymentPromiseModel.find({}).lean().exec();

  const total = all.length;
  const byStatus = { PROMISED: 0, ACTIVE: 0, PAID: 0, OVERDUE: 0, CANCELLED: 0, REJECTED: 0, SUSPENDED: 0 };
  let totalPromisedDays = 0;
  let totalDelayDays = 0;
  let paidCount = 0;
  let revenuePendingPaise = 0;
  let revenueCollectedPaise = 0;

  for (const d of all) {
    const status = d.status as keyof typeof byStatus;
    if (status in byStatus) byStatus[status]++;

    const promiseDays = Math.ceil(
      ((d.adminDueDate ?? d.promiseDate).getTime() - d.requestedAt.getTime()) / (24 * 60 * 60 * 1000)
    );
    totalPromisedDays += promiseDays;

    if (d.status === PAYMENT_PROMISE_STATUS.PAID && d.paidAt) {
      const delay = Math.ceil((d.paidAt.getTime() - d.requestedAt.getTime()) / (24 * 60 * 60 * 1000));
      totalDelayDays += delay;
      paidCount++;
      revenueCollectedPaise += d.amountPaise;
    }

    if ([PAYMENT_PROMISE_STATUS.ACTIVE, PAYMENT_PROMISE_STATUS.OVERDUE].includes(d.status as PAYMENT_PROMISE_STATUS)) {
      revenuePendingPaise += d.amountPaise;
    }
  }

  const approvedOrPaid = all.filter((d) =>
    [PAYMENT_PROMISE_STATUS.ACTIVE, PAYMENT_PROMISE_STATUS.PAID, PAYMENT_PROMISE_STATUS.OVERDUE, PAYMENT_PROMISE_STATUS.SUSPENDED].includes(d.status as PAYMENT_PROMISE_STATUS)
  ).length;

  return {
    totalRequests: total,
    approvalRate: total > 0 ? Math.round((approvedOrPaid / total) * 100) : 0,
    avgDaysPromised: total > 0 ? Math.round(totalPromisedDays / total) : 0,
    avgPaymentDelay: paidCount > 0 ? Math.round(totalDelayDays / paidCount) : 0,
    overduePercentage: approvedOrPaid > 0 ? Math.round((byStatus.OVERDUE / approvedOrPaid) * 100) : 0,
    recoveryRate: (byStatus.OVERDUE + paidCount) > 0 ? Math.round((paidCount / (byStatus.OVERDUE + paidCount)) * 100) : 0,
    revenuePendingPaise,
    revenuePendingRupees: revenuePendingPaise / 100,
    revenueCollectedPaise,
    revenueCollectedRupees: revenueCollectedPaise / 100,
    byStatus,
  };
}
