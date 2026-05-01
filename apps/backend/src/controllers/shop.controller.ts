import type { Request, Response } from "express";
import * as service from "../services/shop.service.js";
import { submitStudentPayment } from "../services/paymentSubmission.service.js";
import { buildStaticUpiQr, getPaymentUpiConfig } from "../services/paymentUpi.service.js";
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

export const postShopCheckoutQuote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { items, couponCode, coinsToRedeem } = (req.body ?? {}) as {
    items?: Array<{ productId?: string; quantity?: number }>;
    couponCode?: string;
    coinsToRedeem?: number;
  };
  const summary = await service.getShopCheckoutSummary({
    studentId,
    items: Array.isArray(items)
      ? items.map((it) => ({
          productId: String(it.productId ?? "").trim(),
          quantity: Math.max(1, Math.floor(Number(it.quantity ?? 1))),
        }))
      : [],
    couponCode,
    coinsToRedeem,
  });

  let upiQrUrl = "";
  let upiPaymentLink = "";
  if (summary.payablePaise > 0) {
    try {
      const cfg = await getPaymentUpiConfig();
      const staticQr = await buildStaticUpiQr({
        upiId: cfg.upiId,
        receiverName: cfg.receiverName,
        amountPaise: summary.payablePaise,
      });
      upiQrUrl = staticQr.qrDataUrl;
      upiPaymentLink = staticQr.paymentLink;
    } catch {
      upiQrUrl = process.env.PAYMENT_UPI_QR_URL?.trim() ?? "";
      upiPaymentLink = "";
    }
  }
  successRes(res, { ...summary, upiQrUrl, upiPaymentLink });
});

export const postShopCheckoutSubmit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const body = (req.body ?? {}) as {
    items?: Array<{ productId?: string; quantity?: number }>;
    couponCode?: string;
    coinsToRedeem?: number;
    transactionId?: string;
    paidAt?: string;
    payerName?: string;
    address?: {
      fullName?: string;
      phone?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
  const summary = await service.getShopCheckoutSummary({
    studentId,
    items: Array.isArray(body.items)
      ? body.items.map((it) => ({
          productId: String(it.productId ?? "").trim(),
          quantity: Math.max(1, Math.floor(Number(it.quantity ?? 1))),
        }))
      : [],
    couponCode: body.couponCode,
    coinsToRedeem: body.coinsToRedeem,
  });
  const address = body.address ?? {};
  const fullName = String(address.fullName ?? "").trim();
  const phone = String(address.phone ?? "").trim();
  const line1 = String(address.line1 ?? "").trim();
  const city = String(address.city ?? "").trim();
  const state = String(address.state ?? "").trim();
  const postalCode = String(address.postalCode ?? "").trim();
  if (!fullName || !phone || !line1 || !city || !state || !postalCode) {
    throw new AppError("Complete delivery address is required", 400);
  }

  if (summary.payablePaise <= 0) {
    const order = await service.createShopOrderAfterCheckout({
      studentId,
      checkout: summary,
      address: {
        fullName,
        phone,
        line1,
        line2: String(address.line2 ?? "").trim(),
        city,
        state,
        postalCode,
      },
      actorId: studentId,
    });
    successRes(res, { orderId: order.id, mode: "COINS" }, "Order confirmed", 201);
    return;
  }

  if (!body.transactionId?.trim() || !body.paidAt?.trim()) {
    throw new AppError("transactionId and paidAt are required", 400);
  }
  const dt = new Date(body.paidAt);
  if (Number.isNaN(dt.getTime())) throw new AppError("paidAt must be a valid date/time", 400);
  const data = await submitStudentPayment({
    studentId,
    kind: "SHOP",
    transactionId: body.transactionId.trim(),
    paidAt: dt,
    amountPaise: summary.payablePaise,
    payerName: body.payerName?.trim() || undefined,
    submitterIp: req.ip,
    deviceId: typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : undefined,
    idempotencyKey: typeof req.headers["x-idempotency-key"] === "string" ? req.headers["x-idempotency-key"] : undefined,
    shopCheckout: {
      items: summary.items,
      couponCode: summary.couponCodeApplied,
      couponDiscountCoins: summary.couponDiscountCoins,
      totalCoinsAfterDiscount: summary.totalCoinsAfterDiscount,
      coinsToRedeem: summary.coinsToRedeem,
      payablePaise: summary.payablePaise,
      address: {
        fullName,
        phone,
        line1,
        line2: String(address.line2 ?? "").trim(),
        city,
        state,
        postalCode,
      },
    },
  });
  successRes(res, data, data.message, 201);
});

export const postPurchaseWithCoins = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { productId, couponCode } = req.body as { productId?: string; couponCode?: string };
  if (!productId?.trim()) throw new AppError("productId is required", 400);
  const data = await service.purchaseProduct(studentId, productId.trim(), couponCode);
  successRes(res, data, "Purchase complete");
});
