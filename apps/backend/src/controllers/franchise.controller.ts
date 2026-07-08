/**
 * Franchise Controller — HTTP request handlers for franchise routes.
 */

import type { Request, Response } from "express";
import * as franchiseService from "../services/franchise.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function isSuperAdmin(req: Request): boolean {
  return req.user?.roles?.includes(ROLE.SUPER_ADMIN) ?? false;
}

async function resolveFranchiseId(req: Request): Promise<string> {
  if (isSuperAdmin(req) && req.params.franchiseId) {
    return req.params.franchiseId;
  }
  const center = await franchiseService.getFranchiseCenterByOwner(getUserId(req));
  return String(center._id);
}

// ─── Super Admin: Franchise Center Management ─────────────────────────────────

export const createFranchiseCenter = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.createFranchiseCenter({
    franchiseCode: String(body.franchiseCode ?? ""),
    centerName: String(body.centerName ?? ""),
    city: String(body.city ?? ""),
    address: body.address ? String(body.address) : undefined,
    ownerName: String(body.ownerName ?? ""),
    ownerMobile: String(body.ownerMobile ?? ""),
    ownerEmail: body.ownerEmail ? String(body.ownerEmail) : undefined,
    ownerPassword: String(body.ownerPassword ?? ""),
    commissionModel: body.commissionModel ? String(body.commissionModel) : undefined,
    commissionPercent: body.commissionPercent != null ? Number(body.commissionPercent) : undefined,
    commissionFlatPaise: body.commissionFlatPaise != null ? Number(body.commissionFlatPaise) : undefined,
    createdBy: getUserId(req),
  });
  successRes(res, result, undefined, 201);
});

export const listFranchiseCenters = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const city = req.query.city ? String(req.query.city) : undefined;
  const centers = await franchiseService.listFranchiseCenters({ status, city });
  successRes(res, { centers });
});

export const getFranchiseCenter = asyncHandler(async (req: Request, res: Response) => {
  const center = await franchiseService.getFranchiseCenterById(req.params.franchiseId);
  successRes(res, center);
});

export const updateFranchiseCenter = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.updateFranchiseCenter(
    req.params.franchiseId,
    {
      centerName: body.centerName != null ? String(body.centerName) : undefined,
      city: body.city != null ? String(body.city) : undefined,
      address: body.address != null ? String(body.address) : undefined,
      commissionPercent: body.commissionPercent != null ? Number(body.commissionPercent) : undefined,
      commissionFlatPaise: body.commissionFlatPaise != null ? Number(body.commissionFlatPaise) : undefined,
      commissionModel: body.commissionModel != null ? String(body.commissionModel) : undefined,
      status: body.status != null ? String(body.status) : undefined,
    },
    getUserId(req)
  );
  successRes(res, result);
});

// ─── Super Admin: Payout Management ──────────────────────────────────────────

export const createPayout = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.createFranchisePayout({
    franchiseId: req.params.franchiseId,
    month: String(body.month ?? ""),
    amountPaise: Number(body.amountPaise ?? 0),
    paymentReference: body.paymentReference ? String(body.paymentReference) : undefined,
    note: body.note ? String(body.note) : undefined,
    processedBy: getUserId(req),
  });
  successRes(res, result, undefined, 201);
});

export const listPayouts = asyncHandler(async (req: Request, res: Response) => {
  const payouts = await franchiseService.listFranchisePayouts(req.params.franchiseId);
  successRes(res, { payouts });
});

// ─── Super Admin: Key Request Management ─────────────────────────────────────

export const listPendingKeyRequests = asyncHandler(async (_req: Request, res: Response) => {
  const requests = await franchiseService.listAllPendingKeyRequests();
  successRes(res, { requests });
});

export const approveKeyRequest = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.approveKeyRequest({
    requestId: req.params.requestId,
    allocatedCount: Number(body.allocatedCount ?? 0),
    processedBy: getUserId(req),
  });
  successRes(res, result);
});

export const rejectKeyRequest = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.rejectKeyRequest({
    requestId: req.params.requestId,
    reason: body.reason ? String(body.reason) : undefined,
    processedBy: getUserId(req),
  });
  successRes(res, result);
});

export const directAllocateKeys = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.directAllocateKeys({
    franchiseId: req.params.franchiseId,
    courseId: String(body.courseId ?? ""),
    count: Number(body.count ?? 0),
    processedBy: getUserId(req),
  });
  successRes(res, result, undefined, 201);
});

// ─── Franchise Admin: Dashboard ──────────────────────────────────────────────

export const getMyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const dashboard = await franchiseService.getFranchiseDashboard(franchiseId);
  successRes(res, dashboard);
});

// ─── Franchise Admin: Courses (read-only global library) ─────────────────────

export const listGlobalCourses = asyncHandler(async (_req: Request, res: Response) => {
  const courses = await franchiseService.listGlobalCoursesForFranchise();
  successRes(res, { courses });
});

// ─── Franchise Admin: Batches ────────────────────────────────────────────────

export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.franchiseCreateBatch({
    franchiseId,
    name: String(body.name ?? ""),
    courseIds: Array.isArray(body.courseIds) ? body.courseIds.map(String) : [],
    trainerId: body.trainerId ? String(body.trainerId) : undefined,
    startDate: new Date(String(body.startDate)),
    endDate: body.endDate ? new Date(String(body.endDate)) : undefined,
    zoomLink: body.zoomLink ? String(body.zoomLink) : undefined,
    createdBy: getUserId(req),
  });
  successRes(res, result, undefined, 201);
});

