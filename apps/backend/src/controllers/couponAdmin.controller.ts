import type { Request, Response } from "express";
import * as service from "../services/coupon.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function uid(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new AppError("Unauthorized", 401);
  return id;
}

function parseOptionalMaxRedemptions(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) throw new AppError("maxRedemptions must be a valid number", 400);
  return Math.max(0, Math.floor(n));
}

export const listCoupons = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await service.listCouponsAdmin();
  successRes(res, data);
});

export const getCouponAudit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  uid(req);
  if (!req.user?.roles?.includes(ROLE.SUPER_ADMIN)) {
    throw new AppError("Only Super Admin can access coupon audit", 403);
  }
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 25));
  const data = await service.listCouponAudit({ page, limit });
  successRes(res, data);
});

export const postCoupon = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = uid(req);
  const b = req.body as Record<string, unknown>;
  const kindRaw = String(b.kind ?? "").toUpperCase();
  if (kindRaw !== "SHOP" && kindRaw !== "COURSE") {
    throw new AppError("kind must be SHOP or COURSE", 400);
  }
  const kind = kindRaw as "SHOP" | "COURSE";
  const validFrom = b.validFrom ? new Date(String(b.validFrom)) : undefined;
  const validUntil = b.validUntil ? new Date(String(b.validUntil)) : undefined;
  if (validFrom && Number.isNaN(validFrom.getTime())) throw new AppError("Invalid validFrom", 400);
  if (validUntil && Number.isNaN(validUntil.getTime())) throw new AppError("Invalid validUntil", 400);
  const data = await service.createCouponAdmin({
    code: String(b.code ?? ""),
    kind,
    courseId: b.courseId != null ? String(b.courseId) : undefined,
    shopScope: b.shopScope === "FIRST_ORDER" ? "FIRST_ORDER" : "ALL_ORDERS",
    discountType: "PERCENT",
    discountValue: Number(b.discountValue),
    maxRedemptions: parseOptionalMaxRedemptions(b.maxRedemptions),
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
    maxRedemptions: parseOptionalMaxRedemptions(b.maxRedemptions),
    validUntil: b.validUntil === undefined ? undefined : b.validUntil === null ? null : new Date(String(b.validUntil)),
    notes: b.notes != null ? String(b.notes) : undefined,
  });
  successRes(res, data, "Coupon updated");
});
