import type { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import {
  redeemLicenseKey,
  generateCourseLicenseKeys,
  listLicenseKeyAudit,
} from "../services/licenseKey.service.js";
import {
  submitStudentPayment,
  verifyPaymentAndEnroll,
  rejectPaymentSubmission,
  listPendingPayments,
  hasPendingCoursePayment,
  hasPendingShopPayment,
  getLatestCoursePaymentState,
  getLatestShopPaymentState,
  getEnrollmentCheckoutPricing,
  createStudentRazorpayOrder,
  confirmRazorpayCoursePayment,
  getStudentPaymentTimeline,
} from "../services/paymentSubmission.service.js";
import { getRazorpayPublicKeyId, isRazorpayConfigured } from "../services/razorpay.service.js";
import { formatPaymentMethodsLabel } from "../utils/coursePaymentMethods.js";
import { setEnrollmentAccessBlocked, setEnrollmentCourseAccessBlocked } from "../services/enrollment.service.js";
import { setUsernameBySuperAdmin } from "../services/auth.service.js";
import { successRes } from "../utils/response.js";
import { UserModel } from "../models/User.model.js";
import { ShopProductModel } from "../models/ShopProduct.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { CourseModel } from "../models/Course.model.js";
import { PaymentSubmissionModel } from "../models/PaymentSubmission.model.js";
import { CouponModel } from "../models/Coupon.model.js";
import { getBatchCourseSnapshots } from "../services/batch.service.js";
import { buildStaticUpiQr, getPaymentUpiConfig } from "../services/paymentUpi.service.js";
import { listCoinGrantHistoryForUser } from "../services/coinBalance.service.js";

function uid(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new AppError("Unauthorized", 401);
  return id;
}

export const postRedeemLicense = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const { licenseKey } = req.body as { licenseKey?: string };
  if (!licenseKey?.trim()) throw new AppError("licenseKey is required", 400);
  const data = await redeemLicenseKey(studentId, licenseKey);
  successRes(res, data);
});

export const postSubmitPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const body = req.body as {
    kind?: string;
    batchId?: string;
    courseId?: string;
    productId?: string;
    transactionId?: string;
    paidAt?: string;
    amountPaise?: number;
    payerName?: string;
    couponCode?: string;
    shopCheckout?: {
      items?: Array<{
        productId?: string;
        productName?: string;
        quantity?: number;
        unitPriceCoins?: number;
        lineTotalCoins?: number;
      }>;
      couponCode?: string;
      couponDiscountCoins?: number;
      totalCoinsAfterDiscount?: number;
      coinsToRedeem?: number;
      payablePaise?: number;
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
  };
  const { transactionId, paidAt } = body;
  if (!transactionId || !paidAt) {
    throw new AppError("transactionId and paidAt are required", 400);
  }
  const dt = new Date(paidAt);
  if (Number.isNaN(dt.getTime())) throw new AppError("paidAt must be a valid date/time", 400);
  const kind = String(body.kind ?? "COURSE").toUpperCase() === "SHOP" ? "SHOP" : "COURSE";
  const amountPaise = body.amountPaise != null ? Math.floor(Number(body.amountPaise)) : undefined;
  const payerName = typeof body.payerName === "string" ? body.payerName : undefined;
  const data = await submitStudentPayment({
    studentId,
    kind,
    batchId: body.batchId,
    courseId: body.courseId,
    productId: body.productId,
    transactionId,
    paidAt: dt,
    amountPaise: kind === "COURSE" ? amountPaise : undefined,
    payerName: kind === "COURSE" || kind === "SHOP" ? payerName : undefined,
    couponCode: kind === "COURSE" && typeof body.couponCode === "string" ? body.couponCode : undefined,
    submitterIp: req.ip,
    deviceId: typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : undefined,
    idempotencyKey: typeof req.headers["x-idempotency-key"] === "string" ? req.headers["x-idempotency-key"] : undefined,
    shopCheckout:
      kind === "SHOP" && body.shopCheckout
        ? {
            items: Array.isArray(body.shopCheckout.items)
              ? body.shopCheckout.items.map((it) => ({
                  productId: String(it.productId ?? "").trim(),
                  productName: String(it.productName ?? "").trim(),
                  quantity: Math.max(1, Math.floor(Number(it.quantity ?? 1))),
                  unitPriceCoins: Math.max(0, Math.floor(Number(it.unitPriceCoins ?? 0))),
                  lineTotalCoins: Math.max(0, Math.floor(Number(it.lineTotalCoins ?? 0))),
                }))
              : [],
            couponCode: typeof body.shopCheckout.couponCode === "string" ? body.shopCheckout.couponCode : undefined,
            couponDiscountCoins: Number(body.shopCheckout.couponDiscountCoins ?? 0),
            totalCoinsAfterDiscount: Number(body.shopCheckout.totalCoinsAfterDiscount ?? 0),
            coinsToRedeem: Number(body.shopCheckout.coinsToRedeem ?? 0),
            payablePaise: Number(body.shopCheckout.payablePaise ?? 0),
            address: body.shopCheckout.address
              ? {
                  fullName: String(body.shopCheckout.address.fullName ?? "").trim(),
                  phone: String(body.shopCheckout.address.phone ?? "").trim(),
                  line1: String(body.shopCheckout.address.line1 ?? "").trim(),
                  line2: String(body.shopCheckout.address.line2 ?? "").trim(),
                  city: String(body.shopCheckout.address.city ?? "").trim(),
                  state: String(body.shopCheckout.address.state ?? "").trim(),
                  postalCode: String(body.shopCheckout.address.postalCode ?? "").trim(),
                }
              : undefined,
          }
        : undefined,
  });
  successRes(res, data, data.message, 201);
});

