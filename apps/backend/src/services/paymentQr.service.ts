import { UserModel } from "../models/User.model.js";
import { PaymentQrGenerationModel } from "../models/PaymentQrGeneration.model.js";
import { AppError } from "../utils/AppError.js";

const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/;

function toPaise(amountRupees: number): number {
  return Math.round(amountRupees * 100);
}

function buildUpiLink(input: { upiId: string; receiverName: string; prefillAmount: boolean; amountRupees?: number }): string {
  const params = new URLSearchParams();
  params.set("pa", input.upiId);
  params.set("pn", input.receiverName);
  if (input.prefillAmount && input.amountRupees != null) {
    params.set("am", input.amountRupees.toFixed(2));
  }
  params.set("cu", "INR");
  return `upi://pay?${params.toString()}`;
}

export async function generatePaymentQrRecord(input: {
  adminId: string;
  upiId: string;
  receiverName: string;
  prefillAmount: boolean;
  amountRupees?: number;
}) {
  const upiId = input.upiId.trim();
  const receiverName = input.receiverName.trim();
  if (!UPI_ID_REGEX.test(upiId)) {
    throw new AppError("UPI ID is invalid. Example format: name@bank", 400);
  }
  if (receiverName.length < 2) throw new AppError("Receiver name is required", 400);

  let amountRupees: number | undefined;
  let amountPaise: number | undefined;
  if (input.prefillAmount) {
    amountRupees = Number(input.amountRupees);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      throw new AppError("Amount must be greater than 0 when Prefill Amount is enabled", 400);
    }
    amountPaise = toPaise(amountRupees);
  }

  const paymentLink = buildUpiLink({
    upiId,
    receiverName,
    prefillAmount: input.prefillAmount,
    amountRupees,
  });

  const doc = await PaymentQrGenerationModel.create({
    adminId: input.adminId,
    upiId,
    receiverName,
    amountPaise,
    prefillAmount: input.prefillAmount,
    paymentLink,
  });

  return {
    id: String(doc._id),
    upiId,
    receiverName,
    prefillAmount: input.prefillAmount,
    amountRupees: amountPaise != null ? amountPaise / 100 : null,
    paymentLink,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
  };
}

export async function listPaymentQrHistory(input: { page: number; limit: number }) {
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit) || 25)));
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    PaymentQrGenerationModel.countDocuments({}).exec(),
    PaymentQrGenerationModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
  ]);

  const adminIds = [...new Set(rows.map((r) => String((r as { adminId: string }).adminId)))];
  const admins = adminIds.length
    ? await UserModel.find({ _id: { $in: adminIds } }).select("name username").lean().exec()
    : [];
  const adminMap = new Map(admins.map((a) => [String(a._id), a as { name?: string; username?: string }]));

  return {
    rows: rows.map((r) => {
      const rr = r as {
        _id: unknown;
        adminId: string;
        upiId: string;
        receiverName: string;
        amountPaise?: number;
        prefillAmount: boolean;
        paymentLink: string;
        createdAt?: Date;
      };
      const admin = adminMap.get(rr.adminId);
      return {
        id: String(rr._id),
        adminId: rr.adminId,
        adminName: admin?.name?.trim() || "—",
        adminUsername: admin?.username?.trim() || "—",
        upiId: rr.upiId,
        receiverName: rr.receiverName,
        prefillAmount: !!rr.prefillAmount,
        amountRupees: rr.amountPaise != null ? rr.amountPaise / 100 : null,
        paymentLink: rr.paymentLink,
        createdAt: rr.createdAt ? new Date(rr.createdAt).toISOString() : "",
      };
    }),
    total,
    page,
    limit,
  };
}
