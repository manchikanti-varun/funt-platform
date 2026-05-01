import QRCode from "qrcode";
import { ROLLING_UPI_QR_REFRESH_AFTER_SECONDS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";
import { createAuditLog } from "./audit.service.js";
import { PaymentUpiConfigModel } from "../models/PaymentUpiConfig.model.js";
import { PaymentUpiChangeRequestModel } from "../models/PaymentUpiChangeRequest.model.js";
import { UserModel } from "../models/User.model.js";

const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/;
const CONFIG_KEY = "ACTIVE";

function normalizeUpiId(raw: string): string {
  return raw.trim().toLowerCase();
}

function assertUpi(upiId: string, receiverName: string): void {
  if (!UPI_ID_REGEX.test(upiId)) throw new AppError("Invalid UPI ID format", 400);
  if (!receiverName.trim() || receiverName.trim().length < 2) throw new AppError("Receiver name is required", 400);
}

/** Admin GET: never throws; does not auto-create from env (read-only view). */
export type PaymentUpiConfigAdminDto =
  | {
      configured: true;
      id: string;
      upiId: string;
      receiverName: string;
      updatedBy: string;
      updatedAt: string;
    }
  | { configured: false };

export async function getPaymentUpiConfigForAdmin(): Promise<PaymentUpiConfigAdminDto> {
  const doc = await PaymentUpiConfigModel.findOne({ key: CONFIG_KEY }).exec();
  if (doc) {
    return {
      configured: true,
      id: String(doc._id),
      upiId: doc.upiId,
      receiverName: doc.receiverName,
      updatedBy: doc.updatedBy ?? "",
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
    };
  }
  const envUpi = process.env.PAYMENT_UPI_ID?.trim() || "";
  const envName = process.env.PAYMENT_UPI_NAME?.trim() || "FUNT";
  if (!envUpi) return { configured: false };
  try {
    assertUpi(envUpi, envName);
  } catch {
    return { configured: false };
  }
  return {
    configured: true,
    id: "",
    upiId: normalizeUpiId(envUpi),
    receiverName: envName.trim(),
    updatedBy: "",
    updatedAt: "",
  };
}

export async function getPaymentUpiConfig() {
  let doc = await PaymentUpiConfigModel.findOne({ key: CONFIG_KEY }).exec();
  if (!doc) {
    const envUpi = process.env.PAYMENT_UPI_ID?.trim() || "";
    const envName = process.env.PAYMENT_UPI_NAME?.trim() || "FUNT";
    if (!envUpi) {
      throw new AppError("Payment UPI config missing. Set PAYMENT_UPI_ID/PAYMENT_UPI_NAME or update via Super Admin.", 503);
    }
    assertUpi(envUpi, envName);
    doc = await PaymentUpiConfigModel.create({
      key: CONFIG_KEY,
      upiId: normalizeUpiId(envUpi),
      receiverName: envName.trim(),
      updatedAt: new Date(),
    });
  }
  return {
    id: String(doc._id),
    upiId: doc.upiId,
    receiverName: doc.receiverName,
    updatedBy: doc.updatedBy ?? "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}

export async function updatePaymentUpiConfig(input: {
  upiId: string;
  receiverName: string;
  changedBy: string;
  reason?: string;
}) {
  const upiId = normalizeUpiId(input.upiId);
  const receiverName = input.receiverName.trim();
  assertUpi(upiId, receiverName);
  const prevDto = await getPaymentUpiConfigForAdmin();
  const prevUpi = prevDto.configured ? prevDto.upiId : "";
  const prevName = prevDto.configured ? prevDto.receiverName : "";
  const doc = await PaymentUpiConfigModel.findOneAndUpdate(
    { key: CONFIG_KEY },
    {
      $set: {
        upiId,
        receiverName,
        updatedBy: input.changedBy,
        updatedAt: new Date(),
      },
    },
    { new: true, upsert: true }
  ).exec();
  await createAuditLog("PAYMENT_UPI_UPDATED", input.changedBy, "PaymentUpiConfig", String(doc._id), {
    oldUpiId: prevUpi,
    newUpiId: upiId,
    oldReceiverName: prevName,
    newReceiverName: receiverName,
    reason: input.reason?.trim() || "",
  });
  return {
    upiId: doc.upiId,
    receiverName: doc.receiverName,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}

export async function submitPaymentUpiChangeRequest(input: {
  requestedBy: string;
  proposedUpiId: string;
  proposedReceiverName: string;
  reason: string;
}) {
  const proposedUpiId = normalizeUpiId(input.proposedUpiId);
  const proposedReceiverName = input.proposedReceiverName.trim();
  const reason = input.reason.trim();
  assertUpi(proposedUpiId, proposedReceiverName);
  if (reason.length < 8) throw new AppError("Reason must be at least 8 characters", 400);
  const pending = await PaymentUpiChangeRequestModel.findOne({ status: "PENDING" }).select("_id").lean().exec();
  if (pending) throw new AppError("A UPI change request is already pending Super Admin review", 400);
  const doc = await PaymentUpiChangeRequestModel.create({
    requestedBy: input.requestedBy,
    proposedUpiId,
    proposedReceiverName,
    reason,
    status: "PENDING",
  });
  await createAuditLog("PAYMENT_UPI_CHANGE_REQUESTED", input.requestedBy, "PaymentUpiChangeRequest", String(doc._id), {
    proposedUpiId,
    proposedReceiverName,
    reason,
  });
  return { id: String(doc._id), status: "PENDING" as const };
}

export async function listPaymentUpiChangeRequests() {
  const rows = await PaymentUpiChangeRequestModel.find({}).sort({ createdAt: -1 }).lean().exec();
  const userIds = [...new Set(rows.flatMap((r) => [String(r.requestedBy), String(r.reviewedBy ?? "")]).filter(Boolean))];
  const users = userIds.length ? await UserModel.find({ _id: { $in: userIds } }).select("name username").lean().exec() : [];
  const umap = new Map(users.map((u) => [String(u._id), u as { name?: string; username?: string }]));
  return rows.map((r) => ({
    id: String(r._id),
    proposedUpiId: r.proposedUpiId,
    proposedReceiverName: r.proposedReceiverName,
    reason: r.reason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedByName: umap.get(r.requestedBy)?.name ?? "—",
    requestedByUsername: umap.get(r.requestedBy)?.username ?? "—",
    reviewedBy: r.reviewedBy ?? "",
    reviewedByName: r.reviewedBy ? umap.get(r.reviewedBy)?.name ?? "—" : "—",
    reviewedByUsername: r.reviewedBy ? umap.get(r.reviewedBy)?.username ?? "—" : "—",
    rejectReason: r.rejectReason ?? "",
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
    reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : "",
  }));
}

export async function approvePaymentUpiChangeRequest(input: { requestId: string; reviewedBy: string }) {
  const req = await PaymentUpiChangeRequestModel.findById(input.requestId).exec();
  if (!req) throw new AppError("UPI change request not found", 404);
  if (req.status !== "PENDING") throw new AppError("This request is already processed", 400);
  const updated = await updatePaymentUpiConfig({
    upiId: req.proposedUpiId,
    receiverName: req.proposedReceiverName,
    changedBy: input.reviewedBy,
    reason: `Approved request ${String(req._id)}`,
  });
  req.status = "APPROVED";
  req.reviewedBy = input.reviewedBy;
  req.reviewedAt = new Date();
  req.rejectReason = undefined;
  await req.save();
  await createAuditLog("PAYMENT_UPI_CHANGE_APPROVED", input.reviewedBy, "PaymentUpiChangeRequest", String(req._id), {
    upiId: req.proposedUpiId,
    receiverName: req.proposedReceiverName,
  });
  return updated;
}

export async function rejectPaymentUpiChangeRequest(input: { requestId: string; reviewedBy: string; reason?: string }) {
  const req = await PaymentUpiChangeRequestModel.findById(input.requestId).exec();
  if (!req) throw new AppError("UPI change request not found", 404);
  if (req.status !== "PENDING") throw new AppError("This request is already processed", 400);
  req.status = "REJECTED";
  req.reviewedBy = input.reviewedBy;
  req.reviewedAt = new Date();
  req.rejectReason = input.reason?.trim() || "";
  await req.save();
  await createAuditLog("PAYMENT_UPI_CHANGE_REJECTED", input.reviewedBy, "PaymentUpiChangeRequest", String(req._id), {
    rejectReason: req.rejectReason || "",
  });
  return { ok: true };
}

export async function buildRollingUpiQr(input: {
  upiId: string;
  receiverName: string;
  amountPaise: number;
  referenceSeed: string;
}) {
  const amountRupees = Math.max(0, Math.floor(input.amountPaise)) / 100;
  const nowBucket = Math.floor(Date.now() / 30000);
  const tr = `${input.referenceSeed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}${nowBucket}`.slice(0, 35);
  const params = new URLSearchParams();
  params.set("pa", input.upiId);
  params.set("pn", input.receiverName);
  if (amountRupees > 0) params.set("am", amountRupees.toFixed(2));
  params.set("cu", "INR");
  params.set("tr", tr);
  const paymentLink = `upi://pay?${params.toString()}`;
  const qrDataUrl = await QRCode.toDataURL(paymentLink, {
    width: 560,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  return {
    paymentLink,
    qrDataUrl,
    refreshAfterSeconds: ROLLING_UPI_QR_REFRESH_AFTER_SECONDS,
  };
}

/** Primary checkout QR: single static image (no rolling refresh). */
export async function buildStaticUpiQr(input: {
  upiId: string;
  receiverName: string;
  amountPaise: number;
}) {
  const amountRupees = Math.max(0, Math.floor(input.amountPaise)) / 100;
  const params = new URLSearchParams();
  params.set("pa", input.upiId);
  params.set("pn", input.receiverName);
  if (amountRupees > 0) params.set("am", amountRupees.toFixed(2));
  params.set("cu", "INR");
  const paymentLink = `upi://pay?${params.toString()}`;
  const qrDataUrl = await QRCode.toDataURL(paymentLink, {
    width: 560,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  return {
    paymentLink,
    qrDataUrl,
  };
}
