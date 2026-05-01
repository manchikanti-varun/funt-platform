import { ShopProductModel } from "../models/ShopProduct.model.js";
import { ShopOrderModel } from "../models/ShopOrder.model.js";
import { AppError } from "../utils/AppError.js";
import { createAuditLog } from "./audit.service.js";
import { spendCoins, getSpendableBalance } from "./coinBalance.service.js";
import { assertShopCouponForPurchase, recordCouponRedemption } from "./coupon.service.js";
import mongoose from "mongoose";
import { PaymentSubmissionModel } from "../models/PaymentSubmission.model.js";

export const SHOP_COIN_TO_PAISE = 25; // 4 coins = 1 INR
export type ShopOrderStatus = "CONFIRMED" | "PACKED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "ISSUE" | "CANCELLED";

interface ShopAddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
}

interface CartInputItem {
  productId: string;
  quantity: number;
}

interface CheckoutInput {
  studentId: string;
  items: CartInputItem[];
  couponCode?: string;
  coinsToRedeem?: number;
}

interface CheckoutLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCoins: number;
  lineTotalCoins: number;
}

export interface ShopCheckoutSummary {
  items: CheckoutLine[];
  subtotalCoins: number;
  couponDiscountCoins: number;
  couponCodeApplied?: string;
  totalCoinsAfterDiscount: number;
  coinsToRedeem: number;
  payableCoins: number;
  payablePaise: number;
  payableRupees: number;
}

function normalizeQuantity(raw: number): number {
  const q = Math.floor(Number(raw));
  if (!Number.isFinite(q) || q < 1) return 1;
  return q;
}

function normalizeCart(items: CartInputItem[]): CartInputItem[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const id = String(it.productId ?? "").trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + normalizeQuantity(it.quantity));
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function normalizeAddress(input: ShopAddressInput): ShopAddressInput {
  const normalized: ShopAddressInput = {
    fullName: String(input.fullName ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    line1: String(input.line1 ?? "").trim(),
    line2: String(input.line2 ?? "").trim(),
    city: String(input.city ?? "").trim(),
    state: String(input.state ?? "").trim(),
    postalCode: String(input.postalCode ?? "").trim(),
  };
  if (!normalized.fullName || !normalized.phone || !normalized.line1 || !normalized.city || !normalized.state || !normalized.postalCode) {
    throw new AppError("Complete delivery address is required", 400);
  }
  return normalized;
}

export async function getShopCheckoutSummary(input: CheckoutInput): Promise<ShopCheckoutSummary> {
  const cart = normalizeCart(input.items ?? []);
  if (cart.length === 0) throw new AppError("Cart is empty", 400);
  const products = await ShopProductModel.find({ _id: { $in: cart.map((c) => c.productId) }, active: true })
    .select("name priceCoins stock active")
    .lean()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const lines: CheckoutLine[] = [];
  for (const row of cart) {
    const p = byId.get(row.productId);
    if (!p) throw new AppError("One or more products are unavailable", 404);
    if (p.stock != null && p.stock < row.quantity) {
      throw new AppError(`Only ${p.stock} unit(s) left for ${p.name}`, 400);
    }
    const unit = Math.max(0, Math.floor(Number(p.priceCoins ?? 0)));
    lines.push({
      productId: row.productId,
      productName: String(p.name ?? "Product"),
      quantity: row.quantity,
      unitPriceCoins: unit,
      lineTotalCoins: unit * row.quantity,
    });
  }
  const subtotalCoins = lines.reduce((acc, l) => acc + l.lineTotalCoins, 0);
  const couponCode = input.couponCode?.trim() ? input.couponCode.trim().toUpperCase() : "";
  let couponDiscountCoins = 0;
  let couponCodeApplied: string | undefined;
  if (couponCode) {
    const r = await assertShopCouponForPurchase(couponCode, "", input.studentId, subtotalCoins);
    couponDiscountCoins = Math.max(0, subtotalCoins - r.finalPrice);
    couponCodeApplied = r.couponId ? couponCode : undefined;
  }
  const totalCoinsAfterDiscount = Math.max(0, subtotalCoins - couponDiscountCoins);
  const balance = await getSpendableBalance(input.studentId);
  const requestedRedeem = Math.max(0, Math.floor(Number(input.coinsToRedeem ?? 0)));
  const coinsToRedeem = Math.min(requestedRedeem, totalCoinsAfterDiscount, balance);
  const payableCoins = Math.max(0, totalCoinsAfterDiscount - coinsToRedeem);
  const payablePaise = payableCoins * SHOP_COIN_TO_PAISE;
  return {
    items: lines,
    subtotalCoins,
    couponDiscountCoins,
    couponCodeApplied,
    totalCoinsAfterDiscount,
    coinsToRedeem,
    payableCoins,
    payablePaise,
    payableRupees: Number((payablePaise / 100).toFixed(2)),
  };
}

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
  void studentId;
  void productId;
  void couponCode;
  throw new AppError("Please use shop cart checkout for purchases.", 400);
}

