import { CouponModel } from "../models/Coupon.model.js";
import { CouponRedemptionModel } from "../models/CouponRedemption.model.js";
import { UserModel } from "../models/User.model.js";
import { ShopOrderModel } from "../models/ShopOrder.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { AppError } from "../utils/AppError.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import type { ClientSession } from "mongoose";

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** All courses within the coupon's batch. Requires a specific batchId (not all-batches). */
export const COUPON_ALL_COURSES_ID = "*";

/** Any batch at checkout. */
export const COUPON_ALL_BATCHES_ID = "*";

function isAllCoursesCoupon(courseId: string | undefined | null): boolean {
  const id = String(courseId ?? "").trim();
  return id === COUPON_ALL_COURSES_ID || id.toUpperCase() === "ALL";
}

function isAllBatchesCoupon(batchId: string | undefined | null): boolean {
  const id = String(batchId ?? "").trim();
  return id === COUPON_ALL_BATCHES_ID || id.toUpperCase() === "ALL";
}

function courseIdsInBatch(batch: unknown): Set<string> {
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const ids = new Set<string>();
  for (const snap of snaps) {
    const cid = String((snap as { courseId?: string }).courseId ?? "").trim();
    if (cid) ids.add(cid);
  }
  return ids;
}

function nowInRange(validFrom?: Date | null, validUntil?: Date | null): boolean {
  const now = Date.now();
  if (validFrom && now < validFrom.getTime()) return false;
  if (validUntil && now > validUntil.getTime()) return false;
  return true;
}

function applyDiscount(baseCoins: number, discountType: string, discountValue: number): number {
  const base = Math.max(0, Math.floor(baseCoins));
  if (discountType === "PERCENT") {
    const p = Math.min(100, Math.max(0, Math.floor(discountValue)));
    const off = Math.floor((base * p) / 100);
    return Math.max(0, base - off);
  }
  if (discountType === "FIXED_COINS") {
    const off = Math.max(0, Math.floor(discountValue));
    return Math.max(0, base - off);
  }
  return base;
}

/** Course list price in paise (INR × 100). */
function applyDiscountPaise(basePaise: number, discountType: string, discountValue: number): number {
  const base = Math.max(0, Math.floor(basePaise));
  if (discountType === "PERCENT") {
    const p = Math.min(100, Math.max(0, Math.floor(discountValue)));
    return Math.max(0, base - Math.floor((base * p) / 100));
  }
  return base;
}

export async function assertEnrollmentCoupon(
  code: string | undefined,
  batchMongoId: string,
  courseId: string,
  studentId: string,
  listPaise: number
): Promise<{ finalPricePaise: number; couponId: string | null }> {
  if (!code?.trim()) return { finalPricePaise: listPaise, couponId: null };
  const c = normalizeCode(code);
  const doc = await CouponModel.findOne({ code: c }).exec();
  if (!doc || !doc.active) throw new AppError("Not valid coupon code", 400);
  if (doc.kind !== "COURSE") throw new AppError("This coupon is not valid for course enrollment", 400);

  const couponBatchId = String((doc as { batchId?: string }).batchId ?? "").trim();
  const checkoutCourseId = String(courseId).trim();

  if (couponBatchId && !isAllBatchesCoupon(couponBatchId) && couponBatchId !== batchMongoId) {
    throw new AppError("Coupon does not apply to this batch", 400);
  }

  if (!isAllCoursesCoupon(doc.courseId)) {
    if (String(doc.courseId ?? "") !== checkoutCourseId) {
      throw new AppError("Coupon does not apply to this course", 400);
    }
  } else if (!isAllBatchesCoupon(couponBatchId)) {
    const batchDoc =
      couponBatchId === batchMongoId
        ? await BatchModel.findById(batchMongoId).lean().exec()
        : await findBatchByParam(couponBatchId);
    if (!batchDoc) throw new AppError("Coupon batch not found", 400);
    const allowed = courseIdsInBatch(batchDoc);
    if (!allowed.has(checkoutCourseId)) {
      throw new AppError("Coupon does not apply to this course in this batch", 400);
    }
  }
  if (!nowInRange(doc.validFrom ?? undefined, doc.validUntil ?? undefined)) throw new AppError("Coupon is not valid at this time", 400);
  if (doc.maxRedemptions != null && doc.redemptionCount >= doc.maxRedemptions) {
    throw new AppError("Coupon has reached its usage limit", 400);
  }

  const used = await CouponRedemptionModel.countDocuments({ couponId: String(doc._id), studentId }).exec();
  if (used >= 1) throw new AppError("You can use this coupon only once", 400);

  const list = Math.max(0, Math.floor(listPaise));
  const finalPricePaise = applyDiscountPaise(list, doc.discountType, doc.discountValue);
  if (list >= 100 && finalPricePaise > 0 && finalPricePaise < 100) {
    throw new AppError("Discounted amount must be at least ₹1 for paid checkout, or use a 100% discount for free access.", 400);
  }
  return { finalPricePaise, couponId: String(doc._id) };
}