export const getCourseCheckout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const courseId = req.params.courseId?.trim();
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId.trim() : "";
  const couponCode = typeof req.query.couponCode === "string" ? req.query.couponCode : undefined;
  if (!courseId || !batchId) throw new AppError("courseId and batchId are required", 400);
  const pricing = await getEnrollmentCheckoutPricing(studentId, batchId, courseId, couponCode);
  let upiQrUrl = pricing.upiQrUrl ?? "";
  let upiPaymentLink: string | undefined;
  let upiQrRefreshAfterSeconds: number | undefined;
  if (pricing.allowUpiManual && pricing.finalPaise > 0) {
    try {
      const cfg = await getPaymentUpiConfig();
      const staticQr = await buildStaticUpiQr({
        upiId: cfg.upiId,
        receiverName: cfg.receiverName,
        amountPaise: pricing.finalPaise,
      });
      upiQrUrl = staticQr.qrDataUrl;
      upiPaymentLink = staticQr.paymentLink;
      upiQrRefreshAfterSeconds = undefined;
    } catch {
      // Fallback: keep static QR (batch or env) if configured.
    }
  }
  const rk = getRazorpayPublicKeyId();
  const razorpayConfigured = isRazorpayConfigured() && !!rk;
  const razorpayEnabled =
    razorpayConfigured && pricing.listPaise >= 100 && pricing.allowRazorpayMethod;
  successRes(res, {
    courseTitle: pricing.courseTitle,
    enrollmentPriceInPaise: pricing.listPaise,
    enrollmentPriceRupees: pricing.listPaise / 100,
    finalPriceInPaise: pricing.finalPaise,
    finalPriceRupees: pricing.finalPaise / 100,
    discountPaise: pricing.discountPaise,
    couponApplied: pricing.couponApplied,
    couponMessage: pricing.couponMessage,
    upiQrUrl,
    upiPaymentLink,
    upiQrRefreshAfterSeconds,
    allowUpiManual: pricing.allowUpiManual,
    allowRazorpayMethod: pricing.allowRazorpayMethod,
    allowedPaymentMethods: pricing.allowedPaymentMethods,
    paymentMethodsLabel: formatPaymentMethodsLabel(pricing.allowedPaymentMethods),
    razorpayEnabled,
    razorpayKeyId: rk ?? undefined,
  });
});

