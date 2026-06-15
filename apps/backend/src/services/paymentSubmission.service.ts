import mongoose from "mongoose";
import { PaymentSubmissionModel } from "../models/PaymentSubmission.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { MilestoneProgressModel } from "../models/MilestoneProgress.model.js";
import { ENROLLMENT_STATUS } from "@funt-platform/constants";
import { createShopOrderAfterCheckout, getShopCheckoutSummary } from "./shop.service.js";
import { recordLicenseKeyConsumedForPayment } from "./licenseKey.service.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayPublicKeyId,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
} from "./razorpay.service.js";
import { assertEnrollmentCoupon, recordCouponRedemption } from "./coupon.service.js";
import { AppError } from "../utils/AppError.js";
import { PAYMENT_VERIFIED_BY_RAZORPAY_AUTO } from "../constants/payment.js";
import { normalizeAllowedPaymentMethods, type CoursePaymentMethodCode } from "../utils/coursePaymentMethods.js";
import { createAuditLog } from "./audit.service.js";
import { issueInvoiceForPayment } from "./invoice.service.js";
import { RazorpayOrderContextModel } from "../models/RazorpayOrderContext.model.js";
import { ShopProductModel } from "../models/ShopProduct.model.js";
import { unlockMilestoneByPayment, getMilestonesFromSnapshot } from "./learningPlan.service.js";

export type PaymentKind = "COURSE" | "SHOP";
const SHOP_STOCK_RESERVATION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type BatchDoc = Parameters<typeof getBatchCourseSnapshots>[0];

