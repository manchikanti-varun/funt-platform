
import type { Request, Response } from "express";
import * as service from "../services/registrationRequest.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";

function getUserId(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new AppError("Unauthorized", 401);
  return id;
}

export const submitAdminRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { name, email, mobile, city } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !mobile?.trim()) {
    throw new AppError("name, email and mobile are required", 400);
  }
  const result = await service.submitAdminRequest({
    name: name.trim(),
    email: email.trim(),
    mobile: mobile.trim(),
    city: city?.trim() || undefined,
    requestedBy: userId,
  });
  res.status(201).json(result);
});

export const submitSuperAdminRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { name, email, mobile, city } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !mobile?.trim()) {
    throw new AppError("name, email and mobile are required", 400);
  }
  const result = await service.submitSuperAdminRequest({
    name: name.trim(),
    email: email.trim(),
    mobile: mobile.trim(),
    city: city?.trim() || undefined,
    requestedBy: userId,
  });
  res.status(201).json(result);
});

export const listRequests = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const roleType = req.query.roleType as string | undefined;
  const status = req.query.status as string | undefined;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
  const filters: service.ListRegistrationRequestsFilters = {};
  if (roleType === "ADMIN" || roleType === "SUPER_ADMIN") filters.roleType = roleType;
  if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") filters.status = status;
  const list = await service.listRegistrationRequests(filters, limit);
  successRes(res, list);
});

export const approveRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const requestId = req.params.requestId;
  if (!requestId) throw new AppError("requestId is required", 400);
  const result = await service.approveRequest(requestId, userId);
  res.json(result);
});

export const rejectRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const requestId = req.params.requestId;
  if (!requestId) throw new AppError("requestId is required", 400);
  const reason = (req.body ?? {}).reason;
  await service.rejectRequest(requestId, userId, typeof reason === "string" ? reason : undefined);
  res.json({ message: "Request rejected" });
});