export const listMyBatches = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const batches = await franchiseService.listFranchiseBatches(franchiseId);
  successRes(res, { batches });
});

// ─── Franchise Admin: Students ───────────────────────────────────────────────

export const registerAndEnrollStudent = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.franchiseRegisterAndEnroll({
    franchiseId,
    studentName: String(body.studentName ?? ""),
    studentMobile: String(body.studentMobile ?? ""),
    studentEmail: body.studentEmail ? String(body.studentEmail) : undefined,
    studentAge: Number(body.studentAge ?? 0),
    studentUsername: String(body.studentUsername ?? ""),
    studentPassword: body.studentPassword ? String(body.studentPassword) : undefined,
    batchId: String(body.batchId ?? ""),
    paymentMode: (body.paymentMode as "CASH" | "ONLINE" | "FREE") ?? "FREE",
    amountPaise: body.amountPaise != null ? Number(body.amountPaise) : undefined,
    consumeLicenseKey: body.consumeLicenseKey !== false,
    createdBy: getUserId(req),
  });
  successRes(res, result, undefined, 201);
});

export const enrollExistingStudent = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.franchiseEnrollExistingStudent({
    franchiseId,
    studentId: String(body.studentId ?? ""),
    batchId: String(body.batchId ?? ""),
    paymentMode: (body.paymentMode as "CASH" | "ONLINE" | "FREE") ?? "FREE",
    amountPaise: body.amountPaise != null ? Number(body.amountPaise) : undefined,
    createdBy: getUserId(req),
  });
  successRes(res, result, undefined, 201);
});

export const listMyStudents = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const result = await franchiseService.listFranchiseStudents(franchiseId, page, limit);
  successRes(res, result);
});

// ─── Franchise Admin: Earnings ───────────────────────────────────────────────

export const getMyEarnings = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const month = req.query.month ? String(req.query.month) : undefined;
  const earnings = await franchiseService.getFranchiseEarnings(franchiseId, month);
  successRes(res, earnings);
});

// ─── Franchise Admin: Record Offline Payment ─────────────────────────────────

export const recordOfflinePayment = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;

  const center = await franchiseService.getFranchiseCenterById(franchiseId);
  if (!center.assignedBatchIds.includes(String(body.batchId ?? ""))) {
    throw new AppError("Batch not assigned to your franchise", 403);
  }

  const txn = await franchiseService.recordFranchiseTransaction({
    franchiseId,
    type: "OFFLINE_COLLECTION",
    amountPaise: Number(body.amountPaise ?? 0),
    direction: "CREDIT",
    studentId: body.studentId ? String(body.studentId) : undefined,
    batchId: body.batchId ? String(body.batchId) : undefined,
    note: body.note ? String(body.note) : "Offline payment collected",
    recordedBy: getUserId(req),
  });

  successRes(res, { transactionId: String(txn._id) }, undefined, 201);
});

// ─── Franchise Admin: License Key Pool ────────────────────────────────────────

export const getMyKeyPools = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const pools = await franchiseService.getFranchiseKeyPools(franchiseId);
  successRes(res, { pools });
});

export const requestKeys = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.createFranchiseKeyRequest({
    franchiseId,
    courseId: String(body.courseId ?? ""),
    requestedCount: Number(body.requestedCount ?? 0),
    paymentProofUrl: body.paymentProofUrl ? String(body.paymentProofUrl) : undefined,
    note: body.note ? String(body.note) : undefined,
    requestedBy: getUserId(req),
  });
  successRes(res, result, undefined, 201);
});

export const listMyKeyRequests = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const requests = await franchiseService.listFranchiseKeyRequests(franchiseId);
  successRes(res, { requests });
});

// ─── Franchise Admin: Payment Proof Upload ────────────────────────────────────

export const getPaymentProofUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;
  const { getPaymentProofPresignedUpload } = await import("../services/franchiseUpload.service.js");
  const result = await getPaymentProofPresignedUpload({
    franchiseId,
    filename: String(body.filename ?? ""),
    contentType: String(body.contentType ?? ""),
  });
  successRes(res, result);
});

// ─── Franchise Admin: Assign Key to Student ───────────────────────────────────

export const assignKeyToStudent = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;
  const result = await franchiseService.franchiseAssignKeyToStudent({
    franchiseId,
    studentId: String(body.studentId ?? ""),
    batchId: String(body.batchId ?? ""),
    courseId: String(body.courseId ?? ""),
    performedBy: getUserId(req),
  });
  successRes(res, result);
});


// ─── Franchise Admin: Trainer Management ─────────────────────────────────────

export const createTrainer = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;

  const result = await franchiseService.franchiseCreateTrainer({
    franchiseId,
    name: String(body.name ?? ""),
    username: String(body.username ?? ""),
    email: String(body.email ?? ""),
    mobile: String(body.mobile ?? ""),
    password: String(body.password ?? ""),
    createdBy: getUserId(req),
  });

  successRes(res, result, undefined, 201);
});

export const listTrainers = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const trainers = await franchiseService.listFranchiseTrainers(franchiseId);
  successRes(res, { trainers });
});

export const updateTrainerStatus = asyncHandler(async (req: Request, res: Response) => {
  const franchiseId = await resolveFranchiseId(req);
  const body = req.body as Record<string, unknown>;

  const result = await franchiseService.franchiseUpdateTrainerStatus({
    franchiseId,
    trainerId: req.params.trainerId,
    status: String(body.status ?? ""),
    performedBy: getUserId(req),
  });

  successRes(res, result);
});