/** Resolve milestone title from the batch snapshot for payment record enrichment. */
async function resolveMilestoneTitle(batchIdParam: string, courseId: string, milestoneId: string): Promise<string | undefined> {
  try {
    const batch = await findBatchByParam(batchIdParam);
    if (!batch) return undefined;
    const snaps = getBatchCourseSnapshots(batch as BatchDoc);
    const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
    if (!snap) return undefined;
    const milestones = getMilestonesFromSnapshot(snap);
    const m = milestones.find((ms) => ms.milestoneId === milestoneId);
    return m?.title?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function releaseExpiredShopStockReservations(now = new Date()): Promise<number> {
  const ids = await PaymentSubmissionModel.find({
    kind: "SHOP",
    status: "PENDING",
    "shopCheckout.stockReserved": true,
    "shopCheckout.stockReservedUntil": { $lte: now },
  })
    .select("_id")
    .lean()
    .exec();
  let released = 0;
  for (const row of ids) {
    const doc = await PaymentSubmissionModel.findOneAndUpdate(
      {
        _id: String((row as { _id: unknown })._id),
        kind: "SHOP",
        status: "PENDING",
        "shopCheckout.stockReserved": true,
      },
      {
        $set: {
          status: "REJECTED",
          rejectReason: "Reservation expired: payment was not verified in time.",
          "shopCheckout.stockReserved": false,
        },
        $push: {
          statusHistory: {
            status: "REJECTED",
            note: "Auto-rejected after stock reservation timeout",
            actorId: "system",
            at: new Date(),
          },
        },
      },
      { new: false }
    )
      .select("shopCheckout.items")
      .lean()
      .exec();
    if (!doc) continue;
    const items = (((doc as { shopCheckout?: { items?: Array<{ productId: string; quantity: number }> } }).shopCheckout?.items) ?? []);
    for (const it of items) {
      const qty = Math.max(0, Math.floor(Number(it.quantity ?? 0)));
      if (!it.productId || qty <= 0) continue;
      await ShopProductModel.updateOne({ _id: it.productId, stock: { $ne: null } }, { $inc: { stock: qty } }).exec();
    }
    released += 1;
  }
  return released;
}

async function resolveBatchMongoId(batchIdParam: string): Promise<string> {
  const b = await findBatchByParam(batchIdParam.trim());
  if (!b) throw new AppError("Batch not found", 404);
  return String((b as { _id: unknown })._id);
}

function batchIdKeysForQueries(batchMongoId: string, batchDoc: { batchId?: string | null }): string[] {
  const human = batchDoc.batchId?.trim();
  const keys = [batchMongoId];
  if (human && !keys.includes(human)) keys.push(human);
  return keys;
}

export async function assertStudentCanPurchaseCourseEnrollment(studentId: string, batchIdParam: string, courseId: string) {
  const batch = await findBatchByParam(batchIdParam.trim());
  if (!batch) throw new AppError("Batch not found", 404);
  const mongoId = String((batch as { _id: unknown })._id);
  const keys = batchIdKeysForQueries(mongoId, batch as { batchId?: string | null });

  const enrolled = await EnrollmentModel.findOne({
    studentId,
    batchId: { $in: keys },
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  })
    .select("_id")
    .lean()
    .exec();
  if (enrolled) throw new AppError("You are already enrolled in this course for this batch.", 400);

  const paid = await PaymentSubmissionModel.findOne({
    studentId,
    batchId: { $in: keys },
    courseId: courseId.trim(),
    status: "VERIFIED",
    $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
  })
    .select("_id")
    .lean()
    .exec();
  if (paid) throw new AppError("You have already purchased this course for this batch.", 400);
}

export async function getEnrollmentCheckoutPricing(
  studentId: string,
  batchIdParam: string,
  courseId: string,
  couponCode?: string
) {
  await assertStudentCanPurchaseCourseEnrollment(studentId, batchIdParam, courseId);
  const batchMongoId = await resolveBatchMongoId(batchIdParam);
  const meta = await getCourseEnrollmentCheckoutMeta(batchIdParam, courseId);
  const listPaise = meta.enrollmentPriceInPaise;
  let finalPaise = listPaise;
  let discountPaise = 0;
  let couponApplied = false;
  let couponMessage: string | undefined;
  let couponId: string | null = null;

  if (couponCode?.trim() && listPaise >= 100) {
    try {
      const r = await assertEnrollmentCoupon(couponCode, batchMongoId, courseId.trim(), studentId, listPaise);
      finalPaise = r.finalPricePaise;
      discountPaise = Math.max(0, listPaise - finalPaise);
      couponApplied = !!r.couponId;
      couponId = r.couponId;
    } catch (e) {
      couponMessage = e instanceof AppError ? e.message : "Invalid coupon";
    }
  }

  return {
    ...meta,
    batchMongoId,
    listPaise,
    finalPaise,
    discountPaise,
    couponApplied,
    couponMessage,
    couponId,
  };
}

export async function getCourseEnrollmentCheckoutMeta(batchId: string, courseId: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as unknown as BatchDoc);
  const snap =
    snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ??
    (snaps.length === 1 ? snaps[0] : undefined);
  if (!snap) throw new AppError("Course not available in this batch", 404);
  const title = (snap as { title?: string }).title ?? "Course";
  const enrollmentPriceInPaise = Math.max(0, Math.floor(Number((snap as { enrollmentPriceInPaise?: number }).enrollmentPriceInPaise ?? 0)));
  const rawAllowed = (snap as { allowedPaymentMethods?: unknown }).allowedPaymentMethods;
  const allowedPaymentMethods: CoursePaymentMethodCode[] =
    enrollmentPriceInPaise >= 100 ? normalizeAllowedPaymentMethods(rawAllowed) : [];
  const allowUpiManual = enrollmentPriceInPaise >= 100 && allowedPaymentMethods.includes("UPI_MANUAL");
  const allowRazorpayMethod = enrollmentPriceInPaise >= 100 && allowedPaymentMethods.includes("RAZORPAY");
  const batchQr = String((batch as { manualUpiQrUrl?: string }).manualUpiQrUrl ?? "").trim();
  const envQr = process.env.PAYMENT_UPI_QR_URL?.trim() ?? "";
  const upiQrUrl = batchQr || envQr;
  return {
    courseTitle: title,
    enrollmentPriceInPaise,
    allowedPaymentMethods,
    allowUpiManual,
    allowRazorpayMethod,
    upiQrUrl,
  };
}

export async function createStudentRazorpayOrder(studentId: string, batchIdParam: string, courseId: string, couponCode?: string) {
  if (!isRazorpayConfigured()) throw new AppError("Online checkout is not configured", 503);
  await assertStudentCanPurchaseCourseEnrollment(studentId, batchIdParam, courseId);
  const batchMongoId = await resolveBatchMongoId(batchIdParam);
  const meta = await getCourseEnrollmentCheckoutMeta(batchIdParam, courseId);
  if (!meta.allowRazorpayMethod) {
    throw new AppError("Razorpay checkout is not enabled for this course in your batch.", 400);
  }
  if (meta.enrollmentPriceInPaise < 100) {
    throw new AppError("No Razorpay price is set for this course. Ask your administrator to set an enrollment price on the batch.", 400);
  }
  const listPaise = meta.enrollmentPriceInPaise;
  const priced = await assertEnrollmentCoupon(couponCode, batchMongoId, courseId.trim(), studentId, listPaise);
  const finalPaise = priced.finalPricePaise;
  if (finalPaise < 100) {
    throw new AppError(
      "Razorpay requires a payable amount of at least ₹1 after discount. Adjust the coupon or pay without Razorpay if manual UPI is enabled.",
      400
    );
  }
  const receipt = `e${studentId.slice(-8)}${Date.now().toString(36)}`.slice(0, 40);
  const { orderId, amount } = await createRazorpayOrder(finalPaise, receipt, {
    studentId,
    batchId: batchMongoId,
    courseId: courseId.trim(),
    coupon: couponCode?.trim() ? couponCode.trim().toUpperCase() : "",
  });
  await RazorpayOrderContextModel.findOneAndUpdate(
    { razorpayOrderId: orderId },
    {
      $set: {
        studentId,
        batchId: batchMongoId,
        courseId: courseId.trim(),
        expectedAmountPaise: finalPaise,
        expectedCouponCode: couponCode?.trim() ? couponCode.trim().toUpperCase() : undefined,
        expectedCouponId: priced.couponId ?? undefined,
        consumedAt: undefined,
      },
    },
    { upsert: true, new: true }
  ).exec();
  const keyId = getRazorpayPublicKeyId();
  if (!keyId) throw new AppError("Online checkout is not configured", 503);
  return {
    orderId,
    amount,
    currency: "INR" as const,
    keyId,
    courseTitle: meta.courseTitle,
    enrollmentPriceInPaise: listPaise,
    finalPricePaise: finalPaise,
    discountPaise: Math.max(0, listPaise - finalPaise),
    couponId: priced.couponId,
  };
}

export async function confirmRazorpayCoursePayment(input: {
  studentId: string;
  batchId: string;
  courseId: string;
  couponCode?: string;
  milestoneId?: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const batchParam = input.batchId.trim();
  const courseId = input.courseId.trim();
  const orderId = input.razorpay_order_id.trim();
  const paymentId = input.razorpay_payment_id.trim();
  const signature = input.razorpay_signature.trim();
  if (!orderId || !paymentId || !signature) throw new AppError("Missing Razorpay payment details", 400);
  if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
    throw new AppError("Could not verify payment signature", 400);
  }

  await assertStudentCanPurchaseCourseEnrollment(input.studentId, batchParam, courseId);
  const batchMongoId = await resolveBatchMongoId(batchParam);

  // ── Learning Plan milestone validation (same as UPI flow) ───────────────
  const milestoneIdTrimmed = input.milestoneId?.trim() || undefined;
  if (milestoneIdTrimmed) {
    const alreadyUnlocked = await MilestoneProgressModel.findOne({
      studentId: input.studentId,
      batchId: batchMongoId,
      courseId,
      milestoneId: milestoneIdTrimmed,
      unlocked: true,
    }).select("_id").lean().exec();
    if (alreadyUnlocked) {
      throw new AppError("This milestone is already unlocked. No payment needed.", 400);
    }
    const existingMilestonePayment = await PaymentSubmissionModel.findOne({
      studentId: input.studentId,
      batchId: batchMongoId,
      courseId,
      milestoneId: milestoneIdTrimmed,
      status: { $in: ["PENDING", "VERIFIED"] },
    }).select("_id").lean().exec();
    if (existingMilestonePayment) {
      throw new AppError("A payment for this milestone already exists.", 400);
    }
    const enrollment = await EnrollmentModel.findOne({
      studentId: input.studentId,
      batchId: batchMongoId,
    }).select("nextEligibleMilestoneId").lean().exec();
    const nextEligible = (enrollment as { nextEligibleMilestoneId?: string } | null)?.nextEligibleMilestoneId;
    if (nextEligible && nextEligible !== milestoneIdTrimmed) {
      throw new AppError("You can only pay for the next eligible milestone in sequence.", 400);
    }
  }

  const meta = await getCourseEnrollmentCheckoutMeta(batchParam, courseId);
  if (!meta.allowRazorpayMethod) {
    throw new AppError("Razorpay is not enabled for this course in your batch.", 400);
  }

  const listPaise = meta.enrollmentPriceInPaise;
  const priced = await assertEnrollmentCoupon(input.couponCode, batchMongoId, courseId, input.studentId, listPaise);
  const finalPaise = priced.finalPricePaise;
  const orderContext = await RazorpayOrderContextModel.findOne({ razorpayOrderId: orderId }).lean().exec();
  if (!orderContext) {
    throw new AppError("Checkout session not found. Please retry checkout.", 400);
  }
  if (orderContext.studentId !== input.studentId || orderContext.batchId !== batchMongoId || orderContext.courseId !== courseId) {
    throw new AppError("Checkout session does not match this learner/course context.", 403);
  }
  if ((orderContext.consumedAt as Date | undefined) != null) {
    throw new AppError("This checkout session was already used.", 400);
  }
  const incomingCouponCode = input.couponCode?.trim() ? input.couponCode.trim().toUpperCase() : undefined;
  const expectedCouponCode = String((orderContext.expectedCouponCode as string | undefined) ?? "").trim() || undefined;
  if ((expectedCouponCode ?? "") !== (incomingCouponCode ?? "")) {
    throw new AppError("Coupon context mismatch for this checkout session.", 400);
  }

  const order = await fetchRazorpayOrder(orderId);
  if (order.amount !== finalPaise) {
    throw new AppError("Paid amount does not match the order total. Start checkout again with the same coupon (if any).", 400);
  }
  if (Number(orderContext.expectedAmountPaise) !== finalPaise) {
    throw new AppError("Checkout session amount mismatch.", 400);
  }
  const payment = await fetchRazorpayPayment(paymentId);
  if (payment.order_id !== orderId || payment.amount !== finalPaise) {
    throw new AppError("Gateway payment details do not match this order.", 400);
  }
  if (payment.status && payment.status !== "captured" && payment.status !== "authorized") {
    throw new AppError("Payment is not in a confirmed state", 400);
  }

  const dup = await PaymentSubmissionModel.findOne({ transactionId: paymentId }).lean().exec();
  if (dup) throw new AppError("This payment was already recorded", 400);

  const existingPending = await PaymentSubmissionModel.findOne({
    studentId: input.studentId,
    batchId: batchMongoId,
    courseId,
    status: "PENDING",
    $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
  }).exec();
  if (existingPending) {
    throw new AppError("You already have a payment pending approval for this course", 400);
  }

  const codeUpper = input.couponCode?.trim() ? input.couponCode.trim().toUpperCase() : undefined;

  try {
    const resolvedMilestoneTitle = input.milestoneId?.trim()
      ? await resolveMilestoneTitle(input.batchId, courseId, input.milestoneId.trim())
      : undefined;
    const doc = await PaymentSubmissionModel.create({
      kind: "COURSE",
      studentId: input.studentId,
      batchId: batchMongoId,
      courseId,
      transactionId: paymentId,
      paidAt: new Date(),
      status: "PENDING",
      paymentMethod: "RAZORPAY",
      amountPaise: finalPaise,
      razorpayOrderId: orderId,
      razorpayVerified: true,
      enrollmentListPaise: listPaise,
      enrollmentDiscountPaise: Math.max(0, listPaise - finalPaise),
      couponId: priced.couponId ?? undefined,
      couponCode: codeUpper,
      milestoneId: input.milestoneId?.trim() || undefined,
      milestoneTitle: resolvedMilestoneTitle,
    });
    const verified = await verifyPaymentAndEnroll(String(doc._id), PAYMENT_VERIFIED_BY_RAZORPAY_AUTO);
    const assignedLicenseKey = verified.kind === "COURSE" ? verified.assignedLicenseKey : undefined;
    await RazorpayOrderContextModel.updateOne(
      { razorpayOrderId: orderId, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } }
    ).exec();
    return {
      id: String(doc._id),
      message: assignedLicenseKey
        ? `Payment successful. You are enrolled. Your license key: ${assignedLicenseKey}`
        : "Payment successful. You are enrolled.",
      assignedLicenseKey,
    };
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11000) throw new AppError("This payment was already recorded", 400);
    throw err;
  }
}