/** After admin verifies external payment (not coin redemption). */
export async function createShopOrderAfterCheckout(input: {
  studentId: string;
  checkout: ShopCheckoutSummary;
  address: ShopAddressInput;
  actorId: string;
  paymentSubmissionId?: string;
  skipStockDeduction?: boolean;
}) {
  const session = await mongoose.startSession();
  const address = normalizeAddress(input.address);
  try {
    let createdOrderId = "";
    await session.withTransaction(async () => {
      if (!input.skipStockDeduction) {
        for (const it of input.checkout.items) {
          if (it.quantity <= 0) continue;
          if (it.lineTotalCoins < 0) throw new AppError("Invalid cart line item", 400);
          const product = await ShopProductModel.findById(it.productId).session(session).exec();
          if (!product || !product.active) throw new AppError(`Product unavailable: ${it.productName}`, 400);
          if (product.stock != null) {
            const reserved = await ShopProductModel.findOneAndUpdate(
              { _id: product._id, stock: { $gte: it.quantity } },
              { $inc: { stock: -it.quantity } },
              { new: true, session }
            )
              .select("_id")
              .lean()
              .exec();
            if (!reserved) throw new AppError(`Insufficient stock for ${product.name}`, 400);
          }
        }
      }

      if (input.checkout.coinsToRedeem > 0) {
        await spendCoins(input.studentId, input.checkout.coinsToRedeem, session);
      }

      if (input.checkout.couponCodeApplied) {
        const r = await assertShopCouponForPurchase(
          input.checkout.couponCodeApplied,
          "",
          input.studentId,
          input.checkout.subtotalCoins
        );
        if (r.couponId) {
          await recordCouponRedemption(
            r.couponId,
            input.studentId,
            `shop_cart:${Date.now()}`,
            session
          );
        }
      }

      const source =
        input.checkout.coinsToRedeem > 0 && input.checkout.payablePaise > 0
          ? "HYBRID"
          : input.checkout.payablePaise > 0
            ? "PAYMENT"
            : "COINS";
      const order = await ShopOrderModel.create(
        [
          {
            studentId: input.studentId,
            items: input.checkout.items,
            totalCoins: input.checkout.totalCoinsAfterDiscount,
            couponDiscountCoins: input.checkout.couponDiscountCoins,
            coinsRedeemed: input.checkout.coinsToRedeem,
            payablePaise: input.checkout.payablePaise,
            source,
            couponCode: input.checkout.couponCodeApplied,
            paymentSubmissionId: input.paymentSubmissionId,
            address,
            status: "CONFIRMED",
            statusReason: "",
            statusHistory: [
              {
                status: "CONFIRMED",
                note: "Order confirmed after payment verification",
                actorId: input.actorId,
                at: new Date(),
              },
            ],
          },
        ],
        { session }
      );
      createdOrderId = String(order[0]?._id ?? "");
    });
    return { id: createdOrderId };
  } finally {
    await session.endSession();
  }
}

export async function listMyOrders(studentId: string) {
  const orders = await ShopOrderModel.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
    .exec();
  return orders.map((o) => ({
    id: String(o._id),
    items: Array.isArray((o as { items?: Array<{ productName: string; quantity: number }> }).items)
      ? ((o as { items?: Array<{ productName: string; quantity: number }> }).items ?? []).map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
        }))
      : [],
    coinsSpent: (o as { coinsRedeemed?: number }).coinsRedeemed ?? 0,
    payablePaise: (o as { payablePaise?: number }).payablePaise ?? 0,
    status: (o as { status?: string }).status ?? "CONFIRMED",
    source: (o as { source?: string }).source ?? "COINS",
    couponCode: (o as { couponCode?: string }).couponCode,
    statusHistory: (o as { statusHistory?: unknown[] }).statusHistory ?? [],
    address: (o as { address?: unknown }).address ?? null,
    createdAt: o.createdAt,
  }));
}

