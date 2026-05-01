import type { Request, Response } from "express";
import { ROLE } from "@funt-platform/constants";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import {
  approvePaymentUpiChangeRequest,
  getPaymentUpiConfigForAdmin,
  listPaymentUpiChangeRequests,
  rejectPaymentUpiChangeRequest,
  submitPaymentUpiChangeRequest,
  updatePaymentUpiConfig,
} from "../services/paymentUpi.service.js";

function uid(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new AppError("Unauthorized", 401);
  return id;
}

function assertSuperAdmin(req: Request): void {
  if (!req.user?.roles?.includes(ROLE.SUPER_ADMIN)) {
    throw new AppError("Only Super Admin can perform this action", 403);
  }
}

export const getAdminPaymentUpiConfig = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await getPaymentUpiConfigForAdmin();
  successRes(res, data);
});

export const patchAdminPaymentUpiConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const changedBy = uid(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const data = await updatePaymentUpiConfig({
    upiId: String(body.upiId ?? ""),
    receiverName: String(body.receiverName ?? ""),
    changedBy,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  });
  successRes(res, data, "UPI config updated");
});

export const postAdminPaymentUpiChangeRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const requestedBy = uid(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const data = await submitPaymentUpiChangeRequest({
    requestedBy,
    proposedUpiId: String(body.proposedUpiId ?? ""),
    proposedReceiverName: String(body.proposedReceiverName ?? ""),
    reason: String(body.reason ?? ""),
  });
  successRes(res, data, "UPI change request submitted", 201);
});

export const getAdminPaymentUpiChangeRequests = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const data = await listPaymentUpiChangeRequests();
  successRes(res, data);
});

export const postApproveAdminPaymentUpiChangeRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const reviewedBy = uid(req);
  const requestId = req.params.id;
  if (!requestId) throw new AppError("Request id is required", 400);
  const data = await approvePaymentUpiChangeRequest({ requestId, reviewedBy });
  successRes(res, data, "UPI change request approved");
});

export const postRejectAdminPaymentUpiChangeRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const reviewedBy = uid(req);
  const requestId = req.params.id;
  if (!requestId) throw new AppError("Request id is required", 400);
  const reason = typeof (req.body as Record<string, unknown> | undefined)?.reason === "string"
    ? String((req.body as Record<string, unknown>).reason)
    : undefined;
  const data = await rejectPaymentUpiChangeRequest({ requestId, reviewedBy, reason });
  successRes(res, data, "UPI change request rejected");
});