export async function submitStudentPayment(input: {
  studentId: string;
  kind: PaymentKind;
  batchId?: string;
  courseId?: string;
  productId?: string;
  transactionId: string;
  paidAt: Date;
  amountPaise?: number;
  payerName?: string;
  couponCode?: string;
  milestoneId?: string;
  submitterIp?: string;
  deviceId?: string;
  idempotencyKey?: string;
  shopCheckout?: {
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPriceCoins: number;
      lineTotalCoins: number;
    }>;
    couponCode?: string;
    couponDiscountCoins?: number;
    totalCoinsAfterDiscount?: number;
    coinsToRedeem?: number;
    payablePaise?: number;
    address?: {
      fullName: string;
      phone: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
    };
  };
}) {
  await releaseExpiredShopStockReservations().catch(() => {});
  const tid = input.transactionId.trim();
  if (!tid) throw new AppError("Transaction ID is required", 400);

  const dup = await PaymentSubmissionModel.findOne({ transactionId: tid }).lean().exec();
  if (dup) {
    throw new AppError("Wrong transaction id entered", 400);
  }

  const kind: PaymentKind = input.kind === "SHOP" ? "SHOP" : "COURSE";
  const idemKey = input.idempotencyKey?.trim() || undefined;
  if (idemKey) {
    const existingByIdem = await PaymentSubmissionModel.findOne({ idempotencyKey: idemKey })
      .select("_id studentId kind")
      .lean()
      .exec();
    if (existingByIdem) {
      const row = existingByIdem as { _id: unknown; studentId: string; kind?: string };
      if (row.studentId !== input.studentId || (row.kind === "SHOP" ? "SHOP" : "COURSE") !== kind) {
        throw new AppError("Invalid idempotency key for this payment context", 400);
      }
      return { id: String(row._id), message: "Payment details already submitted for this attempt." };
    }
  }

  if (kind === "COURSE") {
    const batchParam = input.batchId?.trim();
    const courseId = input.courseId?.trim();
    if (!batchParam || !courseId) throw new AppError("batchId and courseId are required for course payment", 400);

    const payerName = input.payerName?.trim();
    if (!payerName) throw new AppError("Payer name (as on UPI / bank) is required", 400);
    const declared = input.amountPaise != null ? Math.floor(Number(input.amountPaise)) : NaN;
    if (!Number.isFinite(declared) || declared < 0) throw new AppError("Amount paid is required", 400);

    await assertStudentCanPurchaseCourseEnrollment(input.studentId, batchParam, courseId);
    const batchMongoId = await resolveBatchMongoId(batchParam);

    // ── Learning Plan milestone validation ────────────────────────────────
    const milestoneIdTrimmed = input.milestoneId?.trim() || undefined;
    if (milestoneIdTrimmed) {
      // Check 1: Milestone already unlocked — no payment needed
      const alreadyUnlocked = await MilestoneProgressModel.findOne({
        studentId: input.studentId,
        batchId: batchMongoId,
        courseId,
        milestoneId: milestoneIdTrimmed,
        unlocked: true,
      }).select("_id").lean().exec();
      if (alreadyUnlocked) {
        throw new AppError("This milestone is already unlocked. No payment needed.", 400);
      }

      // Check 2: Duplicate pending/verified payment for this milestone
      const existingMilestonePayment = await PaymentSubmissionModel.findOne({
        studentId: input.studentId,
        batchId: batchMongoId,
        courseId,
        milestoneId: milestoneIdTrimmed,
        status: { $in: ["PENDING", "VERIFIED"] },
      }).select("_id status").lean().exec();
      if (existingMilestonePayment) {
        const st = (existingMilestonePayment as { status: string }).status;
        throw new AppError(
          st === "VERIFIED"
            ? "This milestone already has a verified payment."
            : "You already have a pending payment for this milestone.",
          400
        );
      }

      // Check 3: Validate milestone is the next eligible one
      const enrollment = await EnrollmentModel.findOne({
        studentId: input.studentId,
        batchId: batchMongoId,
      }).select("nextEligibleMilestoneId").lean().exec();
      const nextEligible = (enrollment as { nextEligibleMilestoneId?: string } | null)?.nextEligibleMilestoneId;
      if (nextEligible && nextEligible !== milestoneIdTrimmed) {
        throw new AppError(
          "You can only pay for the next eligible milestone in sequence. Please complete the current milestone first.",
          400
        );
      }
    }

    const meta = await getCourseEnrollmentCheckoutMeta(batchParam, courseId);
    if (!meta.allowUpiManual) {
      throw new AppError("Manual UPI payment is not enabled for this course in your batch.", 400);
    }
    const listPaise = meta.enrollmentPriceInPaise;
    const priced = await assertEnrollmentCoupon(input.couponCode, batchMongoId, courseId, input.studentId, listPaise);
    const expectedFinal = priced.finalPricePaise;
    if (listPaise > 0) {
      if (Math.abs(declared - expectedFinal) > 100) {
        throw new AppError("Amount does not match the total after coupon (or list price). Use the exact amount shown on the payment page.", 400);
      }
    }
    const amountPaise = declared;
    const codeUpper = input.couponCode?.trim() ? input.couponCode.trim().toUpperCase() : undefined;
    const submitterIp = input.submitterIp?.trim() || undefined;
    const deviceId = input.deviceId?.trim() || undefined;
    const riskFlags: string[] = [];

    const windowSince = new Date(Date.now() - 10 * 60 * 1000);
    const velocityQuery: Record<string, unknown> = {
      createdAt: { $gte: windowSince },
      status: { $in: ["PENDING", "REJECTED"] },
      $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
    };
    const velocityChecks: Promise<number>[] = [
      PaymentSubmissionModel.countDocuments({ ...velocityQuery, studentId: input.studentId }).exec(),
    ];
    if (submitterIp) velocityChecks.push(PaymentSubmissionModel.countDocuments({ ...velocityQuery, submitterIp }).exec());
    if (deviceId) velocityChecks.push(PaymentSubmissionModel.countDocuments({ ...velocityQuery, deviceId }).exec());
    const [studentRecent, ipRecent = 0, deviceRecent = 0] = await Promise.all(velocityChecks);
    if (studentRecent >= 3) riskFlags.push("VELOCITY_STUDENT");
    if (ipRecent >= 5) riskFlags.push("VELOCITY_IP");
    if (deviceRecent >= 5) riskFlags.push("VELOCITY_DEVICE");

    if (submitterIp) {
      const blockedIps = (process.env.PAYMENT_RISK_IP_BLOCKLIST ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (blockedIps.includes(submitterIp)) riskFlags.push("RISKY_IP_BLOCKLIST");
    }
    if (deviceId) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentDevices = await PaymentSubmissionModel.distinct("deviceId", {
        studentId: input.studentId,
        createdAt: { $gte: since },
        deviceId: { $exists: true, $ne: null },
      }).exec();
      if (!recentDevices.includes(deviceId) && recentDevices.length >= 2) {
        riskFlags.push("DEVICE_MISMATCH");
      }
    }
    const escalatedAt = riskFlags.length ? new Date() : undefined;

    const existingPending = await PaymentSubmissionModel.findOne({
      studentId: input.studentId,
      batchId: batchMongoId,
      courseId,
      status: "PENDING",
      $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
    }).exec();
    if (existingPending) {
      throw new AppError("You already have a payment pending approval for this course", 400);
    }

    try {
      const resolvedMilestoneTitle = input.milestoneId?.trim()
        ? await resolveMilestoneTitle(batchParam!, courseId!, input.milestoneId.trim())
        : undefined;
      const doc = await PaymentSubmissionModel.create({
        kind: "COURSE",
        studentId: input.studentId,
        batchId: batchMongoId,
        courseId,
        transactionId: tid,
        paidAt: input.paidAt,
        status: "PENDING",
        paymentMethod: "UPI_MANUAL",
        amountPaise,
        payerName,
        enrollmentListPaise: listPaise > 0 ? listPaise : undefined,
        enrollmentDiscountPaise: listPaise > 0 ? Math.max(0, listPaise - amountPaise) : undefined,
        couponId: priced.couponId ?? undefined,
        couponCode: codeUpper,
        milestoneId: input.milestoneId?.trim() || undefined,
        milestoneTitle: resolvedMilestoneTitle,
        idempotencyKey: idemKey,
        submitterIp,
        deviceId,
        riskFlags,
        riskEscalatedAt: escalatedAt,
        statusHistory: [{ status: "PENDING", note: "Student submitted payment proof", actorId: input.studentId, at: new Date() }],
      });
      return {
        id: String(doc._id),
        message: "Payment is being verified. Your license key will be assigned soon.",
      };
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11000) {
        const msg = String((err as { message?: string }).message ?? "");
        if (msg.includes("idempotencyKey")) {
          throw new AppError("Payment details already submitted for this checkout attempt.", 400);
        }
        throw new AppError("Wrong transaction id entered", 400);
      }
      throw err;
    }
  }

  if (!input.shopCheckout) throw new AppError("shop checkout details are required", 400);
  const summary = await getShopCheckoutSummary({
    studentId: input.studentId,
    items: input.shopCheckout.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
    couponCode: input.shopCheckout.couponCode,
    coinsToRedeem: input.shopCheckout.coinsToRedeem,
  });
  const addr = input.shopCheckout.address;
  if (!addr?.fullName?.trim() || !addr.phone?.trim() || !addr.line1?.trim() || !addr.city?.trim() || !addr.state?.trim() || !addr.postalCode?.trim()) {
    throw new AppError("Complete delivery address is required", 400);
  }
  if (summary.payablePaise <= 0) throw new AppError("No payable amount for manual payment", 400);
  const declared = input.amountPaise != null ? Math.floor(Number(input.amountPaise)) : NaN;
  if (!Number.isFinite(declared) || declared < 0) throw new AppError("Amount paid is required", 400);
  if (Math.abs(declared - summary.payablePaise) > 100) {
    throw new AppError("Amount does not match checkout total", 400);
  }
  const payerName = input.payerName?.trim();
  if (!payerName) throw new AppError("Payer name (as on UPI / bank) is required", 400);

  const existingShopPending = await PaymentSubmissionModel.findOne({
    studentId: input.studentId,
    kind: "SHOP",
    status: "PENDING",
  }).exec();
  if (existingShopPending) throw new AppError("You already have a pending shop checkout", 400);

  const reserved: Array<{ productId: string; quantity: number }> = [];
  try {
    for (const it of summary.items) {
      const p = await ShopProductModel.findById(it.productId).exec();
      if (!p || !p.active) throw new AppError(`Product unavailable: ${it.productName}`, 400);
      if (p.stock != null) {
        const ok = await ShopProductModel.findOneAndUpdate(
          { _id: p._id, stock: { $gte: it.quantity } },
          { $inc: { stock: -it.quantity } },
          { new: true }
        )
          .select("_id")
          .lean()
          .exec();
        if (!ok) throw new AppError(`Insufficient stock for ${p.name}`, 400);
        reserved.push({ productId: String(p._id), quantity: it.quantity });
      }
    }
    const doc = await PaymentSubmissionModel.create({
      kind: "SHOP",
      studentId: input.studentId,
      productId: summary.items[0]?.productId,
      transactionId: tid,
      paidAt: input.paidAt,
      status: "PENDING",
      paymentMethod: "UPI_MANUAL",
      amountPaise: declared,
      payerName,
      idempotencyKey: idemKey,
      submitterIp: input.submitterIp?.trim() || undefined,
      deviceId: input.deviceId?.trim() || undefined,
      shopCheckout: {
        items: summary.items,
        couponCode: summary.couponCodeApplied,
        couponDiscountCoins: summary.couponDiscountCoins,
        totalCoinsAfterDiscount: summary.totalCoinsAfterDiscount,
        coinsToRedeem: summary.coinsToRedeem,
        payablePaise: summary.payablePaise,
        stockReserved: reserved.length > 0,
        stockReservedUntil: reserved.length > 0 ? new Date(Date.now() + SHOP_STOCK_RESERVATION_TTL_MS) : undefined,
        address: {
          fullName: addr.fullName.trim(),
          phone: addr.phone.trim(),
          line1: addr.line1.trim(),
          line2: addr.line2?.trim() ?? "",
          city: addr.city.trim(),
          state: addr.state.trim(),
          postalCode: addr.postalCode.trim(),
        },
      },
      statusHistory: [{ status: "PENDING", note: "Student submitted shop payment proof", actorId: input.studentId, at: new Date() }],
    });
    return {
      id: String(doc._id),
      message: "Payment is being verified. Your order will be confirmed after admin approval.",
    };
  } catch (err: unknown) {
    if (reserved.length) {
      for (const it of reserved) {
        await ShopProductModel.updateOne({ _id: it.productId, stock: { $ne: null } }, { $inc: { stock: it.quantity } }).exec();
      }
    }
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      const msg = String((err as { message?: string }).message ?? "");
      if (msg.includes("idempotencyKey")) {
        throw new AppError("Payment details already submitted for this checkout attempt.", 400);
      }
      throw new AppError("Wrong transaction id entered", 400);
    }
    throw err;
  }
}