export async function assertShopCouponForPurchase(
  code: string | undefined,
  _productId: string,
  studentId: string,
  listPriceCoins: number
): Promise<{ finalPrice: number; couponId: string | null }> {
  if (!code?.trim()) return { finalPrice: listPriceCoins, couponId: null };
  const c = normalizeCode(code);
  const doc = await CouponModel.findOne({ code: c }).exec();
  if (!doc || !doc.active) throw new AppError("Invalid coupon code", 400);
  if (doc.kind !== "SHOP") throw new AppError("This coupon is not valid for shop cart", 400);
  if (!nowInRange(doc.validFrom ?? undefined, doc.validUntil ?? undefined)) throw new AppError("Coupon is not valid at this time", 400);
  if (doc.maxRedemptions != null && doc.redemptionCount >= doc.maxRedemptions) throw new AppError("Coupon has reached its usage limit", 400);
  if ((doc as { shopScope?: string }).shopScope === "FIRST_ORDER") {
    const prior = await ShopOrderModel.findOne({ studentId }).select("_id").lean().exec();
    if (prior) throw new AppError("This coupon is only for first shop order", 400);
  }

  const used = await CouponRedemptionModel.countDocuments({ couponId: String(doc._id), studentId }).exec();
  if (used >= 1) throw new AppError("You can use this coupon only once", 400);

  const finalPrice = applyDiscount(listPriceCoins, doc.discountType, doc.discountValue);
  return { finalPrice, couponId: String(doc._id) };
}

export async function recordCouponRedemption(
  couponId: string,
  studentId: string,
  context?: string,
  session?: ClientSession
): Promise<void> {
  const redemptionContext = context?.trim() || "default";
  try {
    await CouponRedemptionModel.create(
      [{ couponId, studentId, context: redemptionContext }],
      session ? { session } : undefined
    );
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return;
    }
    throw err;
  }
  const coupon = await CouponModel.findOneAndUpdate(
    {
      _id: couponId,
      active: true,
      $or: [{ maxRedemptions: null }, { maxRedemptions: { $exists: false } }, { $expr: { $lt: ["$redemptionCount", "$maxRedemptions"] } }],
    },
    { $inc: { redemptionCount: 1 } },
    { new: true, session }
  ).exec();
  if (!coupon) {
    await CouponRedemptionModel.deleteOne({ couponId, studentId, context: redemptionContext }, session ? { session } : undefined).exec();
    throw new AppError("Coupon has reached its usage limit", 400);
  }
}