export async function listShopOrdersAdmin() {
  const orders = await ShopOrderModel.find({})
    .sort({ createdAt: -1 })
    .limit(300)
    .lean()
    .exec();
  return orders.map((o) => ({
    id: String(o._id),
    studentId: o.studentId,
    items: (o as { items?: unknown[] }).items ?? [],
    totalCoins: (o as { totalCoins?: number }).totalCoins ?? 0,
    couponDiscountCoins: (o as { couponDiscountCoins?: number }).couponDiscountCoins ?? 0,
    coinsRedeemed: (o as { coinsRedeemed?: number }).coinsRedeemed ?? 0,
    payablePaise: (o as { payablePaise?: number }).payablePaise ?? 0,
    source: (o as { source?: string }).source ?? "COINS",
    couponCode: (o as { couponCode?: string }).couponCode ?? "",
    status: (o as { status?: string }).status ?? "CONFIRMED",
    statusReason: (o as { statusReason?: string }).statusReason ?? "",
    statusHistory: (o as { statusHistory?: unknown[] }).statusHistory ?? [],
    address: (o as { address?: unknown }).address ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }));
}

export async function updateShopOrderStatus(input: {
  orderId: string;
  status: ShopOrderStatus;
  note?: string;
  reason?: string;
  actorId: string;
}) {
  const order = await ShopOrderModel.findById(input.orderId).exec();
  if (!order) throw new AppError("Order not found", 404);
  const allowed: ShopOrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "ISSUE", "CANCELLED"];
  if (!allowed.includes(input.status)) throw new AppError("Invalid status", 400);
  const reason = input.reason?.trim() ?? "";
  if (input.status !== "CONFIRMED" && !reason) {
    throw new AppError("Reason is required when changing status from confirmed flow", 400);
  }
  const note = input.note?.trim() ?? "";
  (order as { status: ShopOrderStatus }).status = input.status;
  (order as { statusReason?: string }).statusReason = reason;
  (
    order as { statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }> }
  ).statusHistory = [
    ...(((order as { statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }> }).statusHistory ?? []) as Array<{
      status: string;
      note?: string;
      actorId?: string;
      at: Date;
    }>),
    {
      status: input.status,
      note: note || reason || `Order marked as ${input.status.toLowerCase().replaceAll("_", " ")}`,
      actorId: input.actorId,
      at: new Date(),
    },
  ];
  await order.save();
  await createAuditLog("SHOP_PURCHASE", input.actorId, "ShopOrder", String(order._id), {
    status: input.status,
    reason,
    note,
  });
  return { id: String(order._id), status: input.status };
}

export async function getShopStockInsightsAdmin() {
  const lowStockRows = await ShopProductModel.find({
    active: true,
    stock: { $ne: null, $lte: 5 },
  })
    .select("name stock shopShelf")
    .sort({ stock: 1, name: 1 })
    .lean()
    .exec();
  const reservedAgg = await PaymentSubmissionModel.aggregate<{ _id: string; qty: number }>([
    {
      $match: {
        kind: "SHOP",
        status: "PENDING",
        "shopCheckout.stockReserved": true,
      },
    },
    { $unwind: "$shopCheckout.items" },
    {
      $group: {
        _id: "$shopCheckout.items.productId",
        qty: { $sum: "$shopCheckout.items.quantity" },
      },
    },
  ]);
  const productIds = reservedAgg.map((r) => r._id).filter(Boolean);
  const products = productIds.length
    ? await ShopProductModel.find({ _id: { $in: productIds } }).select("name stock shopShelf").lean().exec()
    : [];
  const pmap = new Map(products.map((p) => [String(p._id), p]));
  const reservedByProduct = reservedAgg.map((r) => {
    const p = pmap.get(String(r._id));
    return {
      productId: String(r._id),
      productName: p?.name ?? String(r._id),
      reservedQty: Math.max(0, Math.floor(Number(r.qty ?? 0))),
      stockNow: p?.stock ?? null,
      shopShelf: (p as { shopShelf?: string } | undefined)?.shopShelf ?? "KITS",
    };
  });
  return {
    lowStockProducts: lowStockRows.map((p) => ({
      productId: String(p._id),
      productName: p.name,
      stockNow: p.stock,
      shopShelf: (p as { shopShelf?: string }).shopShelf ?? "KITS",
    })),
    reservedByProduct,
    reservedTotalQty: reservedByProduct.reduce((acc, r) => acc + r.reservedQty, 0),
  };
}