export async function verifyPaymentAndEnroll(
  paymentId: string,
  adminId: string
): Promise<
  | { message: string; enrollmentCreated: boolean; kind: "COURSE"; assignedLicenseKey?: string }
  | { message: string; enrollmentCreated: false; kind: "SHOP" }
> {
  const session = await mongoose.startSession();
  try {
    let result:
      | { message: string; enrollmentCreated: boolean; kind: "COURSE"; assignedLicenseKey?: string }
      | { message: string; enrollmentCreated: false; kind: "SHOP" }
      | null = null;
    await session.withTransaction(async () => {
      const doc = await PaymentSubmissionModel.findById(paymentId).session(session).exec();
      if (!doc) throw new AppError("Payment record not found", 404);
      if (doc.status === "REJECTED") throw new AppError("This payment was already rejected", 400);
      const kind = doc.kind === "SHOP" ? "SHOP" : "COURSE";
      if (doc.status === "VERIFIED") {
        result =
          kind === "COURSE"
            ? {
                message: "Payment was already verified earlier.",
                enrollmentCreated: false,
                kind: "COURSE",
              }
            : { message: "Shop payment was already verified earlier.", enrollmentCreated: false, kind: "SHOP" };
        return;
      }

      if (kind === "COURSE") {
        const beforeSnapshot = { status: doc.status, rejectReason: (doc as { rejectReason?: string }).rejectReason ?? null };
        const batchId = doc.batchId?.trim();
        const courseId = doc.courseId?.trim();
        if (!batchId || !courseId) throw new AppError("Invalid course payment record", 400);
        const now = new Date();
        const activeEnrollment = await EnrollmentModel.findOne({
          studentId: doc.studentId,
          batchId,
          status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
        })
          .session(session)
          .select("_id")
          .lean()
          .exec();
        const enrollmentCreated = !activeEnrollment;
        let enrollmentId = activeEnrollment ? String(activeEnrollment._id) : undefined;
        if (enrollmentCreated) {
          const [createdEnrollment] = await EnrollmentModel.create(
            [{ studentId: doc.studentId, batchId, status: ENROLLMENT_STATUS.ACTIVE }],
            { session }
          );
          enrollmentId = String(createdEnrollment._id);
        }
        const history = (
          ((doc as { statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }> }).statusHistory ?? []) as Array<{
            status: string;
            note?: string;
            actorId?: string;
            at: Date;
          }>
        ).concat([{ status: "VERIFIED", note: "Admin verified and enrolled student", actorId: adminId, at: now }]);
        await PaymentSubmissionModel.updateOne(
          { _id: doc._id, status: "PENDING" },
          {
            $set: {
              status: "VERIFIED",
              verifiedBy: adminId,
              verifiedAt: now,
              rejectReason: undefined,
              statusHistory: history,
            },
          },
          { session }
        ).exec();
        await createAuditLog(
          "PAYMENT_VERIFIED",
          adminId,
          "PaymentSubmission",
          String(doc._id),
          {
            before: beforeSnapshot,
            after: { status: "VERIFIED", rejectReason: null },
            paymentMethod: doc.paymentMethod ?? "UPI_MANUAL",
            riskFlags: (doc as { riskFlags?: string[] }).riskFlags ?? [],
          },
          session
        );
        const { key } = await recordLicenseKeyConsumedForPayment({
          studentId: doc.studentId,
          courseId,
          batchMongoId: batchId,
          createdBy: adminId,
          session,
        });
        // ── Learning Plan: unlock milestone if this payment was for a specific milestone ──
        const paymentMilestoneId = (doc as { milestoneId?: string }).milestoneId?.trim();
        if (paymentMilestoneId && courseId) {
          try {
            await unlockMilestoneByPayment(
              doc.studentId, batchId, courseId,
              paymentMilestoneId, String(doc._id), adminId
            );
          } catch (unlockErr) {
            // Log critical failure — payment verified but milestone not unlocked
            console.error(
              `[CRITICAL] Payment ${String(doc._id)} verified but milestone ${paymentMilestoneId} unlock failed:`,
              unlockErr instanceof Error ? unlockErr.message : unlockErr
            );
            // Re-throw to roll back the transaction — payment should NOT be verified if unlock fails
            throw new AppError(
              "Payment recorded but milestone unlock failed. Contact support with your transaction ID.",
              500
            );
          }
        }
        const couponIdForRedeem = (doc as { couponId?: string }).couponId?.trim();
        if (couponIdForRedeem) {
          await recordCouponRedemption(couponIdForRedeem, doc.studentId, `enrollment_payment:${String(doc._id)}`, session);
        }
        const listPaise = Math.max(
          0,
          Math.floor(
            Number(
              (doc as { enrollmentListPaise?: number }).enrollmentListPaise ??
                (doc as { amountPaise?: number }).amountPaise ??
                0
            )
          )
        );
        const discountPaise = Math.max(
          0,
          Math.floor(Number((doc as { enrollmentDiscountPaise?: number }).enrollmentDiscountPaise ?? 0))
        );
        const paidPaise = Math.max(
          0,
          Math.floor(Number((doc as { amountPaise?: number }).amountPaise ?? listPaise - discountPaise))
        );
        await issueInvoiceForPayment({
          paymentSubmissionId: String(doc._id),
          studentId: doc.studentId,
          batchId,
          courseId,
          enrollmentId,
          amountInPaise: listPaise > 0 ? listPaise : paidPaise,
          discountInPaise: discountPaise,
          createdBy: adminId,
          session,
        });
        result = {
          message: enrollmentCreated
            ? "Access enabled and license key recorded. Student can start the course (or use the key if needed)."
            : "Payment verified. Student was already enrolled; license key recorded for records.",
          enrollmentCreated,
          kind: "COURSE",
          assignedLicenseKey: key,
        };
        return;
      }

      const checkout = (doc as { shopCheckout?: {
        items?: Array<{ productId: string; productName: string; quantity: number; unitPriceCoins: number; lineTotalCoins: number }>;
        couponCode?: string;
        couponDiscountCoins?: number;
        totalCoinsAfterDiscount?: number;
        coinsToRedeem?: number;
        payablePaise?: number;
        stockReserved?: boolean;
        address?: { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; postalCode: string };
      } }).shopCheckout;
      if (!checkout?.items?.length || !checkout.address) throw new AppError("Invalid shop payment record", 400);
      const beforeSnapshot = { status: doc.status, rejectReason: (doc as { rejectReason?: string }).rejectReason ?? null };

      await createShopOrderAfterCheckout({
        studentId: doc.studentId,
        checkout: {
          items: checkout.items,
          subtotalCoins: checkout.items.reduce((acc, it) => acc + Math.max(0, Math.floor(Number(it.lineTotalCoins ?? 0))), 0),
          couponDiscountCoins: Math.max(0, Math.floor(Number(checkout.couponDiscountCoins ?? 0))),
          couponCodeApplied: checkout.couponCode?.trim() || undefined,
          totalCoinsAfterDiscount: Math.max(0, Math.floor(Number(checkout.totalCoinsAfterDiscount ?? 0))),
          coinsToRedeem: Math.max(0, Math.floor(Number(checkout.coinsToRedeem ?? 0))),
          payableCoins: Math.max(0, Math.ceil(Math.max(0, Math.floor(Number(checkout.payablePaise ?? 0))) / 25)),
          payablePaise: Math.max(0, Math.floor(Number(checkout.payablePaise ?? 0))),
          payableRupees: Number((Math.max(0, Math.floor(Number(checkout.payablePaise ?? 0))) / 100).toFixed(2)),
        },
        address: checkout.address,
        actorId: adminId,
        paymentSubmissionId: String(doc._id),
        skipStockDeduction: checkout.stockReserved === true,
      });

      doc.status = "VERIFIED";
      doc.verifiedBy = adminId;
      doc.verifiedAt = new Date();
      (doc as { rejectReason?: string }).rejectReason = undefined;
      (
        doc as {
          statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }>;
        }
      ).statusHistory = [
        ...(((doc as { statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }> }).statusHistory ?? []) as Array<{
          status: string;
          note?: string;
          actorId?: string;
          at: Date;
        }>),
        { status: "VERIFIED", note: "Admin verified shop payment", actorId: adminId, at: new Date() },
      ];
      await doc.save({ session });
      await createAuditLog(
        "PAYMENT_VERIFIED",
        adminId,
        "PaymentSubmission",
        String(doc._id),
        {
          before: beforeSnapshot,
          after: { status: "VERIFIED", rejectReason: null },
          paymentMethod: doc.paymentMethod ?? "UPI_MANUAL",
          riskFlags: (doc as { riskFlags?: string[] }).riskFlags ?? [],
        },
        session
      );

      result = {
        message: "Shop order fulfilled for the student.",
        enrollmentCreated: false,
        kind: "SHOP" as const,
      };
    });
    if (!result) throw new AppError("Could not verify payment", 500);
    return result as
      | { message: string; enrollmentCreated: boolean; kind: "COURSE"; assignedLicenseKey?: string }
      | { message: string; enrollmentCreated: false; kind: "SHOP" };
  } finally {
    await session.endSession();
  }
}

