/**
 * Attendance controller – mark (admin/trainer), list by batch, my stats (student).
 */

import type { Request, Response } from "express";
import * as service from "../services/attendance.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";
import { findBatchByParam } from "../services/batch.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const markAttendance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const markedBy = getUserId(req);
  const { batchId, sessionDate, attendanceRecords } = req.body ?? {};
  const isTrainer = req.user?.roles?.includes(ROLE.TRAINER);
  const isSuperAdmin = req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (isTrainer && !isSuperAdmin) {
    const batch = await findBatchByParam(batchId);
    if (!batch || (batch as { trainerId?: string }).trainerId !== markedBy) {
      throw new AppError("You can only mark attendance for batches assigned to you", 403);
    }
  }
  const data = await service.markAttendance({
    batchId,
    sessionDate,
    attendanceRecords,
    markedBy,
    isSuperAdminOverride: isSuperAdmin,
  });
  successRes(res, data, "Attendance marked", 201);
});

export const getAttendanceForBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = (req.params.batchId ?? req.query.batchId) as string;
  if (!batchId) throw new AppError("batchId is required", 400);
  const data = await service.getAttendanceForBatch(batchId);
  successRes(res, data);
});

export const getMyAttendance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await service.getMyAttendance(studentId);
  successRes(res, data);
});

export const markBatchAttendanceByFuntIds = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const markedBy = getUserId(req);
  const batchId = req.params.batchId as string;
  if (!batchId) throw new AppError("batchId is required", 400);
  const { sessionDate, funtIds } = req.body ?? {};
  if (!sessionDate) throw new AppError("sessionDate is required", 400);
  const ids = Array.isArray(funtIds) ? funtIds : typeof funtIds === "string" ? funtIds.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean) : [];
  if (ids.length === 0) throw new AppError("funtIds (or CSV paste) is required", 400);
  const isTrainer = req.user?.roles?.includes(ROLE.TRAINER);
  const isSuperAdmin = req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (isTrainer && !isSuperAdmin) {
    const batch = await findBatchByParam(batchId);
    if (!batch || (batch as { trainerId?: string }).trainerId !== markedBy) {
      throw new AppError("You can only mark attendance for batches assigned to you", 403);
    }
  }
  const data = await service.markBatchAttendanceByFuntIds(
    batchId,
    sessionDate,
    ids,
    markedBy,
    isSuperAdmin
  );
  successRes(res, data, "Attendance marked", 201);
});

export const getAttendanceByStudentsForBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = (req.params.batchId ?? req.query.batchId) as string;
  if (!batchId) throw new AppError("batchId is required", 400);
  const data = await service.getAttendanceByStudentsForBatch(batchId);
  successRes(res, data);
});

export const addPresentToBatchSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const markedBy = getUserId(req);
  const batchId = req.params.batchId as string;
  if (!batchId) throw new AppError("batchId is required", 400);
  const { sessionDate, funtIds } = req.body ?? {};
  if (!sessionDate) throw new AppError("sessionDate is required", 400);
  const ids = Array.isArray(funtIds) ? funtIds : typeof funtIds === "string" ? funtIds.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean) : [];
  if (ids.length === 0) throw new AppError("funtIds (or CSV paste) is required", 400);
  const isTrainer = req.user?.roles?.includes(ROLE.TRAINER);
  const isSuperAdmin = req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (isTrainer && !isSuperAdmin) {
    const batch = await findBatchByParam(batchId);
    if (!batch || (batch as { trainerId?: string }).trainerId !== markedBy) {
      throw new AppError("You can only edit attendance for batches assigned to you", 403);
    }
  }
  const data = await service.addPresentToBatchSession(batchId, sessionDate, ids, markedBy, isSuperAdmin);
  successRes(res, data, "Added remaining present", 200);
});
