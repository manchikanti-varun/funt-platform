import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { redeemLicenseKey, generateCourseLicenseKey } from "../services/licenseKey.service.js";
import {
  submitStudentPayment,
  verifyPaymentAndEnroll,
  rejectPaymentSubmission,
  listPendingPayments,
  hasPendingCoursePayment,
  hasPendingShopPayment,
  getLatestCoursePaymentState,
  getLatestShopPaymentState,
} from "../services/paymentSubmission.service.js";
import { setEnrollmentAccessBlocked } from "../services/enrollment.service.js";
import { setUsernameBySuperAdmin } from "../services/auth.service.js";
import { successRes } from "../utils/response.js";
import { UserModel } from "../models/User.model.js";
import { ShopProductModel } from "../models/ShopProduct.model.js";

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
  };
  const { transactionId, paidAt } = body;
  if (!transactionId || !paidAt) {
    throw new AppError("transactionId and paidAt are required", 400);
  }
  const dt = new Date(paidAt);
  if (Number.isNaN(dt.getTime())) throw new AppError("paidAt must be a valid date/time", 400);
  const kind = String(body.kind ?? "COURSE").toUpperCase() === "SHOP" ? "SHOP" : "COURSE";
  const data = await submitStudentPayment({
    studentId,
    kind,
    batchId: body.batchId,
    courseId: body.courseId,
    productId: body.productId,
    transactionId,
    paidAt: dt,
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

export const postGenerateLicense = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const { courseId, batchId } = req.body as { courseId?: string; batchId?: string };
  if (!courseId?.trim()) throw new AppError("courseId is required", 400);
  const data = await generateCourseLicenseKey({ courseId: courseId.trim(), batchId: batchId?.trim(), createdBy: adminId });
  successRes(res, data, "License key created", 201);
});

export const getPendingPayments = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const list = await listPendingPayments();
  const studentIds = [...new Set(list.map((p) => p.studentId))];
  const users = await UserModel.find({ _id: { $in: studentIds } })
    .select("name username")
    .lean()
    .exec();
  const umap = new Map(users.map((u) => [String(u._id), u as { name?: string; username?: string }]));
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
      courseId: row.courseId ?? "",
      productId: row.productId ?? "",
      productName,
      transactionId: row.transactionId,
      paidAt: row.paidAt,
      status: row.status,
      createdAt: (p as { createdAt?: Date }).createdAt,
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

export const patchUserUsername = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { username } = req.body as { username?: string };
  if (!userId || !username?.trim()) throw new AppError("userId and username are required", 400);
  await setUsernameBySuperAdmin(userId, username);
  successRes(res, { ok: true });
});
