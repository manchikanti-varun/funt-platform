
import type { Request, Response } from "express";
import * as service from "../services/batch.service.js";
import * as enrollmentService from "../services/enrollment.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function parseCourseEnrollmentPrices(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && k) out[k] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseManualUpiQrForCreate(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  return service.assertManualUpiQrUrl(t);
}

function parseCourseCompletionRewardCoins(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k) continue;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0) {
      throw new AppError("courseCompletionRewardCoins values must be non-negative integers", 400);
    }
    if (n > 1_000_000) throw new AppError("courseCompletionRewardCoins values must be at most 1,000,000", 400);
    out[k] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseCourseCompletionBadgeTypes(raw: unknown): Record<string, string | string[]> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k) continue;
    if (typeof v === "string" || Array.isArray(v)) out[k] = v as string | string[];
  }
  return Object.keys(out).length ? out : undefined;
}

function parseManualUpiQrForUpdate(body: Record<string, unknown>): string | null | undefined {
  if (!("manualUpiQrUrl" in body)) return undefined;
  const raw = body.manualUpiQrUrl;
  if (raw === null) return null;
  if (typeof raw !== "string") throw new AppError("manualUpiQrUrl must be a string or null", 400);
  const t = raw.trim();
  if (!t) return null;
  return service.assertManualUpiQrUrl(t);
}

function parseCoursePaymentMethods(
  raw: unknown
): Record<string, { upiManual?: boolean; razorpay?: boolean }> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, { upiManual?: boolean; razorpay?: boolean }> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k || !v || typeof v !== "object" || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const upiManual = o.upiManual;
    const razorpay = o.razorpay;
    out[k] = {
      ...(typeof upiManual === "boolean" ? { upiManual } : {}),
      ...(typeof razorpay === "boolean" ? { razorpay } : {}),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

export const createBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const {
    name,
    courseId,
    courseIds,
    trainerId,
    startDate,
    endDate,
    zoomLink,
    moderatorIds,
    courseEnrollmentPrices,
    coursePaymentMethods,
    courseCompletionRewardCoins,
    courseCompletionBadgeTypes,
    manualUpiQrUrl: manualUpiQrUrlRaw,
  } = req.body ?? {};
  if (!startDate) throw new AppError("startDate is required", 400);
  const ids = Array.isArray(courseIds) && courseIds.length > 0 ? courseIds : (courseId ? [courseId] : []);
  if (ids.length === 0) throw new AppError("courseIds or courseId is required", 400);
  const data = await service.createBatch({
    name,
    courseIds: ids,
    trainerId,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : undefined,
    zoomLink,
    createdBy,
    moderatorIds: Array.isArray(moderatorIds) ? moderatorIds : undefined,
    courseEnrollmentPrices: parseCourseEnrollmentPrices(courseEnrollmentPrices),
    coursePaymentMethods: parseCoursePaymentMethods(coursePaymentMethods),
    manualUpiQrUrl: parseManualUpiQrForCreate(manualUpiQrUrlRaw),
    courseCompletionRewardCoins: parseCourseCompletionRewardCoins(courseCompletionRewardCoins),
    courseCompletionBadgeTypes: parseCourseCompletionBadgeTypes(courseCompletionBadgeTypes),
  });
  successRes(res, data, "Batch created", 201);
});

export const listBatches = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const trainerId = req.query.trainerId as string | undefined;
  const search = (req.query.search ?? req.query.q) as string | undefined;
  const isTrainer = req.user?.roles?.includes(ROLE.TRAINER);
  const isAdmin = req.user?.roles?.includes(ROLE.ADMIN) || req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  const filters: { status?: string; trainerId?: string; assignedToUserId?: string; search?: string } = {};
  if (status) filters.status = status;
  if (search) filters.search = search;
  if (isTrainer && !isAdmin) {
    filters.assignedToUserId = req.user!.userId;
  } else if (trainerId) {
    filters.trainerId = trainerId;
  }
  const data = await service.listBatches(Object.keys(filters).length ? filters : undefined);
  successRes(res, data);
});

