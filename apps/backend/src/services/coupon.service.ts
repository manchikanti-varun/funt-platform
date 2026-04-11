import { CouponModel } from "../models/Coupon.model.js";
import { CouponRedemptionModel } from "../models/CouponRedemption.model.js";
import { AppError } from "../utils/AppError.js";

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
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

export async function assertShopCouponForPurchase(
  code: string | undefined,
  productId: string,
  studentId: string,
  listPriceCoins: number
): Promise<{ finalPrice: number; couponId: string | null }> {
  if (!code?.trim()) return { finalPrice: listPriceCoins, couponId: null };
  const c = normalizeCode(code);
  const doc = await CouponModel.findOne({ code: c }).exec();
  if (!doc || !doc.active) throw new AppError("Invalid coupon code", 400);
  if (doc.kind !== "SHOP") throw new AppError("This coupon is not valid for shop items", 400);
  if (String(doc.productId) !== String(productId)) throw new AppError("Coupon does not apply to this product", 400);
  if (!nowInRange(doc.validFrom ?? undefined, doc.validUntil ?? undefined)) throw new AppError("Coupon is not valid at this time", 400);
  if (doc.maxRedemptions != null && doc.redemptionCount >= doc.maxRedemptions) throw new AppError("Coupon has reached its usage limit", 400);

  const used = await CouponRedemptionModel.countDocuments({ couponId: String(doc._id), studentId }).exec();
  if (used >= (doc.perStudentLimit ?? 1)) throw new AppError("You have already used this coupon the maximum number of times", 400);

  const finalPrice = applyDiscount(listPriceCoins, doc.discountType, doc.discountValue);
  return { finalPrice, couponId: String(doc._id) };
}

export async function assertCourseCouponForCertificate(
  code: string | undefined,
  batchMongoId: string,
  courseId: string,
  studentId: string,
  listPriceCoins: number
): Promise<{ finalPrice: number; couponId: string | null }> {
  if (!code?.trim()) return { finalPrice: listPriceCoins, couponId: null };
  const c = normalizeCode(code);
  const doc = await CouponModel.findOne({ code: c }).exec();
  if (!doc || !doc.active) throw new AppError("Invalid coupon code", 400);
  if (doc.kind !== "COURSE") throw new AppError("This coupon is not valid for certificates", 400);
  if (String(doc.batchId) !== String(batchMongoId)) throw new AppError("Coupon does not apply to this batch", 400);
  if (String(doc.courseId ?? "") !== String(courseId)) throw new AppError("Coupon does not apply to this course", 400);
  if (!nowInRange(doc.validFrom ?? undefined, doc.validUntil ?? undefined)) throw new AppError("Coupon is not valid at this time", 400);
  if (doc.maxRedemptions != null && doc.redemptionCount >= doc.maxRedemptions) throw new AppError("Coupon has reached its usage limit", 400);

  const used = await CouponRedemptionModel.countDocuments({ couponId: String(doc._id), studentId }).exec();
  if (used >= (doc.perStudentLimit ?? 1)) throw new AppError("You have already used this coupon the maximum number of times", 400);

  const finalPrice = applyDiscount(listPriceCoins, doc.discountType, doc.discountValue);
  return { finalPrice, couponId: String(doc._id) };
}

export async function recordCouponRedemption(couponId: string, studentId: string, context?: string): Promise<void> {
  await CouponRedemptionModel.create({ couponId, studentId, context });
  await CouponModel.updateOne({ _id: couponId }, { $inc: { redemptionCount: 1 } }).exec();
}

export async function listCouponsAdmin() {
  const rows = await CouponModel.find({}).sort({ createdAt: -1 }).lean().exec();
  return rows.map((r) => ({
    id: String(r._id),
    code: r.code,
    kind: r.kind,
    batchId: r.batchId ?? "",
    courseId: r.courseId ?? "",
    productId: r.productId ?? "",
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
  kind: "COURSE" | "SHOP";
  batchId?: string;
  courseId?: string;
  productId?: string;
  discountType: "PERCENT" | "FIXED_COINS";
  discountValue: number;
  maxRedemptions?: number | null;
  perStudentLimit?: number;
  validFrom?: Date | null;
  validUntil?: Date | null;
  active?: boolean;
  notes?: string;
  createdBy: string;
}) {
  const code = normalizeCode(input.code);
  if (code.length < 3) throw new AppError("Coupon code must be at least 3 characters", 400);
  if (input.kind === "SHOP") {
    if (!input.productId?.trim()) throw new AppError("productId is required for shop coupons", 400);
  } else {
    if (!input.batchId?.trim() || !input.courseId?.trim()) throw new AppError("batchId and courseId are required for course coupons", 400);
  }
  const discountValue = Math.floor(Number(input.discountValue));
  if (!Number.isFinite(discountValue) || discountValue < 0) throw new AppError("Invalid discount value", 400);
  if (input.discountType === "PERCENT" && (discountValue < 1 || discountValue > 100)) {
    throw new AppError("Percent discount must be 1–100", 400);
  }

  try {
    const doc = await CouponModel.create({
      code,
      kind: input.kind,
      batchId: input.kind === "COURSE" ? input.batchId!.trim() : undefined,
      courseId: input.kind === "COURSE" ? input.courseId!.trim() : undefined,
      productId: input.kind === "SHOP" ? input.productId!.trim() : undefined,
      discountType: input.discountType,
      discountValue,
      maxRedemptions: input.maxRedemptions === undefined ? null : input.maxRedemptions,
      perStudentLimit: Math.max(1, Math.floor(Number(input.perStudentLimit ?? 1))),
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
