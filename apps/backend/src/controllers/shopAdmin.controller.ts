import type { Request, Response } from "express";
import * as service from "../services/shop.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const listShopProductsAdmin = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await service.listAllProductsAdmin();
  successRes(res, data);
});

export const postShopProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actor = getUserId(req);
  const body = req.body as Record<string, unknown>;
  const data = await service.createProductAdmin(
    {
      name: String(body.name ?? ""),
      description: body.description != null ? String(body.description) : undefined,
      priceCoins: Number(body.priceCoins),
      imageUrl: body.imageUrl != null ? String(body.imageUrl) : undefined,
      active: body.active !== false,
      stock: body.stock === null ? null : body.stock !== undefined ? Number(body.stock) : undefined,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
      shopShelf: body.shopShelf === "COMPONENTS" ? "COMPONENTS" : body.shopShelf === "KITS" ? "KITS" : undefined,
    },
    actor
  );
  successRes(res, data, "Product created", 201);
});

export const patchShopProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actor = getUserId(req);
  const id = req.params.productId;
  if (!id) throw new AppError("productId is required", 400);
  const body = req.body as Record<string, unknown>;
  const patch: Parameters<typeof service.updateProductAdmin>[1] = {};
  if (body.name != null) patch.name = String(body.name);
  if (body.description != null) patch.description = String(body.description);
  if (body.priceCoins != null) patch.priceCoins = Number(body.priceCoins);
  if (body.imageUrl != null) patch.imageUrl = String(body.imageUrl);
  if (body.active != null) patch.active = Boolean(body.active);
  if (body.stock === null) patch.stock = null;
  else if (body.stock !== undefined) patch.stock = Number(body.stock);
  if (body.sortOrder != null) patch.sortOrder = Number(body.sortOrder);
  if (body.shopShelf === "KITS" || body.shopShelf === "COMPONENTS") patch.shopShelf = body.shopShelf;
  const data = await service.updateProductAdmin(id, patch, actor);
  successRes(res, data, "Product updated");
});

export const deleteShopProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actor = getUserId(req);
  const id = req.params.productId;
  if (!id) throw new AppError("productId is required", 400);
  await service.deleteProductAdmin(id, actor);
  successRes(res, { ok: true }, "Product deleted");
});