export const getBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Batch ID is required", 400);
  const data = await service.getBatchById(id);
  const isTrainer = req.user?.roles?.includes(ROLE.TRAINER);
  const isAdmin = req.user?.roles?.includes(ROLE.ADMIN) || req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (isTrainer && !isAdmin) {
    const moderatorIds = (data as { moderatorIds?: string[] }).moderatorIds ?? [];
    if (data.trainerId !== req.user!.userId && !moderatorIds.includes(req.user!.userId)) {
      throw new AppError("Forbidden: you can only view batches assigned to you", 403);
    }
  }
  successRes(res, data);
});

export const updateBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Batch ID is required", 400);
  const existing = await service.getBatchById(id);
  const isTrainer = req.user?.roles?.includes(ROLE.TRAINER);
  const isAdmin = req.user?.roles?.includes(ROLE.ADMIN) || req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (isTrainer && !isAdmin) {
    if (existing.trainerId !== req.user!.userId && !(existing as { moderatorIds?: string[] }).moderatorIds?.includes(req.user!.userId)) {
      throw new AppError("Forbidden: you can only edit batches assigned to you", 403);
    }
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const {
    name,
    courseId,
    courseIds,
    trainerId,
    startDate,
    endDate,
    zoomLink,
    moderatorIds,
    courseEnrollmentPrices,
    coursePaymentMethods,
    courseCompletionRewardCoins,
    courseCompletionBadgeTypes,
  } = body;
  const ids = Array.isArray(courseIds) && courseIds.length > 0 ? courseIds : (courseId ? [courseId] : undefined);
  const data = await service.updateBatch(
    id,
    {
      name: typeof name === "string" ? name : undefined,
      courseIds: ids,
      trainerId: typeof trainerId === "string" ? trainerId : undefined,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined,
      zoomLink: typeof zoomLink === "string" ? zoomLink : undefined,
      moderatorIds: Array.isArray(moderatorIds) ? (moderatorIds as string[]) : undefined,
      courseEnrollmentPrices: parseCourseEnrollmentPrices(courseEnrollmentPrices),
      coursePaymentMethods: parseCoursePaymentMethods(coursePaymentMethods),
      manualUpiQrUrl: parseManualUpiQrForUpdate(body),
      courseCompletionRewardCoins: parseCourseCompletionRewardCoins(courseCompletionRewardCoins),
      courseCompletionBadgeTypes: parseCourseCompletionBadgeTypes(courseCompletionBadgeTypes),
    },
    performedBy
  );
  successRes(res, data, "Batch updated");
});

export const duplicateBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Batch ID is required", 400);
  const { name, trainerId } = req.body ?? {};
  const data = await service.duplicateBatch(id, { name, trainerId, performedBy });
  successRes(res, data, "Batch duplicated", 201);
});

export const archiveBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Batch ID is required", 400);
  const data = await service.archiveBatch(id, performedBy);
  successRes(res, data, "Batch archived");
});

export const getBatchStudents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Batch ID is required", 400);
  const data = await enrollmentService.listEnrollmentsByBatch(id);
  successRes(res, data);
});

export const addBatchStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Batch ID is required", 400);
  const identifier = (req.body?.studentId ?? req.body?.username ?? req.body?.identifier) as string | undefined;
  if (!identifier) throw new AppError("studentId or username is required", 400);
  const data = await enrollmentService.createEnrollment({ studentId: identifier, batchId: id, createdBy: performedBy });
  successRes(res, data, "Student added to batch", 201);
});

export const bulkAddBatchStudents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Batch ID is required", 400);
  const identifiers = (req.body?.identifiers ?? req.body?.studentUsernames ?? req.body?.usernames ?? []) as string[];
  if (!Array.isArray(identifiers)) throw new AppError("identifiers or studentUsernames must be an array", 400);
  const data = await enrollmentService.bulkEnroll(id, identifiers, performedBy);
  successRes(res, data, "Bulk add completed");
});

export const removeBatchStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const studentId = req.params.studentId;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Batch ID is required", 400);
  if (!studentId) throw new AppError("Student ID is required", 400);
  const data = await enrollmentService.removeEnrollment(id, studentId, performedBy);
  successRes(res, data, "Student removed from batch");
});