export const postStudentRazorpayOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const { batchId, courseId, couponCode } = req.body as { batchId?: string; courseId?: string; couponCode?: string };
  if (!batchId?.trim() || !courseId?.trim()) throw new AppError("batchId and courseId are required", 400);
  const data = await createStudentRazorpayOrder(studentId, batchId.trim(), courseId.trim(), couponCode);
  successRes(res, data);
});

export const postStudentRazorpayConfirm = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const body = req.body as {
    batchId?: string;
    courseId?: string;
    couponCode?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const { batchId, courseId, couponCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!batchId?.trim() || !courseId?.trim()) throw new AppError("batchId and courseId are required", 400);
  if (!razorpay_order_id?.trim() || !razorpay_payment_id?.trim() || !razorpay_signature?.trim()) {
    throw new AppError("razorpay_order_id, razorpay_payment_id, and razorpay_signature are required", 400);
  }
  const data = await confirmRazorpayCoursePayment({
    studentId,
    batchId: batchId.trim(),
    courseId: courseId.trim(),
    couponCode,
    razorpay_order_id: razorpay_order_id.trim(),
    razorpay_payment_id: razorpay_payment_id.trim(),
    razorpay_signature: razorpay_signature.trim(),
  });
  successRes(res, data, data.message, 201);
});

export const getStudentPaymentPending = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : undefined;
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
  let coursePending = false;
  let shopPending = false;
  let courseRejected = false;
  let shopRejected = false;
  let courseRejectReason: string | undefined;
  let shopRejectReason: string | undefined;
  if (batchId && courseId) {
    coursePending = await hasPendingCoursePayment(studentId, batchId, courseId);
    const st = await getLatestCoursePaymentState(studentId, batchId, courseId);
    courseRejected = st?.status === "REJECTED";
    courseRejectReason = st?.rejectReason;
  }
  if (productId) {
    shopPending = await hasPendingShopPayment(studentId, productId);
    const st = await getLatestShopPaymentState(studentId, productId);
    shopRejected = st?.status === "REJECTED";
    shopRejectReason = st?.rejectReason;
  }
  successRes(res, { coursePending, shopPending, courseRejected, shopRejected, courseRejectReason, shopRejectReason });
});

export const getStudentPaymentTimelineView = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const kind = String(req.query.kind ?? "COURSE").toUpperCase() === "SHOP" ? "SHOP" : "COURSE";
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : undefined;
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
  const doc = await getStudentPaymentTimeline({ studentId, kind, batchId, courseId, productId });
  if (!doc) {
    successRes(res, null);
    return;
  }
  const out = doc as {
    status?: string;
    rejectReason?: string;
    createdAt?: Date;
    updatedAt?: Date;
    riskFlags?: string[];
    statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }>;
  };
  successRes(res, {
    status: out.status ?? "PENDING",
    rejectReason: out.rejectReason ?? "",
    createdAt: out.createdAt,
    updatedAt: out.updatedAt,
    expectedSlaHours: 24,
    riskFlags: Array.isArray(out.riskFlags) ? out.riskFlags : [],
    statusHistory: Array.isArray(out.statusHistory) ? out.statusHistory : [],
  });
});

export const getMyCoinGrants = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 200;
  const data = await listCoinGrantHistoryForUser(studentId, limitRaw);
  successRes(res, data);
});

