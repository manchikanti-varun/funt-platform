/**
 * Audit controller – list logs (Super Admin full; Admin limited optional).
 */

import type { Request, Response } from "express";
import * as service from "../services/audit.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const listAuditLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  getUserId(req);
  const isSuperAdmin = req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (!isSuperAdmin) {
    throw new AppError("Only Super Admin can access audit logs", 403);
  }
  const action = req.query.action as string | undefined;
  const performedBy = req.query.performedBy as string | undefined;
  const fromDate = req.query.fromDate as string | undefined;
  const toDate = req.query.toDate as string | undefined;
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

  const filters: service.ListAuditLogsFilters = {};
  if (action) filters.action = action;
  if (performedBy) filters.performedBy = performedBy;
  if (fromDate) filters.fromDate = new Date(fromDate);
  if (toDate) filters.toDate = new Date(toDate);

  const data = await service.listAuditLogs(filters, page, limit);
  successRes(res, { ...data, page, limit });
});