export async function listCouponAudit(input: { page: number; limit: number }): Promise<{
  rows: Array<{
    id: string;
    couponId: string;
    couponCode: string;
    couponKind: string;
    studentId: string;
    studentName: string;
    studentUsername: string;
    context: string;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const limit = Math.min(100, Math.max(1, input.limit));
  const page = Math.max(1, input.page);
  const skip = (page - 1) * limit;
  const [total, redemptions] = await Promise.all([
    CouponRedemptionModel.countDocuments({}).exec(),
    CouponRedemptionModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
  ]);
  const couponIds = [...new Set(redemptions.map((r) => String((r as { couponId: string }).couponId)))];
  const studentIds = [...new Set(redemptions.map((r) => String((r as { studentId: string }).studentId)))];
  const [coupons, users] = await Promise.all([
    couponIds.length ? CouponModel.find({ _id: { $in: couponIds } }).select("code kind").lean().exec() : [],
    studentIds.length ? UserModel.find({ _id: { $in: studentIds } }).select("name username").lean().exec() : [],
  ]);
  const cmap = new Map(coupons.map((c) => [String((c as { _id: unknown })._id), c as { code?: string; kind?: string }]));
  const umap = new Map(users.map((u) => [String((u as { _id: unknown })._id), u as { name?: string; username?: string }]));
  const rows = redemptions.map((r) => {
    const couponId = String((r as { couponId: string }).couponId);
    const studentId = String((r as { studentId: string }).studentId);
    const cp = cmap.get(couponId);
    const u = umap.get(studentId);
    return {
      id: String((r as { _id: unknown })._id),
      couponId,
      couponCode: cp?.code ?? couponId,
      couponKind: cp?.kind ?? "—",
      studentId,
      studentName: u?.name?.trim() || "—",
      studentUsername: u?.username?.trim() || "—",
      context: String((r as { context?: string }).context ?? ""),
      createdAt: (r as { createdAt?: Date }).createdAt ? new Date((r as { createdAt: Date }).createdAt).toISOString() : "",
    };
  });
  return { rows, total, page, limit };
}

export async function listCouponsAdmin() {
  const rows = await CouponModel.find({ kind: { $in: ["SHOP", "COURSE"] } }).sort({ createdAt: -1 }).lean().exec();
  return rows.map((r) => ({
    id: String(r._id),
    code: r.code,
    kind: r.kind,
    courseId: r.courseId ?? "",
    batchId: (r as { batchId?: string }).batchId ?? "",
    audience: (r as { audience?: string }).audience ?? "ALL_STUDENTS",
    shopScope: (r as { shopScope?: string }).shopScope ?? "ALL_ORDERS",
    discountType: r.discountType,
    discountValue: r.discountValue,
    maxRedemptions: r.maxRedemptions,
    redemptionCount: r.redemptionCount ?? 0,
    perStudentLimit: r.perStudentLimit ?? 1,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    active: r.active,
    notes: r.notes ?? "",
    createdBy: r.createdBy,
    createdAt: (r as { createdAt?: Date }).createdAt,
  }));
}

export async function createCouponAdmin(input: {
  code: string;
  kind: "SHOP" | "COURSE";
  courseId?: string;
  batchId?: string;
  audience?: "ALL_STUDENTS" | "BATCH_STUDENTS";
  shopScope?: "ALL_ORDERS" | "FIRST_ORDER";
  discountType: "PERCENT";
  discountValue: number;
  maxRedemptions?: number | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  active?: boolean;
  notes?: string;
  createdBy: string;
}) {
  const code = normalizeCode(input.code);
  if (code.length < 3) throw new AppError("Coupon code must be at least 3 characters", 400);
  if (input.kind === "SHOP") {
    // no per-product binding; coupon is cart-level.
  } else if (input.kind === "COURSE") {
    const courseId = input.courseId?.trim() ?? "";
    const batchId = input.batchId?.trim() ?? "";
    if (!batchId) {
      throw new AppError("batchId is required for course coupons (use * for all batches)", 400);
    }
    if (!courseId) {
      throw new AppError("courseId is required for course coupons (use * for all courses in the batch)", 400);
    }
    if (isAllCoursesCoupon(courseId) && isAllBatchesCoupon(batchId)) {
      throw new AppError("All courses in batch requires a specific batch (not all batches)", 400);
    }
    if (isAllCoursesCoupon(courseId) && !isAllBatchesCoupon(batchId)) {
      const batch = await findBatchByParam(batchId);
      if (!batch) throw new AppError("Batch not found", 400);
      if (courseIdsInBatch(batch).size === 0) {
        throw new AppError("Selected batch has no courses", 400);
      }
    }
  }
  const discountValue = Math.floor(Number(input.discountValue));
  if (!Number.isFinite(discountValue) || discountValue < 0) throw new AppError("Invalid discount value", 400);
  if (discountValue < 1 || discountValue > 100) {
    throw new AppError("Percent discount must be 1–100", 400);
  }
  const maxRedemptions =
    input.maxRedemptions == null
      ? null
      : (Number.isFinite(Number(input.maxRedemptions))
          ? Math.max(0, Math.floor(Number(input.maxRedemptions)))
          : (() => {
              throw new AppError("maxRedemptions must be a valid number", 400);
            })());

  try {
    const doc = await CouponModel.create({
      code,
      kind: input.kind,
      courseId: input.kind === "COURSE" ? input.courseId!.trim() : undefined,
      batchId: input.kind === "COURSE" ? input.batchId!.trim() : undefined,
      audience:
        input.kind === "COURSE"
          ? input.audience === "BATCH_STUDENTS"
            ? "BATCH_STUDENTS"
            : "ALL_STUDENTS"
          : undefined,
      shopScope: input.kind === "SHOP" ? (input.shopScope === "FIRST_ORDER" ? "FIRST_ORDER" : "ALL_ORDERS") : undefined,
      discountType: "PERCENT",
      discountValue,
      maxRedemptions,
      perStudentLimit: 1,
      validFrom: input.validFrom ?? undefined,
      validUntil: input.validUntil ?? undefined,
      active: input.active !== false,
      notes: input.notes?.trim() ?? "",
      createdBy: input.createdBy,
    });
    return { id: String(doc._id) };
  } catch (e: unknown) {
    if ((e as { code?: number })?.code === 11000) throw new AppError("That coupon code already exists", 400);
    throw e;
  }
}

export async function patchCouponAdmin(
  couponId: string,
  input: Partial<{ active: boolean; maxRedemptions: number | null; validUntil: Date | null; notes: string }>
) {
  const doc = await CouponModel.findById(couponId).exec();
  if (!doc) throw new AppError("Coupon not found", 404);
  if (input.active != null) doc.active = Boolean(input.active);
  if (input.maxRedemptions !== undefined) doc.maxRedemptions = input.maxRedemptions;
  if (input.validUntil !== undefined) doc.validUntil = input.validUntil ?? undefined;
  if (input.notes != null) doc.notes = String(input.notes).trim();
  await doc.save();
  return { id: String(doc._id) };
}