export const getAdminPaymentsFinance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const fromQuery = typeof req.query.fromDate === "string" ? req.query.fromDate : "";
  const toQuery = typeof req.query.toDate === "string" ? req.query.toDate : "";
  const start = fromQuery ? new Date(fromQuery) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = toQuery ? new Date(toQuery) : now;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Invalid fromDate or toDate", 400);
  }
  const batchIdFilter = typeof req.query.batchId === "string" ? req.query.batchId.trim() : "";
  const courseIdFilter = typeof req.query.courseId === "string" ? req.query.courseId.trim() : "";
  const couponCodeFilter = typeof req.query.couponCode === "string" ? req.query.couponCode.trim().toUpperCase() : "";
  const kindFilter = { $or: [{ kind: "COURSE" }, { kind: { $exists: false } }] } as const;
  const base: Record<string, unknown> = { ...kindFilter, createdAt: { $gte: start, $lte: end } };
  if (batchIdFilter) base.batchId = batchIdFilter;
  if (courseIdFilter) base.courseId = courseIdFilter;
  if (couponCodeFilter) base.couponCode = couponCodeFilter;

  const [totalAttempts, verifiedCount, rejectedCount, pendingCount, verifiedAmountAgg, topBatchesAgg, topCoursesAgg, failedReasonsAgg] =
    await Promise.all([
      PaymentSubmissionModel.countDocuments(base).exec(),
      PaymentSubmissionModel.countDocuments({ ...base, status: "VERIFIED" }).exec(),
      PaymentSubmissionModel.countDocuments({ ...base, status: "REJECTED" }).exec(),
      PaymentSubmissionModel.countDocuments({ ...base, status: "PENDING" }).exec(),
      PaymentSubmissionModel.aggregate<{ total: number }>([
        { $match: { ...base, status: "VERIFIED" } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$amountPaise", 0] } } } },
      ]),
      PaymentSubmissionModel.aggregate<{ _id: string; count: number; revenuePaise: number }>([
        { $match: { ...base, status: "VERIFIED", batchId: { $exists: true, $ne: null } } },
        { $group: { _id: "$batchId", count: { $sum: 1 }, revenuePaise: { $sum: { $ifNull: ["$amountPaise", 0] } } } },
        { $sort: { revenuePaise: -1 } },
        { $limit: 10 },
      ]),
      PaymentSubmissionModel.aggregate<{ _id: string; count: number; revenuePaise: number }>([
        { $match: { ...base, status: "VERIFIED", courseId: { $exists: true, $ne: null } } },
        { $group: { _id: "$courseId", count: { $sum: 1 }, revenuePaise: { $sum: { $ifNull: ["$amountPaise", 0] } } } },
        { $sort: { revenuePaise: -1 } },
        { $limit: 10 },
      ]),
      PaymentSubmissionModel.aggregate<{ _id: string; count: number }>([
        { $match: { ...base, status: "REJECTED" } },
        { $project: { reason: { $ifNull: ["$rejectReason", "Unspecified"] } } },
        { $group: { _id: "$reason", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

  const couponAgg = await PaymentSubmissionModel.aggregate<{ _id: string; redemptions: number; couponCode: string }>([
    {
      $match: {
        ...base,
        status: "VERIFIED",
        couponId: { $exists: true, $nin: [null, ""] },
      },
    },
    {
      $group: {
        _id: "$couponId",
        redemptions: { $sum: 1 },
      },
    },
    {
      $addFields: {
        couponObjectId: {
          $convert: {
            input: "$_id",
            to: "objectId",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { couponObjectId: { $ne: null } } },
    {
      $lookup: {
        from: CouponModel.collection.name,
        localField: "couponObjectId",
        foreignField: "_id",
        as: "coupon",
      },
    },
    { $unwind: "$coupon" },
    ...(couponCodeFilter ? [{ $match: { "coupon.code": couponCodeFilter } }] : []),
    { $addFields: { couponCode: "$coupon.code" } },
    { $sort: { redemptions: -1 } },
    { $limit: 10 },
  ]);

  const toRupees = (paise: number) => Number((paise / 100).toFixed(2));
  const revenuePaise = Number(verifiedAmountAgg[0]?.total ?? 0);
  const conversion = totalAttempts > 0 ? Number(((verifiedCount / totalAttempts) * 100).toFixed(1)) : 0;
  const batchIds = topBatchesAgg.map((b) => String(b._id)).filter(Boolean);
  const courseIds = topCoursesAgg.map((c) => String(c._id)).filter(Boolean);
  const [batchDocs, courseDocs] = await Promise.all([
    batchIds.length ? BatchModel.find({ _id: { $in: batchIds } }).select("_id name batchId").lean().exec() : [],
    courseIds.length ? CourseModel.find({ courseId: { $in: courseIds } }).select("courseId title").lean().exec() : [],
  ]);
  const batchNameById = new Map(
    batchDocs.map((b) => {
      const bb = b as { _id: unknown; name?: string; batchId?: string };
      return [String(bb._id), bb.name?.trim() || bb.batchId?.trim() || String(bb._id)];
    })
  );
  const courseNameById = new Map(
    courseDocs.map((c) => {
      const cc = c as { courseId?: string; title?: string };
      return [String(cc.courseId ?? ""), cc.title?.trim() || String(cc.courseId ?? "")];
    })
  );

  const payload = {
    rangeDays: Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))),
    filters: {
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      batchId: batchIdFilter || "",
      courseId: courseIdFilter || "",
      couponCode: couponCodeFilter || "",
    },
    revenue: {
      verifiedRevenuePaise: revenuePaise,
      verifiedRevenueRupees: toRupees(revenuePaise),
      verifiedCount,
    },
    funnel: {
      totalAttempts,
      pendingCount,
      rejectedCount,
      verifiedCount,
      conversionRatePercent: conversion,
    },
    failedReasons: failedReasonsAgg.map((r) => ({ reason: r._id || "Unspecified", count: r.count })),
    topCoupons: couponAgg.map((c) => ({ couponCode: c.couponCode || "UNKNOWN", redemptions: c.redemptions })),
    topBatches: topBatchesAgg.map((b) => ({
      ...b,
      name: batchNameById.get(String(b._id)) || String(b._id),
    })),
    topCourses: topCoursesAgg.map((c) => ({
      ...c,
      name: courseNameById.get(String(c._id)) || String(c._id),
    })),
  };

  if (req.query.format === "csv") {
    const lines = [
      "section,key,value",
      `revenue,verified_revenue_rupees,${payload.revenue.verifiedRevenueRupees}`,
      `revenue,verified_count,${payload.revenue.verifiedCount}`,
      `funnel,total_attempts,${payload.funnel.totalAttempts}`,
      `funnel,pending_count,${payload.funnel.pendingCount}`,
      `funnel,rejected_count,${payload.funnel.rejectedCount}`,
      `funnel,verified_count,${payload.funnel.verifiedCount}`,
      `funnel,conversion_rate_percent,${payload.funnel.conversionRatePercent}`,
      ...payload.failedReasons.map((r) => `failed_reason,"${String(r.reason).split('"').join('""')}",${r.count}`),
      ...payload.topCoupons.map((c) => `coupon,${c.couponCode},${c.redemptions}`),
      ...payload.topBatches.map((b) => `batch,"${String(b.name).split('"').join('""')}",${b.revenuePaise}`),
      ...payload.topCourses.map((c) => `course,"${String(c.name).split('"').join('""')}",${c.revenuePaise}`),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="payment-finance-dashboard.csv"');
    res.status(200).send(lines.join("\n"));
    return;
  }
  successRes(res, payload);
});

export const postGenerateLicense = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const { courseId, batchId, count } = req.body as { courseId?: string; batchId?: string; count?: number };
  if (!courseId?.trim()) throw new AppError("courseId is required", 400);
  const data = await generateCourseLicenseKeys({
    courseId: courseId.trim(),
    batchId: batchId?.trim(),
    createdBy: adminId,
    count,
  });
  if (!data.keys?.length) {
    throw new AppError("License key generation produced no keys", 500);
  }
  const msg =
    data.keys.length > 1 ? `${data.keys.length} license keys created (one use each)` : "License key created";
  successRes(res, data, msg, 201);
});

export const getLicenseKeyAudit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(q.limit || "25"), 10) || 25));
  const usedOnly = q.usedOnly === "1" || q.usedOnly === "true";
  const result = await listLicenseKeyAudit({ page, limit, usedOnly });
  successRes(res, result);
});

