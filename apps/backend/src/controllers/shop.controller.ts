import type { Request, Response } from "express";
import * as service from "../services/shop.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const listShopProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const shelf = req.query.shelf === "COMPONENTS" || req.query.shelf === "KITS" ? req.query.shelf : undefined;
  const data = await service.listActiveProductsForStudent(shelf);
  successRes(res, data);
});

export const listMyShopOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await service.listMyOrders(studentId);
  successRes(res, data);
});

export const postPurchaseWithCoins = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { productId, couponCode } = req.body as { productId?: string; couponCode?: string };
  if (!productId?.trim()) throw new AppError("productId is required", 400);
  const data = await service.purchaseProduct(studentId, productId.trim(), couponCode);
  successRes(res, data, "Purchase complete");
});
