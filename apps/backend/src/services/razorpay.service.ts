import crypto from "crypto";
import { AppError } from "../utils/AppError.js";

function getCredentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function isRazorpayConfigured(): boolean {
  return getCredentials() !== null;
}

export function getRazorpayPublicKeyId(): string | null {
  return getCredentials()?.keyId ?? null;
}

export async function createRazorpayOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
  const cred = getCredentials();
  if (!cred) throw new AppError("Online card/UPI checkout is not configured", 503);
  const amount = Math.max(100, Math.floor(amountPaise));
  const auth = Buffer.from(`${cred.keyId}:${cred.keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: receipt.slice(0, 40),
      notes,
    }),
  });
  const data = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok) {
    throw new AppError(data.error?.description ?? "Could not create payment order", 502);
  }
  if (!data.id) throw new AppError("Invalid order response from gateway", 502);
  return { orderId: data.id, amount, currency: "INR" as const };
}

export async function fetchRazorpayOrder(orderId: string): Promise<{ amount: number; currency: string; status?: string }> {
  const cred = getCredentials();
  if (!cred) throw new AppError("Online card/UPI checkout is not configured", 503);
  const auth = Buffer.from(`${cred.keyId}:${cred.keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = (await res.json()) as { amount?: number; currency?: string; status?: string; error?: { description?: string } };
  if (!res.ok) {
    throw new AppError(data.error?.description ?? "Could not load payment order", 502);
  }
  const amount = Math.floor(Number(data.amount));
  if (!Number.isFinite(amount)) throw new AppError("Invalid order amount from gateway", 502);
  return { amount, currency: String(data.currency ?? "INR"), status: data.status };
}

export async function fetchRazorpayPayment(
  paymentId: string
): Promise<{ id: string; order_id: string; amount: number; status?: string; captured?: boolean }> {
  const cred = getCredentials();
  if (!cred) throw new AppError("Online card/UPI checkout is not configured", 503);
  const auth = Buffer.from(`${cred.keyId}:${cred.keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = (await res.json()) as {
    id?: string;
    order_id?: string;
    amount?: number;
    status?: string;
    captured?: boolean;
    error?: { description?: string };
  };
  if (!res.ok) throw new AppError(data.error?.description ?? "Could not load payment details", 502);
  const amount = Math.floor(Number(data.amount));
  if (!data.id || !data.order_id || !Number.isFinite(amount)) {
    throw new AppError("Invalid payment response from gateway", 502);
  }
  return {
    id: data.id,
    order_id: data.order_id,
    amount,
    status: data.status,
    captured: data.captured,
  };
}

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const cred = getCredentials();
  if (!cred) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", cred.keySecret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return expected === signature;
  }
}
