import type { Request, Response } from "express";
import { ROLE } from "@funt-platform/constants";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import { generatePaymentQrRecord, listPaymentQrHistory } from "../services/paymentQr.service.js";

function uid(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new AppError("Unauthorized", 401);
  return id;
}

export const postGeneratePaymentQr = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const prefillAmount = body.prefillAmount !== false;
  const amount =
    body.amount == null || body.amount === "" ? undefined : Number(body.amount);

  const data = await generatePaymentQrRecord({
    adminId,
    upiId: String(body.upiId ?? ""),
    receiverName: String(body.receiverName ?? ""),
    prefillAmount,
    amountRupees: amount,
  });
  successRes(res, data, "Payment QR generated", 201);
});

export const getPaymentQrHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  uid(req);
  if (!req.user?.roles?.includes(ROLE.SUPER_ADMIN)) {
    throw new AppError("Only Super Admin can access payment QR history", 403);
  }
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 25));
  const data = await listPaymentQrHistory({ page, limit });
  successRes(res, data);
});
