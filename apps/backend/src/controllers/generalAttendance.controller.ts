/**
 * General (event) attendance controller.
 */

import type { Request, Response } from "express";
import * as service from "../services/generalAttendance.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const createGeneralAttendance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const markedBy = getUserId(req);
  const { eventDate, title, funtIds } = req.body ?? {};
  if (!eventDate) throw new AppError("eventDate is required", 400);
  const ids = Array.isArray(funtIds)
    ? funtIds
    : typeof funtIds === "string"
      ? funtIds.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];
  if (ids.length === 0) throw new AppError("funtIds (or CSV paste) is required", 400);
  const data = await service.createGeneralAttendance({
    eventDate,
    title,
    funtIdsOrUserIds: ids,
    markedBy,
  });
  successRes(res, data, "Event attendance created", 201);
});

export const listGeneralAttendance = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await service.listGeneralAttendance();
  successRes(res, data);
});

export const getGeneralAttendanceById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  if (!id) throw new AppError("id is required", 400);
  const data = await service.getGeneralAttendanceById(id);
  successRes(res, data);
});

export const addPresentToGeneralAttendance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const performedBy = getUserId(req);
  const id = req.params.id as string;
  if (!id) throw new AppError("id is required", 400);
  const { funtIds } = req.body ?? {};
  const ids = Array.isArray(funtIds) ? funtIds : typeof funtIds === "string" ? funtIds.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean) : [];
  if (ids.length === 0) throw new AppError("funtIds (or CSV paste) is required", 400);
  const data = await service.addPresentToGeneralAttendance(id, ids, performedBy);
  successRes(res, data, "Added remaining present", 200);
});

export const getMyGeneralAttendance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await service.getMyGeneralAttendance(studentId);
  successRes(res, data);
});
