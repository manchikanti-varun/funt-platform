import { ShopProductModel } from "../models/ShopProduct.model.js";
import { ShopOrderModel } from "../models/ShopOrder.model.js";
import { AppError } from "../utils/AppError.js";
import { createAuditLog } from "./audit.service.js";
import { spendCoins, getSpendableBalance } from "./coinBalance.service.js";
import { assertShopCouponForPurchase, recordCouponRedemption } from "./coupon.service.js";

export async function listActiveProductsForStudent(shelf?: "KITS" | "COMPONENTS") {
  const q: Record<string, unknown> = { active: true };
  if (shelf === "KITS" || shelf === "COMPONENTS") q.shopShelf = shelf;
  const products = await ShopProductModel.find(q).sort({ sortOrder: 1, name: 1 }).lean().exec();
  return products.map((p) => ({
    id: String(p._id),
    name: p.name,
    description: p.description ?? "",
    priceCoins: p.priceCoins,
    imageUrl: p.imageUrl ?? "",
    inStock: p.stock == null || p.stock > 0,
    shopShelf: (p as { shopShelf?: string }).shopShelf ?? "KITS",
  }));
}

export async function listAllProductsAdmin() {
  const products = await ShopProductModel.find({}).sort({ sortOrder: 1, name: 1 }).lean().exec();
  return products.map((p) => ({
    id: String(p._id),
    name: p.name,
    description: p.description ?? "",
    priceCoins: p.priceCoins,
    imageUrl: p.imageUrl ?? "",
    active: p.active,
    stock: p.stock,
    sortOrder: p.sortOrder ?? 0,
    shopShelf: (p as { shopShelf?: string }).shopShelf ?? "KITS",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

export async function createProductAdmin(input: {
  name: string;
  description?: string;
  priceCoins: number;
  imageUrl?: string;
  active?: boolean;
  stock?: number | null;
  sortOrder?: number;
  shopShelf?: "KITS" | "COMPONENTS";
}, actorId: string) {
  const name = input.name?.trim();
  if (!name) throw new AppError("name is required", 400);
  const priceCoins = Math.floor(Number(input.priceCoins));
  if (!Number.isFinite(priceCoins) || priceCoins < 0) throw new AppError("Invalid priceCoins", 400);
  let stock: number | null = null;
  if (input.stock !== undefined) {
    stock = input.stock === null ? null : Math.max(0, Math.floor(Number(input.stock)));
  }

  const shelf = input.shopShelf === "COMPONENTS" ? "COMPONENTS" : "KITS";
  const doc = await ShopProductModel.create({
    name,
    description: input.description?.trim() ?? "",
    priceCoins,
    imageUrl: input.imageUrl?.trim() ?? "",
    active: input.active !== false,
    stock,
    sortOrder: input.sortOrder ?? 0,
    shopShelf: shelf,
  });
  await createAuditLog("SHOP_PRODUCT_CREATED", actorId, "ShopProduct", String(doc._id));
  return { id: String(doc._id) };
}

export async function updateProductAdmin(
  productId: string,
  input: Partial<{
    name: string;
    description: string;
    priceCoins: number;
    imageUrl: string;
    active: boolean;
    stock: number | null;
    sortOrder: number;
    shopShelf: "KITS" | "COMPONENTS";
  }>,
  actorId: string
) {
  const doc = await ShopProductModel.findById(productId).exec();
  if (!doc) throw new AppError("Product not found", 404);
  if (input.name != null) doc.name = String(input.name).trim();
  if (input.description != null) doc.description = String(input.description).trim();
  if (input.priceCoins != null) {
    const n = Math.floor(Number(input.priceCoins));
    if (!Number.isFinite(n) || n < 0) throw new AppError("Invalid priceCoins", 400);
    doc.priceCoins = n;
  }
  if (input.imageUrl != null) doc.imageUrl = String(input.imageUrl).trim();
  if (input.active != null) doc.active = Boolean(input.active);
  if (input.stock !== undefined) doc.stock = input.stock;
  if (input.sortOrder != null) doc.sortOrder = Math.floor(Number(input.sortOrder));
  if (input.shopShelf === "KITS" || input.shopShelf === "COMPONENTS") (doc as { shopShelf?: string }).shopShelf = input.shopShelf;
  await doc.save();
  await createAuditLog("SHOP_PRODUCT_UPDATED", actorId, "ShopProduct", productId);
  return { id: String(doc._id) };
}

export async function deleteProductAdmin(productId: string, actorId: string) {
  const doc = await ShopProductModel.findByIdAndDelete(productId).exec();
  if (!doc) throw new AppError("Product not found", 404);
  await createAuditLog("SHOP_PRODUCT_DELETED", actorId, "ShopProduct", productId);
}

export async function purchaseProduct(studentId: string, productId: string, couponCode?: string) {
  const product = await ShopProductModel.findById(productId).exec();
  if (!product || !product.active) throw new AppError("Product not available", 404);
  if (product.stock != null && product.stock < 1) throw new AppError("Out of stock", 400);
  const listPrice = product.priceCoins;
  const { finalPrice, couponId } = await assertShopCouponForPurchase(couponCode, String(product._id), studentId, listPrice);

  if (finalPrice > 0) {
    await spendCoins(studentId, finalPrice);
  }

  if (product.stock != null) {
    product.stock -= 1;
    await product.save();
  }

  const codeStored = couponCode?.trim() ? couponCode.trim().toUpperCase() : undefined;

  await ShopOrderModel.create({
    studentId,
    productId: String(product._id),
    productName: product.name,
    coinsSpent: finalPrice,
    source: "COINS",
    couponCode: codeStored,
  });

  if (couponId) {
    await recordCouponRedemption(couponId, studentId, `shop:${productId}`);
  }

  await createAuditLog("SHOP_PURCHASE", studentId, "ShopProduct", String(product._id), {
    coinsSpent: finalPrice,
    couponCode: codeStored,
  });

  const newBalance = await getSpendableBalance(studentId);
  return {
    newBalance,
    productName: product.name,
    coinsSpent: finalPrice,
  };
}

/** After admin verifies external payment (not coin redemption). */
export async function fulfillShopOrderAfterExternalPayment(studentId: string, productId: string) {
  const product = await ShopProductModel.findById(productId).exec();
  if (!product || !product.active) throw new AppError("Product not available", 404);
  if (product.stock != null && product.stock < 1) throw new AppError("Product is out of stock", 400);

  if (product.stock != null) {
    product.stock -= 1;
    await product.save();
  }

  await ShopOrderModel.create({
    studentId,
    productId: String(product._id),
    productName: product.name,
    coinsSpent: 0,
    source: "PAYMENT",
  });

  await createAuditLog("SHOP_PURCHASE", studentId, "ShopProduct", String(product._id));
}

export async function listMyOrders(studentId: string) {
  const orders = await ShopOrderModel.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
    .exec();
  return orders.map((o) => ({
    id: String(o._id),
    productName: o.productName,
    coinsSpent: o.coinsSpent,
    source: (o as { source?: string }).source ?? "COINS",
    couponCode: (o as { couponCode?: string }).couponCode,
    createdAt: o.createdAt,
  }));
}
