/**
 * Franchise Service — business logic for franchise center management.
 *
 * Franchise admins can:
 *  - Create batches using global courses
 *  - Register & enroll students into their batches
 *  - Mark attendance for their batches
 *  - Record offline payments
 *  - View their students and earnings
 *
 * They CANNOT: create courses, edit content, change pricing, see other franchises.
 */

import { FranchiseCenterModel } from "../models/FranchiseCenter.model.js";
import { FranchiseTransactionModel, FranchisePayoutModel } from "../models/FranchiseTransaction.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { UserModel } from "../models/User.model.js";
import { CourseModel } from "../models/Course.model.js";
import { createBatch as createBatchService, getBatchCourseSnapshots } from "./batch.service.js";
import { createEnrollment } from "./enrollment.service.js";
import { createStudent } from "./auth.service.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import {
  FRANCHISE_STATUS,
  FRANCHISE_COMMISSION_MODEL,
  FRANCHISE_TRANSACTION_TYPE,
  FRANCHISE_PAYOUT_STATUS,
  ROLE,
  ACCOUNT_STATUS,
  COURSE_STATUS,
} from "@funt-platform/constants";

// ─── Franchise Center CRUD ────────────────────────────────────────────────────

export interface CreateFranchiseCenterInput {
  franchiseCode: string;
  centerName: string;
  city: string;
  address?: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail?: string;
  ownerPassword: string;
  commissionModel?: string;
  commissionPercent?: number;
  commissionFlatPaise?: number;
  createdBy: string;
}

