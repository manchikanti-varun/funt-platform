import { PaymentSubmissionModel } from "../models/PaymentSubmission.model.js";
import { createEnrollment } from "./enrollment.service.js";
import { fulfillShopOrderAfterExternalPayment } from "./shop.service.js";
import { recordLicenseKeyConsumedForPayment } from "./licenseKey.service.js";
import { AppError } from "../utils/AppError.js";

export type PaymentKind = "COURSE" | "SHOP";

export async function submitStudentPayment(input: {
  studentId: string;
  kind: PaymentKind;
  batchId?: string;
  courseId?: string;
  productId?: string;
  transactionId: string;
  paidAt: Date;
}) {
  const tid = input.transactionId.trim();
  if (!tid) throw new AppError("Transaction ID is required", 400);

  const dup = await PaymentSubmissionModel.findOne({ transactionId: tid }).lean().exec();
  if (dup) {
    throw new AppError("Wrong transaction id entered", 400);
  }

  const kind: PaymentKind = input.kind === "SHOP" ? "SHOP" : "COURSE";

  if (kind === "COURSE") {
    const batchId = input.batchId?.trim();
    const courseId = input.courseId?.trim();
    if (!batchId || !courseId) throw new AppError("batchId and courseId are required for course payment", 400);

    const existingPending = await PaymentSubmissionModel.findOne({
      studentId: input.studentId,
      batchId,
      courseId,
      status: "PENDING",
      $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
    }).exec();
    if (existingPending) {
      throw new AppError("You already have a payment pending approval for this course", 400);
    }

    try {
      const doc = await PaymentSubmissionModel.create({
        kind: "COURSE",
        studentId: input.studentId,
        batchId,
        courseId,
        transactionId: tid,
        paidAt: input.paidAt,
        status: "PENDING",
      });
      return {
        id: String(doc._id),
        message: "Payment is being verified. Your license key will be assigned soon.",
      };
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11000) {
        throw new AppError("Wrong transaction id entered", 400);
      }
      throw err;
    }
  }

  const productId = input.productId?.trim();
  if (!productId) throw new AppError("productId is required for shop payment", 400);

  const existingShopPending = await PaymentSubmissionModel.findOne({
    studentId: input.studentId,
    productId,
    kind: "SHOP",
    status: "PENDING",
  }).exec();
  if (existingShopPending) {
    throw new AppError("You already have a payment pending approval for this product", 400);
  }

  try {
    const doc = await PaymentSubmissionModel.create({
      kind: "SHOP",
      studentId: input.studentId,
      productId,
      transactionId: tid,
      paidAt: input.paidAt,
      status: "PENDING",
    });
    return {
      id: String(doc._id),
      message: "Payment is being verified. Your order will be confirmed after admin approval.",
    };
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      throw new AppError("Wrong transaction id entered", 400);
    }
    throw err;
  }
}

export async function verifyPaymentAndEnroll(paymentId: string, adminId: string) {
  const doc = await PaymentSubmissionModel.findById(paymentId).exec();
  if (!doc) throw new AppError("Payment record not found", 404);
  if (doc.status === "VERIFIED") throw new AppError("Already verified", 400);
  if (doc.status === "REJECTED") throw new AppError("This payment was already rejected", 400);

  const kind = doc.kind === "SHOP" ? "SHOP" : "COURSE";

  if (kind === "COURSE") {
    const batchId = doc.batchId?.trim();
    const courseId = doc.courseId?.trim();
    if (!batchId || !courseId) throw new AppError("Invalid course payment record", 400);

    let enrollmentCreated = true;
    try {
      await createEnrollment({
        studentId: doc.studentId,
        batchId,
        createdBy: adminId,
      });
    } catch (e) {
      if (e instanceof AppError && e.message.includes("already enrolled")) {
        enrollmentCreated = false;
      } else {
        throw e;
      }
    }

    doc.status = "VERIFIED";
    doc.verifiedBy = adminId;
    doc.verifiedAt = new Date();
    (doc as { rejectReason?: string }).rejectReason = undefined;
    await doc.save();

    let assignedLicenseKey: string | undefined;
    try {
      const { key } = await recordLicenseKeyConsumedForPayment({
        studentId: doc.studentId,
        courseId,
        batchMongoId: batchId,
        createdBy: adminId,
      });
      assignedLicenseKey = key;
    } catch {
      assignedLicenseKey = undefined;
    }

    return {
      message: enrollmentCreated
        ? "Access enabled and license key recorded. Student can start the course (or use the key if needed)."
        : "Payment verified. Student was already enrolled; license key recorded for records.",
      enrollmentCreated,
      kind: "COURSE" as const,
      assignedLicenseKey,
    };
  }

  const productId = doc.productId?.trim();
  if (!productId) throw new AppError("Invalid shop payment record", 400);

  await fulfillShopOrderAfterExternalPayment(doc.studentId, productId);

  doc.status = "VERIFIED";
  doc.verifiedBy = adminId;
  doc.verifiedAt = new Date();
  (doc as { rejectReason?: string }).rejectReason = undefined;
  await doc.save();

  return {
    message: "Shop order fulfilled for the student.",
    enrollmentCreated: false,
    kind: "SHOP" as const,
  };
}

export async function listPendingPayments() {
  return PaymentSubmissionModel.find({ status: "PENDING" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
}

export async function hasPendingCoursePayment(studentId: string, batchId: string, courseId: string): Promise<boolean> {
  const one = await PaymentSubmissionModel.findOne({
    studentId,
    batchId,
    courseId,
    status: "PENDING",
    $or: [{ kind: "COURSE" }, { kind: { $exists: false } }],
  })
    .select("_id")
    .lean()
    .exec();
  return !!one;
}

export async function hasPendingShopPayment(studentId: string, productId: string): Promise<boolean> {
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
  batchId: string,
  courseId: string
): Promise<{ status: "PENDING" | "REJECTED" | "VERIFIED"; rejectReason?: string } | null> {
  const doc = await PaymentSubmissionModel.findOne({
    studentId,
    batchId,
    courseId,
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
  await doc.save();
  return { ok: true };
}
