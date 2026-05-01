"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type PaymentUpiConfigApiResponse =
  | {
      configured: true;
      id: string;
      upiId: string;
      receiverName: string;
      updatedBy: string;
      updatedAt: string;
    }
  | { configured: false };

export type PlatformUpiSummaryState =
  | "idle"
  | "loading"
  | "network_error"
  | { kind: "missing" }
  | { kind: "ok"; upiId: string; receiverName: string };

export function mapPaymentUpiApiToSummary(r: {
  success: boolean;
  data?: PaymentUpiConfigApiResponse;
}): PlatformUpiSummaryState {
  if (!r.success || r.data === undefined) return "network_error";
  if (r.data.configured === false) return { kind: "missing" };
  return { kind: "ok", upiId: r.data.upiId, receiverName: r.data.receiverName };
}

const UPI_CENTER_HREF = "/payment-qr?section=UPI";

function fieldShell(children: ReactNode) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm text-slate-900 shadow-inner">{children}</div>
  );
}

export function PlatformUpiCheckoutSummary({
  state,
  variant = "inline",
}: {
  state: PlatformUpiSummaryState;
  variant?: "inline" | "panel";
}) {
  if (state === "idle") return null;

  const outer =
    variant === "inline"
      ? "rounded-lg border border-teal-100 bg-white px-3 py-2.5 text-[12px] leading-snug text-slate-700 shadow-sm"
      : "mt-3 rounded-lg border border-teal-100/80 bg-white/90 px-3 py-3 text-sm text-slate-800";

  if (state === "loading") {
    return (
      <div className={outer}>
        <p className="font-semibold text-slate-900">Receiving UPI (read-only)</p>
        <p className="mt-1.5 text-slate-500">Loading current settings…</p>
      </div>
    );
  }

  if (state === "network_error") {
    return (
      <div className={outer}>
        <p className="font-semibold text-slate-900">Receiving UPI</p>
        <p className="mt-1.5 text-slate-600">We could not reach the server. Check your connection and try again.</p>
        <Link
          href={UPI_CENTER_HREF}
          className="mt-3 inline-flex w-fit items-center rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
        >
          Open UPI &amp; QR center
        </Link>
      </div>
    );
  }

  if (state.kind === "missing") {
    return (
      <div className={outer}>
        <p className="font-semibold text-slate-900">Receiving UPI (read-only)</p>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Payee name</p>
        {fieldShell(<span className="text-slate-500">Not configured yet</span>)}
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">UPI ID</p>
        {fieldShell(<span className="text-slate-500">Not configured yet</span>)}
        <p className="mt-2 text-xs text-slate-600">
          Manual checkout needs a platform receiving UPI. Super Admin can set it here; other staff can submit the UPI you need.
        </p>
        <Link
          href={UPI_CENTER_HREF}
          className="mt-3 inline-flex w-fit items-center rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
        >
          Request or set up UPI
        </Link>
      </div>
    );
  }

  return (
    <div className={outer}>
      <p className="font-semibold text-slate-900">Receiving UPI (read-only)</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Payee name</p>
      {fieldShell(state.receiverName)}
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">UPI ID</p>
      {fieldShell(<span className="break-all font-mono text-[13px]">{state.upiId}</span>)}
      <Link href={UPI_CENTER_HREF} className="mt-3 inline-block text-xs font-semibold text-teal-700 hover:underline">
        Report a problem or request a change →
      </Link>
    </div>
  );
}