export async function createFranchiseCenter(input: CreateFranchiseCenterInput) {
  const code = input.franchiseCode.trim().toUpperCase();
  if (!code) throw new AppError("franchiseCode is required", 400);
  if (!input.centerName?.trim()) throw new AppError("centerName is required", 400);
  if (!input.city?.trim()) throw new AppError("city is required", 400);
  if (!input.ownerName?.trim()) throw new AppError("ownerName is required", 400);
  if (!input.ownerMobile?.trim()) throw new AppError("ownerMobile is required", 400);
  if (!input.ownerPassword?.trim()) throw new AppError("ownerPassword is required", 400);

  // Check uniqueness
  const existing = await FranchiseCenterModel.findOne({ franchiseCode: code }).lean().exec();
  if (existing) throw new AppError("Franchise code already exists", 400);

  // Create the FRANCHISE_ADMIN user account
  const { hashPassword, validateStrongPassword } = await import("./auth.service.js");
  validateStrongPassword(input.ownerPassword);
  const passwordHash = await hashPassword(input.ownerPassword);

  const username = `franchise.${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const existingUser = await UserModel.findOne({ username }).lean().exec();
  if (existingUser) throw new AppError("Username conflict for franchise owner", 400);

  const user = await UserModel.create({
    username,
    name: input.ownerName.trim(),
    email: input.ownerEmail?.trim() || undefined,
    mobile: input.ownerMobile.trim(),
    passwordHash,
    roles: [ROLE.FRANCHISE_ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    city: input.city.trim(),
  });

  const commissionModel = input.commissionModel === FRANCHISE_COMMISSION_MODEL.FLAT_PER_STUDENT
    ? FRANCHISE_COMMISSION_MODEL.FLAT_PER_STUDENT
    : FRANCHISE_COMMISSION_MODEL.PERCENTAGE;

  const center = await FranchiseCenterModel.create({
    franchiseCode: code,
    centerName: input.centerName.trim(),
    city: input.city.trim(),
    address: input.address?.trim() || "",
    ownerUserId: String(user._id),
    ownerName: input.ownerName.trim(),
    ownerMobile: input.ownerMobile.trim(),
    ownerEmail: input.ownerEmail?.trim() || "",
    commissionModel,
    commissionPercent: input.commissionPercent ?? 30,
    commissionFlatPaise: input.commissionFlatPaise ?? 0,
    status: FRANCHISE_STATUS.ACTIVE,
    createdBy: input.createdBy,
  });

  await createAuditLog("FRANCHISE_CENTER_CREATED", input.createdBy, "FranchiseCenter", String(center._id));

  return {
    id: String(center._id),
    franchiseCode: center.franchiseCode,
    centerName: center.centerName,
    city: center.city,
    ownerUsername: username,
    ownerUserId: String(user._id),
    status: center.status,
  };
}

export async function listFranchiseCenters(filters?: { status?: string; city?: string }) {
  const query: Record<string, unknown> = {};
  if (filters?.status) query.status = filters.status;
  if (filters?.city) query.city = { $regex: filters.city, $options: "i" };

  const centers = await FranchiseCenterModel.find(query).sort({ createdAt: -1 }).lean().exec();
  return centers.map((c) => ({
    id: String(c._id),
    franchiseCode: c.franchiseCode,
    centerName: c.centerName,
    city: c.city,
    ownerName: c.ownerName,
    ownerMobile: c.ownerMobile,
    status: c.status,
    commissionModel: c.commissionModel,
    commissionPercent: c.commissionPercent,
    totalStudents: c.totalStudents,
    totalRevenuePaise: c.totalRevenuePaise,
    pendingPayoutPaise: c.pendingPayoutPaise,
    assignedBatchIds: c.assignedBatchIds,
    onboardedAt: c.onboardedAt,
  }));
}

export async function getFranchiseCenterById(franchiseId: string) {
  const center = await FranchiseCenterModel.findById(franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);
  return center;
}

export async function getFranchiseCenterByOwner(ownerUserId: string) {
  const center = await FranchiseCenterModel.findOne({ ownerUserId }).lean().exec();
  if (!center) throw new AppError("No franchise center linked to this user", 404);
  return center;
}

export async function updateFranchiseCenter(
  franchiseId: string,
  input: {
    centerName?: string;
    city?: string;
    address?: string;
    commissionPercent?: number;
    commissionFlatPaise?: number;
    commissionModel?: string;
    status?: string;
  },
  performedBy: string
) {
  const center = await FranchiseCenterModel.findById(franchiseId).exec();
  if (!center) throw new AppError("Franchise center not found", 404);

  if (input.centerName !== undefined) center.centerName = input.centerName.trim();
  if (input.city !== undefined) center.city = input.city.trim();
  if (input.address !== undefined) center.address = input.address.trim();
  if (input.commissionPercent !== undefined) center.commissionPercent = input.commissionPercent;
  if (input.commissionFlatPaise !== undefined) center.commissionFlatPaise = input.commissionFlatPaise;
  if (input.commissionModel !== undefined) {
    center.commissionModel = input.commissionModel as typeof center.commissionModel;
  }
  if (input.status !== undefined) center.status = input.status as typeof center.status;

  await center.save();
  await createAuditLog("FRANCHISE_CENTER_UPDATED", performedBy, "FranchiseCenter", String(center._id));
  return center;
}

/**
 * Soft-delete a franchise center:
 *  - Sets status to CLOSED
 *  - Suspends the franchise owner's user account
 *  - Returns the closed franchise for confirmation
 *
 * Does NOT delete related data (batches, enrollments, transactions, key pools)
 * — these are retained for historical/audit purposes.
 */
export async function deleteFranchiseCenter(franchiseId: string, performedBy: string) {
  const center = await FranchiseCenterModel.findById(franchiseId).exec();
  if (!center) throw new AppError("Franchise center not found", 404);

  if (center.status === FRANCHISE_STATUS.CLOSED) {
    throw new AppError("Franchise center is already closed", 400);
  }

  // Mark center as closed
  center.status = FRANCHISE_STATUS.CLOSED;
  await center.save();

  // Suspend the franchise owner's user account
  if (center.ownerUserId) {
    await UserModel.findByIdAndUpdate(center.ownerUserId, {
      $set: { status: ACCOUNT_STATUS.SUSPENDED },
    }).exec();
  }

  await createAuditLog("FRANCHISE_CENTER_DELETED", performedBy, "FranchiseCenter", String(center._id), {
    franchiseCode: center.franchiseCode,
    centerName: center.centerName,
  });

  return {
    id: String(center._id),
    franchiseCode: center.franchiseCode,
    centerName: center.centerName,
    status: center.status,
  };
}

// ─── Franchise Batch Operations ───────────────────────────────────────────────

/**
 * Franchise creates a batch picking from global courses.
 * The batch is tagged with franchiseId and added to franchise's assignedBatchIds.
 */
export async function franchiseCreateBatch(input: {
  franchiseId: string;
  name: string;
  courseIds: string[];
  trainerId?: string;
  startDate: Date;
  endDate?: Date;
  zoomLink?: string;
  createdBy: string;
}) {
  const center = await FranchiseCenterModel.findById(input.franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);
  if (center.status !== FRANCHISE_STATUS.ACTIVE) {
    throw new AppError("Franchise center is not active", 403);
  }

  // Validate courses exist and are not archived
  const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
  for (const cid of input.courseIds) {
    const filter = OBJECT_ID_REGEX.test(cid)
      ? { _id: cid }
      : { courseId: cid };
    const course = await CourseModel.findOne(filter).lean().exec();
    if (!course) throw new AppError(`Course not found: ${cid}`, 404);
    if (course.status === COURSE_STATUS.ARCHIVED) {
      throw new AppError(`Course "${course.title}" is archived`, 400);
    }
  }

  // Resolve trainer — use provided trainerId, or default to franchise owner
  let trainerId = center.ownerUserId;
  if (input.trainerId?.trim()) {
    // Verify the trainer belongs to this franchise
    const trainer = await UserModel.findById(input.trainerId.trim()).lean().exec();
    if (!trainer) throw new AppError("Trainer not found", 404);
    const trainerFranchiseId = (trainer as { franchiseId?: string }).franchiseId;
    const isOwnTrainer = trainerFranchiseId === input.franchiseId;
    const isOwner = String(trainer._id) === center.ownerUserId;
    if (!isOwnTrainer && !isOwner) {
      throw new AppError("This trainer does not belong to your franchise", 403);
    }
    trainerId = String(trainer._id);
  }

  // Use existing batch creation logic
  let batch;
  try {
    batch = await createBatchService({
      name: input.name.trim(),
      courseIds: input.courseIds,
      trainerId,
      startDate: input.startDate,
      endDate: input.endDate,
      zoomLink: input.zoomLink,
      createdBy: input.createdBy,
      visibility: "PRIVATE",
    });
  } catch (err) {
    // Provide franchise-friendly error for headerImage/module issues
    const msg = err instanceof AppError ? err.message : String(err);
    if (msg.includes("course card image")) {
      throw new AppError(`${msg}. Please contact the parent admin to add a course card image.`, 400);
    }
    if (msg.includes("has no modules")) {
      throw new AppError(`${msg}. Please contact the parent admin to add content to this course.`, 400);
    }
    throw err;
  }

  // Tag batch with franchiseId and add to franchise's assigned batches
  // If either fails, clean up to avoid orphan data
  try {
    await BatchModel.updateOne(
      { _id: batch.id },
      { $set: { franchiseId: input.franchiseId } }
    ).exec();

    await FranchiseCenterModel.updateOne(
      { _id: input.franchiseId },
      { $addToSet: { assignedBatchIds: batch.id } }
    ).exec();
  } catch (tagErr) {
    // Rollback: delete the batch if tagging fails
    await BatchModel.deleteOne({ _id: batch.id }).exec().catch(() => {});
    throw new AppError("Failed to link batch to franchise. Batch was not created.", 500);
  }

  await createAuditLog("FRANCHISE_BATCH_CREATED", input.createdBy, "Batch", batch.id, {
    franchiseId: input.franchiseId,
  });

  return batch;
}

/**
 * List batches that belong to a franchise.
 */
export async function listFranchiseBatches(franchiseId: string) {
  const center = await FranchiseCenterModel.findById(franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);

  const batches = await BatchModel.find({
    _id: { $in: center.assignedBatchIds },
  })
    .select("-courseSnapshots.modules.content -courseSnapshot.modules.content")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  // Count students per batch
  const batchIds = batches.map((b) => String(b._id));
  const enrollmentCounts = batchIds.length > 0
    ? await EnrollmentModel.aggregate<{ _id: string; count: number }>([
        { $match: { batchId: { $in: batchIds } } },
        { $group: { _id: "$batchId", count: { $sum: 1 } } },
      ])
    : [];
  const countMap = new Map(enrollmentCounts.map((e) => [String(e._id), e.count]));

  return batches.map((b) => {
    const snapshots = getBatchCourseSnapshots(b as Parameters<typeof getBatchCourseSnapshots>[0]);
    return {
      id: String(b._id),
      batchId: (b as { batchId?: string }).batchId,
      name: b.name,
      courseSnapshots: snapshots,
      startDate: b.startDate,
      endDate: b.endDate,
      status: b.status,
      studentsCount: countMap.get(String(b._id)) ?? 0,
    };
  });
}

// ─── Franchise Student Operations ─────────────────────────────────────────────

/**
 * Franchise registers a new student and enrolls them into one of their batches.
 */
export async function franchiseRegisterAndEnroll(input: {
  franchiseId: string;
  studentName: string;
  studentMobile: string;
  studentEmail?: string;
  studentAge: number;
  studentUsername: string;
  studentPassword?: string;
  batchId: string;
  paymentMode: "CASH" | "ONLINE" | "FREE";
  amountPaise?: number;
  consumeLicenseKey?: boolean;
  createdBy: string;
}) {
  const center = await FranchiseCenterModel.findById(input.franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);
  if (center.status !== FRANCHISE_STATUS.ACTIVE) {
    throw new AppError("Franchise center is not active", 403);
  }

  // Validate required fields
  if (!input.studentName?.trim()) throw new AppError("Student name is required", 400);
  if (!input.studentUsername?.trim()) throw new AppError("Student username is required", 400);
  if (!input.studentMobile?.trim()) throw new AppError("Student mobile is required", 400);
  if (!input.batchId?.trim()) throw new AppError("Batch ID is required", 400);
  if (!input.studentAge || input.studentAge < 7) throw new AppError("Student age must be at least 7", 400);

  // Verify batch belongs to this franchise
  if (!center.assignedBatchIds.includes(input.batchId)) {
    throw new AppError("This batch is not assigned to your franchise", 403);
  }

  // If consuming license key, find the course from batch snapshot and consume from pool
  if (input.consumeLicenseKey !== false) {
    const batch = await BatchModel.findById(input.batchId).lean().exec();
    if (batch) {
      const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
      // Try to consume a key for each course in the batch
      for (const snap of snaps) {
        const courseId = (snap as { courseId?: string }).courseId;
        if (courseId) {
          const consumed = await consumeFranchiseKey(input.franchiseId, courseId);
          if (!consumed) {
            throw new AppError(
              `No license keys available for course "${(snap as { title?: string }).title ?? courseId}". Request more keys first.`,
              400
            );
          }
        }
      }
    }
  }

  // Create student account
  const student = await createStudent({
    username: input.studentUsername,
    name: input.studentName,
    mobile: input.studentMobile,
    email: input.studentEmail,
    password: input.studentPassword,
    age: input.studentAge,
  });

  // Enroll student in the batch
  const enrollment = await createEnrollment({
    studentId: student.id,
    batchId: input.batchId,
    createdBy: input.createdBy,
    skipAutoInvoice: input.paymentMode === "FREE",
  });

  // Tag enrollment with franchiseId
  await EnrollmentModel.updateOne(
    { _id: enrollment.id },
    { $set: { franchiseId: input.franchiseId } }
  ).exec();

  // Record transaction if payment was collected
  if (input.paymentMode === "CASH" && input.amountPaise && input.amountPaise > 0) {
    await recordFranchiseTransaction({
      franchiseId: input.franchiseId,
      type: FRANCHISE_TRANSACTION_TYPE.OFFLINE_COLLECTION,
      amountPaise: input.amountPaise,
      direction: "CREDIT",
      studentId: student.id,
      enrollmentId: enrollment.id,
      batchId: input.batchId,
      note: `Cash collected from ${input.studentName}`,
      recordedBy: input.createdBy,
    });
  }

  // Update franchise stats
  await FranchiseCenterModel.updateOne(
    { _id: input.franchiseId },
    { $inc: { totalStudents: 1 } }
  ).exec();

  return {
    studentId: student.id,
    studentUsername: student.username,
    enrollmentId: enrollment.id,
    batchId: enrollment.batchId,
  };
}

/**
 * Franchise enrolls an existing student into one of their batches.
 */
export async function franchiseEnrollExistingStudent(input: {
  franchiseId: string;
  studentId: string;
  batchId: string;
  paymentMode: "CASH" | "ONLINE" | "FREE";
  amountPaise?: number;
  createdBy: string;
}) {
  const center = await FranchiseCenterModel.findById(input.franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);
  if (!center.assignedBatchIds.includes(input.batchId)) {
    throw new AppError("This batch is not assigned to your franchise", 403);
  }

  const enrollment = await createEnrollment({
    studentId: input.studentId,
    batchId: input.batchId,
    createdBy: input.createdBy,
    skipAutoInvoice: input.paymentMode === "FREE",
  });

  await EnrollmentModel.updateOne(
    { _id: enrollment.id },
    { $set: { franchiseId: input.franchiseId } }
  ).exec();

  if (input.paymentMode === "CASH" && input.amountPaise && input.amountPaise > 0) {
    const student = await UserModel.findById(input.studentId).select("name").lean().exec();
    await recordFranchiseTransaction({
      franchiseId: input.franchiseId,
      type: FRANCHISE_TRANSACTION_TYPE.OFFLINE_COLLECTION,
      amountPaise: input.amountPaise,
      direction: "CREDIT",
      studentId: input.studentId,
      enrollmentId: enrollment.id,
      batchId: input.batchId,
      note: `Cash collected from ${student?.name ?? "student"}`,
      recordedBy: input.createdBy,
    });
  }

  await FranchiseCenterModel.updateOne(
    { _id: input.franchiseId },
    { $inc: { totalStudents: 1 } }
  ).exec();

  return enrollment;
}

/**
 * List students enrolled through a franchise.
 */
export async function listFranchiseStudents(franchiseId: string, page = 1, limit = 50) {
  const effectiveLimit = Math.min(100, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * effectiveLimit;

  const [enrollments, total] = await Promise.all([
    EnrollmentModel.find({ franchiseId })
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(effectiveLimit)
      .lean()
      .exec(),
    EnrollmentModel.countDocuments({ franchiseId }).exec(),
  ]);

  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const users = await UserModel.find({ _id: { $in: studentIds } })
    .select("name username mobile email")
    .lean()
    .exec();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const batchIds = [...new Set(enrollments.map((e) => e.batchId))];
  const batches = await BatchModel.find({ _id: { $in: batchIds } })
    .select("name batchId")
    .lean()
    .exec();
  const batchMap = new Map(batches.map((b) => [String(b._id), b]));

  const rows = enrollments.map((e) => {
    const user = userMap.get(e.studentId);
    const batch = batchMap.get(e.batchId);
    return {
      enrollmentId: String(e._id),
      studentId: e.studentId,
      studentName: (user as { name?: string })?.name ?? "",
      studentUsername: (user as { username?: string })?.username ?? "",
      studentMobile: (user as { mobile?: string })?.mobile ?? "",
      batchId: e.batchId,
      batchName: batch?.name ?? "",
      enrolledAt: e.enrolledAt,
      status: e.status,
    };
  });

  return { rows, total, page, limit: effectiveLimit };
}

// ─── Franchise Transactions & Earnings ────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function recordFranchiseTransaction(input: {
  franchiseId: string;
  type: string;
  amountPaise: number;
  direction: "CREDIT" | "DEBIT";
  studentId?: string;
  enrollmentId?: string;
  invoiceId?: string;
  batchId?: string;
  note?: string;
  recordedBy: string;
}) {
  const txn = await FranchiseTransactionModel.create({
    franchiseId: input.franchiseId,
    type: input.type,
    amountPaise: input.amountPaise,
    direction: input.direction,
    studentId: input.studentId,
    enrollmentId: input.enrollmentId,
    invoiceId: input.invoiceId,
    batchId: input.batchId,
    note: input.note || "",
    recordedBy: input.recordedBy,
    month: getCurrentMonth(),
  });

  // Update franchise cached revenue (only for actual collections, not commission)
  if (input.direction === "CREDIT" && input.type !== FRANCHISE_TRANSACTION_TYPE.COMMISSION) {
    await FranchiseCenterModel.updateOne(
      { _id: input.franchiseId },
      { $inc: { totalRevenuePaise: input.amountPaise } }
    ).exec();
  }

  return txn;
}

export async function getFranchiseEarnings(franchiseId: string, month?: string) {
  const filter: Record<string, unknown> = { franchiseId };
  if (month) filter.month = month;

  const transactions = await FranchiseTransactionModel.find(filter)
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  let totalCollected = 0;
  let totalCommission = 0;
  let totalPayouts = 0;

  for (const txn of transactions) {
    if (txn.direction === "CREDIT") {
      if (txn.type === FRANCHISE_TRANSACTION_TYPE.COMMISSION) {
        totalCommission += txn.amountPaise;
      } else {
        totalCollected += txn.amountPaise;
      }
    }
    if (txn.direction === "DEBIT" && txn.type === FRANCHISE_TRANSACTION_TYPE.PAYOUT) {
      totalPayouts += txn.amountPaise;
    }
  }

  return {
    totalCollectedPaise: totalCollected,
    totalCommissionPaise: totalCommission,
    totalPayoutsPaise: totalPayouts,
    pendingPayoutPaise: totalCommission - totalPayouts,
    transactions: transactions.slice(0, 50),
  };
}

export async function getFranchiseDashboard(franchiseId: string) {
  const center = await FranchiseCenterModel.findById(franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);

  const currentMonth = getCurrentMonth();

  const [totalStudents, monthEnrollments, monthTransactions, batchCount] = await Promise.all([
    EnrollmentModel.countDocuments({ franchiseId }),
    EnrollmentModel.countDocuments({
      franchiseId,
      enrolledAt: { $gte: new Date(`${currentMonth}-01`) },
    }),
    FranchiseTransactionModel.find({ franchiseId, month: currentMonth }).lean().exec(),
    BatchModel.countDocuments({ _id: { $in: center.assignedBatchIds } }),
  ]);

  let monthRevenue = 0;
  let monthCommission = 0;
  for (const txn of monthTransactions) {
    if (txn.direction === "CREDIT") {
      if (txn.type === FRANCHISE_TRANSACTION_TYPE.COMMISSION) {
        monthCommission += txn.amountPaise;
      } else {
        monthRevenue += txn.amountPaise;
      }
    }
  }

  return {
    franchiseCode: center.franchiseCode,
    centerName: center.centerName,
    city: center.city,
    status: center.status,
    totalStudents,
    totalBatches: batchCount,
    thisMonth: {
      newEnrollments: monthEnrollments,
      revenuePaise: monthRevenue,
      commissionPaise: monthCommission,
    },
    commissionModel: center.commissionModel,
    commissionPercent: center.commissionPercent,
    pendingPayoutPaise: center.pendingPayoutPaise,
  };
}

// ─── Franchise Payout Management (Super Admin) ────────────────────────────────

export async function createFranchisePayout(input: {
  franchiseId: string;
  month: string;
  amountPaise: number;
  paymentReference?: string;
  note?: string;
  processedBy: string;
}) {
  if (!input.month?.trim()) throw new AppError("month is required", 400);
  if (!input.amountPaise || input.amountPaise <= 0) throw new AppError("amountPaise must be positive", 400);

  // Verify payout doesn't exceed pending amount
  const center = await FranchiseCenterModel.findById(input.franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);
  if (input.amountPaise > (center.pendingPayoutPaise ?? 0)) {
    throw new AppError("Payout amount exceeds pending balance", 400);
  }

  const payout = await FranchisePayoutModel.create({
    franchiseId: input.franchiseId,
    month: input.month,
    amountPaise: input.amountPaise,
    status: FRANCHISE_PAYOUT_STATUS.PAID,
    paidAt: new Date(),
    paymentReference: input.paymentReference || "",
    note: input.note || "",
    processedBy: input.processedBy,
  });

  // Record as debit transaction
  await recordFranchiseTransaction({
    franchiseId: input.franchiseId,
    type: FRANCHISE_TRANSACTION_TYPE.PAYOUT,
    amountPaise: input.amountPaise,
    direction: "DEBIT",
    note: `Payout for ${input.month}: ${input.paymentReference || ""}`.trim(),
    recordedBy: input.processedBy,
  });

  // Update pending payout
  await FranchiseCenterModel.updateOne(
    { _id: input.franchiseId },
    { $inc: { pendingPayoutPaise: -input.amountPaise } }
  ).exec();

  return payout;
}

export async function listFranchisePayouts(franchiseId: string) {
  return FranchisePayoutModel.find({ franchiseId })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
}

// ─── Global Course Library (for franchise to browse) ──────────────────────────

export async function listGlobalCoursesForFranchise() {
  const courses = await CourseModel.find({
    status: { $ne: COURSE_STATUS.ARCHIVED },
  })
    .select("courseId title description headerImageUrl durationText ageGroup modules version")
    .sort({ title: 1 })
    .lean()
    .exec();

  return courses.map((c) => ({
    id: String(c._id),
    courseId: (c as { courseId?: string }).courseId ?? String(c._id),
    title: c.title,
    description: c.description,
    headerImageUrl: (c as { headerImageUrl?: string }).headerImageUrl ?? "",
    durationText: (c as { durationText?: string }).durationText ?? "",
    ageGroup: (c as { ageGroup?: string }).ageGroup ?? "",
    modulesCount: Array.isArray(c.modules) ? c.modules.length : 0,
  }));
}

// ─── Franchise License Key Pool System ─────────────────────────────────────────

import { FranchiseKeyPoolModel, FranchiseKeyRequestModel } from "../models/FranchiseKeyPool.model.js";

/**
 * Get franchise's key pool — how many keys they own per course.
 */
export async function getFranchiseKeyPools(franchiseId: string) {
  const pools = await FranchiseKeyPoolModel.find({ franchiseId }).lean().exec();

  const courseIds = pools.map((p) => p.courseId);
  const courses = courseIds.length > 0
    ? await CourseModel.find({
        $or: [
          { courseId: { $in: courseIds } },
          { _id: { $in: courseIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id)) } },
        ],
      }).select("courseId title").lean().exec()
    : [];
  const titleMap = new Map<string, string>();
  for (const c of courses) {
    if ((c as { courseId?: string }).courseId) titleMap.set((c as { courseId?: string }).courseId!, c.title);
    titleMap.set(String(c._id), c.title);
  }

  return pools.map((p) => ({
    courseId: p.courseId,
    courseTitle: titleMap.get(p.courseId) ?? p.courseId,
    totalAllocated: p.totalAllocated,
    totalUsed: p.totalUsed,
    available: p.totalAllocated - p.totalUsed,
  }));
}

/**
 * Franchise uses 1 key from their pool when enrolling a student.
 * Returns false if no keys available.
 */
export async function consumeFranchiseKey(franchiseId: string, courseId: string): Promise<boolean> {
  const result = await FranchiseKeyPoolModel.findOneAndUpdate(
    {
      franchiseId,
      courseId,
      $expr: { $gt: ["$totalAllocated", "$totalUsed"] },
    },
    { $inc: { totalUsed: 1 } },
    { new: true }
  ).exec();
  return result !== null;
}

/**
 * Franchise submits a request to buy more keys.
 */
export async function createFranchiseKeyRequest(input: {
  franchiseId: string;
  courseId: string;
  requestedCount: number;
  paymentProofUrl?: string;
  note?: string;
  requestedBy: string;
}) {
  if (!input.courseId?.trim()) throw new AppError("courseId is required", 400);
  if (!input.requestedCount || input.requestedCount < 1) throw new AppError("requestedCount must be at least 1", 400);

  const request = await FranchiseKeyRequestModel.create({
    franchiseId: input.franchiseId,
    courseId: input.courseId.trim(),
    requestedCount: input.requestedCount,
    paymentProofUrl: input.paymentProofUrl?.trim() || "",
    note: input.note?.trim() || "",
    requestedBy: input.requestedBy,
  });

  return { id: String(request._id), status: request.status, requestedCount: request.requestedCount };
}

/**
 * Franchise views their key purchase requests.
 */
export async function listFranchiseKeyRequests(franchiseId: string) {
  const requests = await FranchiseKeyRequestModel.find({ franchiseId }).sort({ createdAt: -1 }).lean().exec();

  const courseIds = [...new Set(requests.map((r) => r.courseId))];
  const courses = courseIds.length > 0
    ? await CourseModel.find({
        $or: [{ courseId: { $in: courseIds } }, { _id: { $in: courseIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id)) } }],
      }).select("courseId title").lean().exec()
    : [];
  const titleMap = new Map<string, string>();
  for (const c of courses) {
    if ((c as { courseId?: string }).courseId) titleMap.set((c as { courseId?: string }).courseId!, c.title);
    titleMap.set(String(c._id), c.title);
  }

  return requests.map((r) => ({
    id: String(r._id),
    courseId: r.courseId,
    courseTitle: titleMap.get(r.courseId) ?? r.courseId,
    requestedCount: r.requestedCount,
    allocatedCount: r.allocatedCount,
    paymentProofUrl: r.paymentProofUrl,
    note: r.note,
    status: r.status,
    rejectionReason: r.rejectionReason,
    createdAt: (r as { createdAt?: Date }).createdAt ? new Date((r as { createdAt?: Date }).createdAt!).toISOString() : "",
    processedAt: r.processedAt ? new Date(r.processedAt).toISOString() : null,
  }));
}

/**
 * Parent approves a key request — allocates keys to the franchise pool.
 */
export async function approveKeyRequest(input: { requestId: string; allocatedCount: number; processedBy: string }) {
  if (!input.allocatedCount || input.allocatedCount < 1) throw new AppError("allocatedCount must be at least 1", 400);

  const request = await FranchiseKeyRequestModel.findById(input.requestId).exec();
  if (!request) throw new AppError("Key request not found", 404);
  if (request.status !== "PENDING") throw new AppError("Request is already processed", 400);

  request.status = "APPROVED";
  request.allocatedCount = input.allocatedCount;
  request.processedBy = input.processedBy;
  request.processedAt = new Date();
  await request.save();

  await FranchiseKeyPoolModel.findOneAndUpdate(
    { franchiseId: request.franchiseId, courseId: request.courseId },
    { $inc: { totalAllocated: input.allocatedCount } },
    { upsert: true, new: true }
  ).exec();

  return { id: String(request._id), status: "APPROVED", allocatedCount: input.allocatedCount };
}

/**
 * Parent rejects a key request.
 */
export async function rejectKeyRequest(input: { requestId: string; reason?: string; processedBy: string }) {
  const request = await FranchiseKeyRequestModel.findById(input.requestId).exec();
  if (!request) throw new AppError("Key request not found", 404);
  if (request.status !== "PENDING") throw new AppError("Request is already processed", 400);

  request.status = "REJECTED";
  request.rejectionReason = input.reason?.trim() || "";
  request.processedBy = input.processedBy;
  request.processedAt = new Date();
  await request.save();

  return { id: String(request._id), status: "REJECTED" };
}

/**
 * Parent directly allocates keys to a franchise (without a request).
 */
export async function directAllocateKeys(input: { franchiseId: string; courseId: string; count: number; processedBy: string }) {
  if (!input.count || input.count < 1) throw new AppError("count must be at least 1", 400);
  if (!input.courseId?.trim()) throw new AppError("courseId is required", 400);

  await FranchiseKeyPoolModel.findOneAndUpdate(
    { franchiseId: input.franchiseId, courseId: input.courseId.trim() },
    { $inc: { totalAllocated: input.count } },
    { upsert: true, new: true }
  ).exec();

  return { franchiseId: input.franchiseId, courseId: input.courseId, allocated: input.count };
}

/**
 * Franchise assigns a license key to a student, consuming one from their pool.
 * This creates an enrollment (if not already enrolled) and marks one key as used.
 */
export async function franchiseAssignKeyToStudent(input: {
  franchiseId: string;
  studentId: string;
  batchId: string;
  courseId: string;
  performedBy: string;
}): Promise<{ enrollmentId: string; keysRemaining: number }> {
  const { franchiseId, studentId, batchId, courseId, performedBy } = input;

  if (!studentId?.trim()) throw new AppError("studentId is required", 400);
  if (!batchId?.trim()) throw new AppError("batchId is required", 400);
  if (!courseId?.trim()) throw new AppError("courseId is required", 400);

  // Verify franchise owns the batch
  const center = await FranchiseCenterModel.findById(franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);
  if (!center.assignedBatchIds.includes(batchId)) {
    throw new AppError("This batch is not assigned to your franchise", 403);
  }

  // Consume one key from pool (atomic)
  const consumed = await consumeFranchiseKey(franchiseId, courseId);
  if (!consumed) {
    throw new AppError("No license keys available for this course. Request more keys first.", 400);
  }

  // Check if student already enrolled
  const existing = await EnrollmentModel.findOne({ studentId, batchId }).lean().exec();
  let enrollmentId: string;

  if (existing) {
    enrollmentId = String(existing._id);
  } else {
    // Create enrollment
    const enrollment = await createEnrollment({
      studentId,
      batchId,
      createdBy: performedBy,
      skipAutoInvoice: true,
    });
    enrollmentId = enrollment.id;

    // Tag enrollment with franchiseId
    await EnrollmentModel.updateOne(
      { _id: enrollmentId },
      { $set: { franchiseId } }
    ).exec();

    // Increment franchise student count
    await FranchiseCenterModel.updateOne(
      { _id: franchiseId },
      { $inc: { totalStudents: 1 } }
    ).exec();
  }

  // Audit
  await createAuditLog(
    "FRANCHISE_KEY_ASSIGNED" as Parameters<typeof createAuditLog>[0],
    performedBy,
    "Enrollment",
    enrollmentId,
    { franchiseId, courseId, studentId }
  );

  // Get remaining keys
  const pool = await FranchiseKeyPoolModel.findOne({ franchiseId, courseId }).lean().exec();
  const keysRemaining = pool ? pool.totalAllocated - pool.totalUsed : 0;

  return { enrollmentId, keysRemaining };
}

/**
 * Parent views all pending key requests across all franchises.
 */
export async function listAllPendingKeyRequests() {
  const requests = await FranchiseKeyRequestModel.find({ status: "PENDING" }).sort({ createdAt: -1 }).lean().exec();

  const franchiseIds = [...new Set(requests.map((r) => r.franchiseId))];
  const centers = franchiseIds.length > 0
    ? await FranchiseCenterModel.find({ _id: { $in: franchiseIds } }).select("franchiseCode centerName").lean().exec()
    : [];
  const centerMap = new Map(centers.map((c) => [String(c._id), c]));

  const courseIds = [...new Set(requests.map((r) => r.courseId))];
  const courses = courseIds.length > 0
    ? await CourseModel.find({
        $or: [{ courseId: { $in: courseIds } }, { _id: { $in: courseIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id)) } }],
      }).select("courseId title").lean().exec()
    : [];
  const titleMap = new Map<string, string>();
  for (const c of courses) {
    if ((c as { courseId?: string }).courseId) titleMap.set((c as { courseId?: string }).courseId!, c.title);
    titleMap.set(String(c._id), c.title);
  }

  return requests.map((r) => {
    const center = centerMap.get(r.franchiseId);
    return {
      id: String(r._id),
      franchiseId: r.franchiseId,
      franchiseCode: center?.franchiseCode ?? "",
      centerName: center?.centerName ?? "",
      courseId: r.courseId,
      courseTitle: titleMap.get(r.courseId) ?? r.courseId,
      requestedCount: r.requestedCount,
      paymentProofUrl: r.paymentProofUrl,
      note: r.note,
      createdAt: (r as { createdAt?: Date }).createdAt ? new Date((r as { createdAt?: Date }).createdAt!).toISOString() : "",
    };
  });
}

// ─── Franchise Trainer Management ─────────────────────────────────────────────

/**
 * Franchise creates a trainer scoped to their center.
 * The trainer is tagged with franchiseId and can only be assigned to franchise's batches.
 */
export async function franchiseCreateTrainer(input: {
  franchiseId: string;
  name: string;
  username: string;
  email: string;
  mobile: string;
  password: string;
  createdBy: string;
}) {
  const center = await FranchiseCenterModel.findById(input.franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);
  if (center.status !== FRANCHISE_STATUS.ACTIVE) {
    throw new AppError("Franchise center is not active", 403);
  }

  const { createTrainer, createTrainerWithAutoUsername } = await import("./auth.service.js");

  const usernameProvided = input.username.trim();
  const result = usernameProvided
    ? await createTrainer({
        username: usernameProvided,
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        password: input.password,
      })
    : await createTrainerWithAutoUsername({
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        password: input.password,
      });

  // Tag trainer with franchiseId
  await UserModel.updateOne(
    { _id: result.id },
    { $set: { franchiseId: input.franchiseId } }
  ).exec();

  await createAuditLog("FRANCHISE_TRAINER_CREATED" as Parameters<typeof createAuditLog>[0], input.createdBy, "User", result.id, {
    franchiseId: input.franchiseId,
  });

  return {
    id: result.id,
    username: result.username,
    name: input.name,
  };
}

/**
 * List trainers that belong to a franchise.
 */
export async function listFranchiseTrainers(franchiseId: string) {
  const trainers = await UserModel.find({
    franchiseId,
    roles: ROLE.TRAINER,
  })
    .select("_id username name email mobile status createdAt")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return trainers.map((t) => ({
    id: String(t._id),
    username: t.username ?? "",
    name: t.name,
    email: (t as { email?: string }).email ?? "",
    mobile: (t as { mobile?: string }).mobile ?? "",
    status: t.status,
    createdAt: (t as { createdAt?: Date }).createdAt,
  }));
}

/**
 * Franchise updates a trainer's status (suspend/activate). Cannot delete.
 */
export async function franchiseUpdateTrainerStatus(input: {
  franchiseId: string;
  trainerId: string;
  status: string;
  performedBy: string;
}) {
  const trainer = await UserModel.findById(input.trainerId).exec();
  if (!trainer) throw new AppError("Trainer not found", 404);
  if ((trainer as { franchiseId?: string }).franchiseId !== input.franchiseId) {
    throw new AppError("This trainer does not belong to your franchise", 403);
  }
  if (!trainer.roles.includes(ROLE.TRAINER)) {
    throw new AppError("User is not a trainer", 400);
  }

  const validStatuses = [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.SUSPENDED];
  if (!validStatuses.includes(input.status as typeof ACCOUNT_STATUS.ACTIVE)) {
    throw new AppError("Invalid status. Use ACTIVE or SUSPENDED.", 400);
  }

  trainer.status = input.status as typeof trainer.status;
  await trainer.save();

  return { id: String(trainer._id), status: trainer.status };
}
