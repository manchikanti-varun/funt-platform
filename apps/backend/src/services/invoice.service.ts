import type { ClientSession } from "mongoose";
import { INVOICE_SOURCE, INVOICE_STATUS, type InvoiceSource } from "@funt-platform/constants";
import { InvoiceModel } from "../models/Invoice.model.js";
import { UserModel } from "../models/User.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import {
  getPublicInvoiceVerifyUrl,
  signInvoicePayload,
  verifyInvoiceSignatures,
  type InvoiceSignablePayload,
} from "../utils/invoiceSigning.js";
import { generateInvoicePdf } from "../utils/pdfInvoice.js";
import { buildInvoiceView, type InvoiceBaseDto, type InvoiceViewDto } from "./invoiceView.js";
import { getInvoiceSettings } from "./invoiceSettings.service.js";

export interface CreateInvoiceInput {
  studentId: string;
  batchId: string;
  courseId?: string;
  enrollmentId?: string;
  paymentSubmissionId?: string;
  source: InvoiceSource;
  amountInPaise?: number;
  discountInPaise?: number;
  notes?: string;
  createdBy: string;
  lineDescription?: string;
  lineItemType?: "SERVICE" | "GOODS";
  lineHsnCode?: string;
  lineSacCode?: string;
  session?: ClientSession;
}