export async function listPendingPayments() {
  await releaseExpiredShopStockReservations().catch(() => {});
  return PaymentSubmissionModel.find({ status: "PENDING" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
}

export async function hasPendingCoursePayment(studentId: string, batchIdParam: string, courseId: string): Promise<boolean> {
  const batch = await findBatchByParam(batchIdParam.trim());
  if (!batch) return false;
  const mongoId = String((batch as { _id: unknown })._id);
  const keys = batchIdKeysForQueries(mongoId, batch as { batchId?: string | null });
  const one = await PaymentSubmissionModel.findOne({
    studentId,
    batchId: { $in: keys },
    courseId: courseId.trim(),
    status: "PENDING",
    $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
  })
    .select("_id")
    .lean()
    .exec();
  return !!one;
}

export async function hasPendingShopPayment(studentId: string, productId: string): Promise<boolean> {
  await releaseExpiredShopStockReservations().catch(() => {});
  const one = await PaymentSubmissionModel.findOne({
    studentId,
    productId,
    kind: "SHOP",
    status: "PENDING",
  })
    .select("_id")
    .lean()
    .exec();
  return !!one;
}

export async function getLatestCoursePaymentState(
  studentId: string,
  batchIdParam: string,
  courseId: string
): Promise<{ status: "PENDING" | "REJECTED" | "VERIFIED"; rejectReason?: string } | null> {
  const batch = await findBatchByParam(batchIdParam.trim());
  if (!batch) return null;
  const mongoId = String((batch as { _id: unknown })._id);
  const keys = batchIdKeysForQueries(mongoId, batch as { batchId?: string | null });
  const doc = await PaymentSubmissionModel.findOne({
    studentId,
    batchId: { $in: keys },
    courseId: courseId.trim(),
    $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .select("status rejectReason")
    .lean()
    .exec();
  if (!doc) return null;
  const s = doc.status as string;
  if (s !== "PENDING" && s !== "REJECTED" && s !== "VERIFIED") return null;
  return {
    status: s as "PENDING" | "REJECTED" | "VERIFIED",
    rejectReason: (doc as { rejectReason?: string }).rejectReason,
  };
}

export async function getLatestShopPaymentState(
  studentId: string,
  productId: string
): Promise<{ status: "PENDING" | "REJECTED" | "VERIFIED"; rejectReason?: string } | null> {
  await releaseExpiredShopStockReservations().catch(() => {});
  const doc = await PaymentSubmissionModel.findOne({
    studentId,
    productId,
    kind: "SHOP",
  })
    .sort({ createdAt: -1 })
    .select("status rejectReason")
    .lean()
    .exec();
  if (!doc) return null;
  const s = doc.status as string;
  if (s !== "PENDING" && s !== "REJECTED" && s !== "VERIFIED") return null;
  return {
    status: s as "PENDING" | "REJECTED" | "VERIFIED",
    rejectReason: (doc as { rejectReason?: string }).rejectReason,
  };
}

export async function rejectPaymentSubmission(paymentId: string, adminId: string, reason?: string) {
  const doc = await PaymentSubmissionModel.findById(paymentId).exec();
  if (!doc) throw new AppError("Payment record not found", 404);
  if (doc.status !== "PENDING") throw new AppError("Only pending payments can be rejected", 400);
  doc.status = "REJECTED";
  doc.verifiedBy = adminId;
  doc.verifiedAt = new Date();
  const r = reason?.trim();
  if (r) (doc as { rejectReason?: string }).rejectReason = r.slice(0, 500);
  if (doc.kind === "SHOP") {
    const checkout = (doc as { shopCheckout?: { stockReserved?: boolean; items?: Array<{ productId: string; quantity: number }> } }).shopCheckout;
    if (checkout?.stockReserved && Array.isArray(checkout.items)) {
      for (const it of checkout.items) {
        const qty = Math.max(0, Math.floor(Number(it.quantity ?? 0)));
        if (!it.productId || qty <= 0) continue;
        await ShopProductModel.updateOne({ _id: it.productId, stock: { $ne: null } }, { $inc: { stock: qty } }).exec();
      }
      await PaymentSubmissionModel.updateOne({ _id: doc._id }, { $set: { "shopCheckout.stockReserved": false } }).exec();
    }
  }
  (
    doc as {
      statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }>;
    }
  ).statusHistory = [
    ...(((doc as { statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: Date }> }).statusHistory ?? []) as Array<{
      status: string;
      note?: string;
      actorId?: string;
      at: Date;
    }>),
    { status: "REJECTED", note: r ? `Rejected: ${r.slice(0, 180)}` : "Rejected by admin", actorId: adminId, at: new Date() },
  ];
  await doc.save();
  await createAuditLog("PAYMENT_REJECTED", adminId, "PaymentSubmission", String(doc._id), {
    before: { status: "PENDING", rejectReason: null },
    after: { status: "REJECTED", rejectReason: r ?? null },
    paymentMethod: doc.paymentMethod ?? "UPI_MANUAL",
    riskFlags: (doc as { riskFlags?: string[] }).riskFlags ?? [],
  });
  return { ok: true };
}

export async function getStudentPaymentTimeline(input: {
  studentId: string;
  kind: PaymentKind;
  batchId?: string;
  courseId?: string;
  productId?: string;
}) {
  await releaseExpiredShopStockReservations().catch(() => {});
  if (input.kind === "COURSE") {
    const batchIdParam = input.batchId?.trim();
    const courseId = input.courseId?.trim();
    if (!batchIdParam || !courseId) return null;
    const batch = await findBatchByParam(batchIdParam);
    if (!batch) return null;
    const mongoId = String((batch as { _id: unknown })._id);
    const keys = batchIdKeysForQueries(mongoId, batch as { batchId?: string | null });
    const doc = await PaymentSubmissionModel.findOne({
      studentId: input.studentId,
      batchId: { $in: keys },
      courseId,
      $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .select("status rejectReason createdAt updatedAt statusHistory riskFlags")
      .lean()
      .exec();
    return doc;
  }
  const productId = input.productId?.trim();
  if (!productId) return null;
  const doc = await PaymentSubmissionModel.findOne({
    studentId: input.studentId,
    productId,
    kind: "SHOP",
  })
    .sort({ createdAt: -1 })
    .select("status rejectReason createdAt updatedAt statusHistory riskFlags")
    .lean()
    .exec();
  return doc;
}
