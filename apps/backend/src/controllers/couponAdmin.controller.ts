import type { Request, Response } from "express";
import * as service from "../services/coupon.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function uid(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new AppError("Unauthorized", 401);
  return id;
}

export const listCoupons = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await service.listCouponsAdmin();
  successRes(res, data);
});

export const postCoupon = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = uid(req);
  const b = req.body as Record<string, unknown>;
  const kind = String(b.kind ?? "").toUpperCase() === "SHOP" ? "SHOP" : "COURSE";
  const discountType = String(b.discountType ?? "").toUpperCase() === "FIXED_COINS" ? "FIXED_COINS" : "PERCENT";
  const validFrom = b.validFrom ? new Date(String(b.validFrom)) : undefined;
  const validUntil = b.validUntil ? new Date(String(b.validUntil)) : undefined;
  if (validFrom && Number.isNaN(validFrom.getTime())) throw new AppError("Invalid validFrom", 400);
  if (validUntil && Number.isNaN(validUntil.getTime())) throw new AppError("Invalid validUntil", 400);
  const data = await service.createCouponAdmin({
    code: String(b.code ?? ""),
    kind,
    batchId: b.batchId != null ? String(b.batchId) : undefined,
    courseId: b.courseId != null ? String(b.courseId) : undefined,
    productId: b.productId != null ? String(b.productId) : undefined,
    discountType,
    discountValue: Number(b.discountValue),
    maxRedemptions: b.maxRedemptions === null || b.maxRedemptions === "" ? null : Number(b.maxRedemptions),
    perStudentLimit: b.perStudentLimit != null ? Number(b.perStudentLimit) : undefined,
    validFrom: validFrom && !Number.isNaN(validFrom.getTime()) ? validFrom : undefined,
    validUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : undefined,
    active: b.active !== false,
    notes: b.notes != null ? String(b.notes) : undefined,
    createdBy,
  });
  successRes(res, data, "Coupon created", 201);
});

export const patchCoupon = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Coupon id required", 400);
  const b = req.body as Record<string, unknown>;
  const data = await service.patchCouponAdmin(id, {
    active: typeof b.active === "boolean" ? b.active : undefined,
    maxRedemptions: b.maxRedemptions === undefined ? undefined : b.maxRedemptions === null ? null : Number(b.maxRedemptions),
    validUntil: b.validUntil === undefined ? undefined : b.validUntil === null ? null : new Date(String(b.validUntil)),
    notes: b.notes != null ? String(b.notes) : undefined,
  });
  successRes(res, data, "Coupon updated");
});