export const getPendingPayments = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const mode = String(_req.query.queue ?? "").toLowerCase();
  const all = await listPendingPayments();
  const list =
    mode === "risk"
      ? all.filter((p) => Array.isArray((p as { riskFlags?: string[] }).riskFlags) && ((p as { riskFlags?: string[] }).riskFlags ?? []).length > 0)
      : all;
  const studentIds = [...new Set(list.map((p) => p.studentId))];
  const users = await UserModel.find({ _id: { $in: studentIds } })
    .select("name username")
    .lean()
    .exec();
  const umap = new Map(users.map((u) => [String(u._id), u as { name?: string; username?: string }]));

  const rawBatchKeys = [
    ...new Set(
      list
        .filter((p) => (p as { kind?: string }).kind !== "SHOP" && (p as { batchId?: string }).batchId?.trim())
        .map((p) => String((p as { batchId?: string }).batchId))
    ),
  ];
  const batchObjectIds: mongoose.Types.ObjectId[] = [];
  const batchHumanIds: string[] = [];
  for (const key of rawBatchKeys) {
    if (mongoose.Types.ObjectId.isValid(key) && new mongoose.Types.ObjectId(key).toString() === key) {
      batchObjectIds.push(new mongoose.Types.ObjectId(key));
    } else if (key) batchHumanIds.push(key);
  }
  const batchOr: Record<string, unknown>[] = [];
  if (batchObjectIds.length) batchOr.push({ _id: { $in: batchObjectIds } });
  if (batchHumanIds.length) batchOr.push({ batchId: { $in: batchHumanIds } });
  const batches =
    batchOr.length > 0
      ? await BatchModel.find({ $or: batchOr })
          .select("name batchId courseSnapshots courseSnapshot")
          .lean()
          .exec()
      : [];
  type BatchLean = { _id: unknown; name?: string; batchId?: string; courseSnapshots?: unknown[]; courseSnapshot?: unknown };
  const batchByKey = new Map<string, BatchLean>();
  for (const b of batches as BatchLean[]) {
    batchByKey.set(String(b._id), b);
    if (b.batchId) batchByKey.set(String(b.batchId), b);
  }

  const courseIdSet = new Set<string>();
  for (const p of list) {
    if ((p as { kind?: string }).kind === "SHOP") continue;
    const cid = (p as { courseId?: string }).courseId?.trim();
    if (cid) courseIdSet.add(cid);
  }
  const courseIds = [...courseIdSet];
  const oidCourse = courseIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const courses =
    courseIds.length > 0
      ? await CourseModel.find({
          $or: [{ courseId: { $in: courseIds } }, ...(oidCourse.length ? [{ _id: { $in: oidCourse } }] : [])],
        })
          .select("title courseId")
          .lean()
          .exec()
      : [];
  const titleByCourseKey = new Map<string, string>();
  for (const c of courses) {
    const t = ((c as { title?: string }).title ?? "").trim();
    const human = (c as { courseId?: string }).courseId;
    if (human) titleByCourseKey.set(String(human), t);
    titleByCourseKey.set(String((c as { _id: unknown })._id), t);
  }

  function courseTitleForRow(batchId: string | undefined, courseId: string | undefined): string {
    if (!courseId) return "";
    const bdoc = batchId ? batchByKey.get(String(batchId)) : undefined;
    const snaps = bdoc ? (getBatchCourseSnapshots(bdoc as never) as { courseId?: string; title?: string }[]) : [];
    const snap = snaps.find((s) => String(s.courseId ?? "") === String(courseId));
    const fromSnap = (snap?.title ?? "").trim();
    if (fromSnap) return fromSnap;
    return (titleByCourseKey.get(courseId) ?? "").trim();
  }

  function batchLabelForRow(batchId: string | undefined): string {
    if (!batchId) return "";
    const bdoc = batchByKey.get(String(batchId));
    if (!bdoc) return "";
    const n = (bdoc.name ?? "").trim();
    const code = (bdoc.batchId ?? "").trim();
    if (n && code) return `${n} (${code})`;
    return n || code;
  }

  const shopProductIds = [
    ...new Set(
      list
        .filter((p) => (p as { kind?: string }).kind === "SHOP" && (p as { productId?: string }).productId)
        .map((p) => (p as { productId?: string }).productId as string)
    ),
  ];
  const products = shopProductIds.length
    ? await ShopProductModel.find({ _id: { $in: shopProductIds } })
        .select("name")
        .lean()
        .exec()
    : [];
  const pmap = new Map(products.map((pr) => [String(pr._id), (pr as { name?: string }).name ?? ""]));
  const out = list.map((p) => {
    const row = p as {
      _id: unknown;
      kind?: string;
      productId?: string;
      batchId?: string;
      courseId?: string;
      studentId: string;
      transactionId: string;
      paidAt: Date;
      status: string;
      paymentMethod?: string;
      amountPaise?: number;
      payerName?: string;
      razorpayVerified?: boolean;
      riskFlags?: string[];
      riskEscalatedAt?: Date;
    };
    const u = umap.get(row.studentId);
    const kind = row.kind === "SHOP" ? "SHOP" : "COURSE";
    const productName = kind === "SHOP" && row.productId ? pmap.get(row.productId) ?? "" : "";
    return {
      id: String(row._id),
      kind,
      studentId: row.studentId,
      studentName: u?.name ?? "",
      studentUsername: u?.username ?? "",
      batchId: row.batchId ?? "",
      batchName: kind === "COURSE" ? batchLabelForRow(row.batchId) : "",
      courseId: row.courseId ?? "",
      courseTitle: kind === "COURSE" ? courseTitleForRow(row.batchId, row.courseId) : "",
      productId: row.productId ?? "",
      productName,
      transactionId: row.transactionId,
      paidAt: row.paidAt,
      status: row.status,
      createdAt: (p as { createdAt?: Date }).createdAt,
      paymentMethod: row.paymentMethod ?? "UPI_MANUAL",
      amountPaise: row.amountPaise,
      payerName: row.payerName ?? "",
      razorpayVerified: !!row.razorpayVerified,
      riskFlags: Array.isArray(row.riskFlags) ? row.riskFlags : [],
      riskEscalatedAt: row.riskEscalatedAt,
    };
  });
  successRes(res, out);
});