function formatRupees(paise: number): string {
  return `₹${(Math.max(0, paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function nextInvoiceNumber(): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `FUNT-INV-${day}`;
  const count = await InvoiceModel.countDocuments({
    invoiceNumber: { $regex: `^${prefix}` },
  }).exec();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function resolveCourseSnapshot(
  batch: unknown,
  courseId?: string
): { courseId: string; title: string; enrollmentPriceInPaise: number } {
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const cid = String(courseId ?? "").trim();
  const snap =
    (cid ? snaps.find((s) => String((s as { courseId?: string }).courseId ?? "").trim() === cid) : undefined) ??
  snaps[0];
  if (!snap) {
    return { courseId: cid || "course", title: "Course enrollment", enrollmentPriceInPaise: 0 };
  }
  return {
    courseId: String((snap as { courseId?: string }).courseId ?? cid).trim(),
    title: String((snap as { title?: string }).title ?? "Course"),
    enrollmentPriceInPaise: Math.max(
      0,
      Math.floor(Number((snap as { enrollmentPriceInPaise?: number }).enrollmentPriceInPaise ?? 0))
    ),
  };
}

export function serializeInvoice(doc: {
  _id: unknown;
  invoiceNumber: string;
  studentId: string;
  batchId: string;
  courseId?: string | null;
  enrollmentId?: string | null;
  paymentSubmissionId?: string | null;
  source: string;
  status: string;
  amountInPaise: number;
  discountInPaise?: number | null;
  totalInPaise: number;
  currency: string;
  lineDescription: string;
  lineItemType?: string | null;
  lineHsnCode?: string | null;
  lineSacCode?: string | null;
  studentName?: string | null;
  studentEmail?: string | null;
  studentPhone?: string | null;
  studentAddress?: string | null;
  studentUsername?: string | null;
  batchName?: string | null;
  courseTitle?: string | null;
  notes?: string | null;
  issuedAt: Date;
  electronicallySignedAt?: Date | null;
  documentHash?: string | null;
  electronicSignature?: string | null;
  createdBy: string;
  createdAt?: Date;
}) {
  const total = Math.max(0, Math.floor(Number(doc.totalInPaise ?? 0)));
  const signedAt = doc.electronicallySignedAt ?? doc.issuedAt;
  return {
    id: String(doc._id),
    invoiceNumber: doc.invoiceNumber,
    studentId: doc.studentId,
    batchId: doc.batchId,
    courseId: doc.courseId ?? "",
    enrollmentId: doc.enrollmentId ?? "",
    paymentSubmissionId: doc.paymentSubmissionId ?? "",
    source: doc.source,
    status: doc.status,
    amountInPaise: doc.amountInPaise,
    discountInPaise: doc.discountInPaise ?? 0,
    totalInPaise: total,
    amountRupees: total / 100,
    amountFormatted: formatRupees(total),
    currency: doc.currency ?? "INR",
    lineDescription: doc.lineDescription,
    lineItemType: doc.lineItemType ?? "SERVICE",
    lineHsnCode: doc.lineHsnCode ?? "",
    lineSacCode: doc.lineSacCode ?? "",
    studentName: doc.studentName ?? "",
    studentEmail: doc.studentEmail ?? "",
    studentPhone: doc.studentPhone ?? "",
    studentAddress: doc.studentAddress ?? "",
    studentUsername: doc.studentUsername ?? "",
    batchName: doc.batchName ?? "",
    courseTitle: doc.courseTitle ?? "",
    notes: doc.notes ?? "",
    issuedAt: doc.issuedAt,
    electronicallySignedAt: signedAt,
    documentHash: doc.documentHash ?? "",
    electronicSignature: doc.electronicSignature ?? "",
    verifyUrl: getPublicInvoiceVerifyUrl(doc.invoiceNumber),
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  };
}

function toSignablePayload(doc: {
  invoiceNumber: string;
  studentId: string;
  batchId: string;
  courseId?: string | null;
  amountInPaise: number;
  discountInPaise?: number | null;
  totalInPaise: number;
  currency: string;
  lineDescription: string;
  status: string;
  issuedAt: Date;
}): InvoiceSignablePayload {
  return {
    invoiceNumber: doc.invoiceNumber,
    studentId: doc.studentId,
    batchId: doc.batchId,
    courseId: String(doc.courseId ?? ""),
    amountInPaise: doc.amountInPaise,
    discountInPaise: doc.discountInPaise ?? 0,
    totalInPaise: doc.totalInPaise,
    currency: doc.currency ?? "INR",
    lineDescription: doc.lineDescription,
    status: doc.status,
    issuedAt: doc.issuedAt,
  };
}

type InvoiceLeanDoc = Parameters<typeof serializeInvoice>[0];

/** Backfill integrity fields for invoices created before signing was added. */
async function ensureInvoiceSigned(
  doc: InvoiceLeanDoc & {
    courseId?: string | null;
    amountInPaise: number;
    discountInPaise?: number | null;
    totalInPaise: number;
    currency: string;
    lineDescription: string;
    status: string;
    issuedAt: Date;
    electronicallySignedAt?: Date | null;
    documentHash?: string | null;
    electronicSignature?: string | null;
  }
): Promise<InvoiceLeanDoc> {
  if (doc.documentHash?.trim() && doc.electronicSignature?.trim()) return doc;
  const signable = toSignablePayload(doc);
  const { documentHash, electronicSignature } = signInvoicePayload(signable);
  const electronicallySignedAt = doc.electronicallySignedAt ?? doc.issuedAt;
  await InvoiceModel.updateOne(
    { _id: doc._id },
    { $set: { documentHash, electronicSignature, electronicallySignedAt } }
  ).exec();
  return { ...doc, documentHash, electronicSignature, electronicallySignedAt } as InvoiceLeanDoc;
}

function formatStudentAddress(user: {
  address?: string | null;
  city?: string | null;
}): string {
  const parts = [String(user.address ?? "").trim(), String(user.city ?? "").trim()].filter(Boolean);
  return parts.join(", ");
}

async function enrichStudentRecipientFields<T extends { studentId: string; studentAddress?: string | null; studentPhone?: string | null }>(
  doc: T
): Promise<T> {
  const hasAddress = Boolean(doc.studentAddress?.trim());
  const hasPhone = Boolean(doc.studentPhone?.trim());
  if (hasAddress && hasPhone) return doc;

  const user = await UserModel.findById(doc.studentId)
    .select("address mobile city")
    .lean()
    .exec();
  if (!user) return doc;

  return {
    ...doc,
    studentAddress: hasAddress ? doc.studentAddress : formatStudentAddress(user as { address?: string; city?: string }),
    studentPhone: hasPhone ? doc.studentPhone : String((user as { mobile?: string }).mobile ?? ""),
  };
}

export async function createInvoice(input: CreateInvoiceInput) {
  const batch = await findBatchByParam(input.batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const student = await UserModel.findById(input.studentId)
    .select("_id username name email mobile address city")
    .lean()
    .exec();
  if (!student) throw new AppError("Student not found", 404);

  const course = resolveCourseSnapshot(batch, input.courseId);
  const amountInPaise =
    input.amountInPaise != null
      ? Math.max(0, Math.floor(Number(input.amountInPaise)))
      : course.enrollmentPriceInPaise;
  const discountInPaise = Math.max(0, Math.floor(Number(input.discountInPaise ?? 0)));
  /** Total amount payable (INR inclusive of tax); tax columns are derived when rendering. */
  const totalInPaise = Math.max(0, amountInPaise - discountInPaise);

  if (input.paymentSubmissionId?.trim()) {
    const existingPayment = await InvoiceModel.findOne({
      paymentSubmissionId: input.paymentSubmissionId.trim(),
      status: INVOICE_STATUS.ISSUED,
    })
      .lean()
      .exec();
    if (existingPayment) return serializeInvoice(existingPayment);
  }

  if (input.enrollmentId?.trim() && input.source === INVOICE_SOURCE.AUTO_ENROLLMENT) {
    const existingEnrollment = await InvoiceModel.findOne({
      enrollmentId: input.enrollmentId.trim(),
      source: INVOICE_SOURCE.AUTO_ENROLLMENT,
      status: INVOICE_STATUS.ISSUED,
    })
      .lean()
      .exec();
    if (existingEnrollment) return serializeInvoice(existingEnrollment);
  }

  const invoiceNumber = await nextInvoiceNumber();
  const lineDescription =
    input.lineDescription?.trim() ||
    `Course enrollment — ${course.title} (${(batch as { name?: string }).name ?? "Batch"})`;

  const issuedAt = new Date();
  const payload = {
    invoiceNumber,
    studentId: String(student._id),
    batchId: batchMongoId,
    courseId: course.courseId,
    enrollmentId: input.enrollmentId?.trim() || undefined,
    paymentSubmissionId: input.paymentSubmissionId?.trim() || undefined,
    source: input.source,
    status: INVOICE_STATUS.ISSUED,
    amountInPaise,
    discountInPaise,
    totalInPaise,
    currency: "INR",
    lineDescription,
    lineItemType: input.lineItemType === "GOODS" ? "GOODS" : "SERVICE",
    lineHsnCode: String(input.lineHsnCode ?? "").trim(),
    lineSacCode: String(input.lineSacCode ?? "").trim(),
    studentName: String((student as { name?: string }).name ?? ""),
    studentEmail: String((student as { email?: string }).email ?? ""),
    studentPhone: String((student as { mobile?: string }).mobile ?? ""),
    studentAddress: formatStudentAddress(student as { address?: string; city?: string }),
    studentUsername: String((student as { username?: string }).username ?? ""),
    batchName: String((batch as { name?: string }).name ?? ""),
    courseTitle: course.title,
    notes: String(input.notes ?? "").trim(),
    issuedAt,
    electronicallySignedAt: issuedAt,
    createdBy: input.createdBy,
  };

  const { documentHash, electronicSignature } = signInvoicePayload(toSignablePayload(payload));

  const createOpts = input.session ? { session: input.session } : undefined;
  const docs = await InvoiceModel.create(
    [{ ...payload, documentHash, electronicSignature }],
    createOpts
  );
  const doc = docs[0];

  await createAuditLog(
    input.source === INVOICE_SOURCE.MANUAL_ADMIN ? "INVOICE_MANUAL_ISSUED" : "INVOICE_ISSUED",
    input.createdBy,
    "Invoice",
    String(doc._id),
    { invoiceNumber, studentId: payload.studentId, batchId: payload.batchId, totalInPaise },
    input.session
  );

  return serializeInvoice(doc);
}

/** Called after a new enrollment row is created (admin, license, request approval, etc.). */
export async function issueInvoiceForEnrollment(input: {
  enrollmentId: string;
  studentId: string;
  batchId: string;
  courseId?: string;
  createdBy: string;
  amountInPaise?: number;
  paymentSubmissionId?: string;
  source?: InvoiceSource;
}) {
  try {
    return await createInvoice({
      studentId: input.studentId,
      batchId: input.batchId,
      courseId: input.courseId,
      enrollmentId: input.enrollmentId,
      paymentSubmissionId: input.paymentSubmissionId,
      source: input.source ?? INVOICE_SOURCE.AUTO_ENROLLMENT,
      amountInPaise: input.amountInPaise,
      createdBy: input.createdBy,
    });
  } catch (err) {
    console.error("[invoice] auto-issue failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** After payment verification creates or confirms enrollment. */
export async function issueInvoiceForPayment(input: {
  paymentSubmissionId: string;
  studentId: string;
  batchId: string;
  courseId: string;
  enrollmentId?: string;
  amountInPaise?: number;
  discountInPaise?: number;
  createdBy: string;
  session?: ClientSession;
}) {
  try {
    return await createInvoice({
      studentId: input.studentId,
      batchId: input.batchId,
      courseId: input.courseId,
      enrollmentId: input.enrollmentId,
      paymentSubmissionId: input.paymentSubmissionId,
      source: INVOICE_SOURCE.PAYMENT_VERIFIED,
      amountInPaise: input.amountInPaise,
      discountInPaise: input.discountInPaise,
      createdBy: input.createdBy,
      session: input.session,
    });
  } catch (err) {
    console.error("[invoice] payment-issue failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function createManualInvoice(input: {
  studentId: string;
  batchId: string;
  courseId?: string;
  amountInPaise?: number;
  discountInPaise?: number;
  notes?: string;
  lineDescription?: string;
  lineItemType?: "SERVICE" | "GOODS";
  createdBy: string;
}) {
  return createInvoice({
    ...input,
    source: INVOICE_SOURCE.MANUAL_ADMIN,
  });
}

export async function listInvoicesForAdmin(filters?: {
  batchId?: string;
  studentId?: string;
  limit?: number;
}) {
  const q: Record<string, unknown> = {};
  if (filters?.batchId?.trim()) {
    const batch = await findBatchByParam(filters.batchId.trim());
    if (batch) q.batchId = String((batch as { _id: unknown })._id);
  }
  if (filters?.studentId?.trim()) q.studentId = filters.studentId.trim();

  const limit = Math.min(200, Math.max(1, filters?.limit ?? 100));
  const rows = await InvoiceModel.find(q).sort({ issuedAt: -1 }).limit(limit).lean().exec();
  return rows.map((r) => serializeInvoice(r));
}

export async function listInvoicesForStudent(studentId: string) {
  const rows = await InvoiceModel.find({ studentId, status: INVOICE_STATUS.ISSUED })
    .sort({ issuedAt: -1 })
    .limit(100)
    .lean()
    .exec();
  return rows.map((r) => serializeInvoice(r));
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceViewDto> {
  const doc = await InvoiceModel.findById(invoiceId).lean().exec();
  if (!doc) throw new AppError("Invoice not found", 404);
  const signed = await ensureInvoiceSigned(doc);
  const enriched = await enrichStudentRecipientFields(signed);
  const settings = await getInvoiceSettings();
  return buildInvoiceView(serializeInvoice(enriched), settings);
}

export async function generateInvoicePdfBuffer(invoiceId: string): Promise<Buffer> {
  const view = await getInvoiceById(invoiceId);
  return generateInvoicePdf(view);
}

/** Sample invoice for admin template preview — same PDF pipeline as real invoices. */
const SAMPLE_INVOICE_BASE: InvoiceBaseDto = {
  id: "000000000000000000000000",
  invoiceNumber: "FUNT-INV-SAMPLE",
  studentId: "sample",
  studentName: "Srikar Ch",
  studentEmail: "srikar@example.com",
  studentPhone: "+91 98765 43210",
  studentAddress: "Hyderabad, Telangana",
  studentUsername: "srikar",
  batchName: "Batch 2025 — Morning",
  courseTitle: "Robotics Fundamentals",
  lineDescription: "Robotics Fundamentals — Batch 2025 Morning",
  lineItemType: "SERVICE",
  lineSacCode: "999293",
  amountInPaise: 499_900,
  discountInPaise: 0,
  totalInPaise: 499_900,
  amountFormatted: "₹4,999.00",
  currency: "INR",
  notes: "",
  issuedAt: new Date(),
};

export async function generateInvoiceSamplePdfBuffer(): Promise<Buffer> {
  const settings = await getInvoiceSettings();
  const view = buildInvoiceView(SAMPLE_INVOICE_BASE, settings);
  return generateInvoicePdf(view);
}

export async function verifyInvoicePublic(invoiceNumber: string) {
  const id = String(invoiceNumber ?? "").trim();
  if (!id) return null;

  const doc = await InvoiceModel.findOne({ invoiceNumber: id, status: INVOICE_STATUS.ISSUED }).lean().exec();
  if (!doc) return null;

  const signed = await ensureInvoiceSigned(doc);
  const signable = toSignablePayload(signed);
  const integrityOk = verifyInvoiceSignatures(
    signable,
    String(signed.documentHash ?? ""),
    String(signed.electronicSignature ?? "")
  );

  if (!integrityOk) {
    return {
      valid: false,
      message: "Invoice integrity check failed. The record may have been altered.",
      invoiceNumber: signed.invoiceNumber,
    };
  }

  const settings = await getInvoiceSettings();
  const view = buildInvoiceView(serializeInvoice(signed), settings);
  return {
    valid: true,
    invoiceNumber: signed.invoiceNumber,
    documentId: signed.invoiceNumber,
    studentName: signed.studentName ?? "",
    courseTitle: signed.courseTitle ?? "",
    batchName: signed.batchName ?? "",
    totalInPaise: view.grandTotalInPaise,
    amountFormatted: view.grandTotalFormatted,
    issuedAt: signed.issuedAt,
    electronicallySignedAt: signed.electronicallySignedAt ?? signed.issuedAt,
    signedBy: settings.legalName,
    documentHash: signed.documentHash,
    verifyUrl: getPublicInvoiceVerifyUrl(signed.invoiceNumber),
  };
}