export const postVerifyPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const paymentId = req.params.id;
  if (!paymentId) throw new AppError("Payment id is required", 400);
  const data = await verifyPaymentAndEnroll(paymentId, adminId);
  successRes(res, data, data.message);
});

export const postRejectPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const paymentId = req.params.id;
  if (!paymentId) throw new AppError("Payment id is required", 400);
  const { reason } = req.body as { reason?: string };
  await rejectPaymentSubmission(paymentId, adminId, reason);
  successRes(res, { ok: true }, "Payment rejected. The student can submit a new payment.");
});

export const patchEnrollmentAccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { blocked } = req.body as { blocked?: boolean };
  if (typeof blocked !== "boolean") throw new AppError("blocked (boolean) is required", 400);
  const doc = await setEnrollmentAccessBlocked(id, blocked);
  successRes(res, { id: String(doc._id), accessBlocked: !!(doc as { accessBlocked?: boolean }).accessBlocked });
});

export const patchEnrollmentCourseAccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { courseId, blocked } = req.body as { courseId?: string; blocked?: boolean };
  if (!courseId?.trim()) throw new AppError("courseId is required", 400);
  if (typeof blocked !== "boolean") throw new AppError("blocked (boolean) is required", 400);
  const doc = await setEnrollmentCourseAccessBlocked(id, courseId.trim(), blocked);
  successRes(res, {
    id: String(doc._id),
    courseId: courseId.trim(),
    blocked,
  });
});

export const patchUserUsername = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { username } = req.body as { username?: string };
  if (!userId || !username?.trim()) throw new AppError("userId and username are required", 400);
  await setUsernameBySuperAdmin(userId, username);
  successRes(res, { ok: true });
});
