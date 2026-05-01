"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel } from "@/components/ui";

interface CheckoutInfo {
  courseTitle: string;
  enrollmentPriceInPaise: number;
  enrollmentPriceRupees: number;
  finalPriceInPaise?: number;
  finalPriceRupees?: number;
  discountPaise?: number;
  couponApplied?: boolean;
  couponMessage?: string;
  upiQrUrl: string;
  upiPaymentLink?: string;
  upiQrRefreshAfterSeconds?: number;
  allowUpiManual?: boolean;
  allowRazorpayMethod?: boolean;
  paymentMethodsLabel?: string;
  razorpayEnabled: boolean;
  razorpayKeyId?: string;
}
interface PaymentTimeline {
  status: "PENDING" | "REJECTED" | "VERIFIED";
  rejectReason?: string;
  expectedSlaHours?: number;
  riskFlags?: string[];
  statusHistory?: Array<{ status: string; note?: string; actorId?: string; at: string }>;
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

function PaymentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = (searchParams.get("type") ?? "course").toLowerCase() === "shop" ? "shop" : "course";
  const batchId = searchParams.get("batchId") ?? "";
  const courseId = searchParams.get("courseId") ?? "";
  const productId = searchParams.get("productId") ?? "";
  const productName = searchParams.get("productName") ?? "";

  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);

  const [payerName, setPayerName] = useState("");
  const [amountRupees, setAmountRupees] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paidAt, setPaidAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [coursePending, setCoursePending] = useState(false);
  const [shopPending, setShopPending] = useState(false);
  const [courseRejected, setCourseRejected] = useState(false);
  const [shopRejected, setShopRejected] = useState(false);
  const [courseRejectReason, setCourseRejectReason] = useState("");
  const [shopRejectReason, setShopRejectReason] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [accessBlockedByAdmin, setAccessBlockedByAdmin] = useState(false);
  const [timeline, setTimeline] = useState<PaymentTimeline | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const [lastTimelineCheckedAt, setLastTimelineCheckedAt] = useState("");

  const loadCheckout = useCallback(() => {
    if (type !== "course" || !batchId || !courseId) return;
    setCheckoutErr(null);
    const qs = new URLSearchParams();
    qs.set("batchId", batchId);
    if (appliedCoupon.trim()) qs.set("couponCode", appliedCoupon.trim());
    api<CheckoutInfo>(`/api/student/courses/${encodeURIComponent(courseId)}/checkout?${qs.toString()}`)
      .then((r) => {
        if (r.success && r.data) {
          const d = r.data;
          setCheckout(d);
          if (d.enrollmentPriceInPaise > 0) {
            const due = d.finalPriceRupees ?? d.enrollmentPriceRupees;
            setAmountRupees(String(Number(due.toFixed(2))));
          }
        } else setCheckoutErr(r.message ?? "Could not load checkout");
      })
      .catch(() => setCheckoutErr("Could not load checkout"));
  }, [type, batchId, courseId, appliedCoupon]);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  useEffect(() => {
    if (type !== "course") return;
    const refreshSec = checkout?.upiQrRefreshAfterSeconds;
    if (!refreshSec || refreshSec < 5) return;
    const t = window.setInterval(() => {
      loadCheckout();
    }, refreshSec * 1000);
    return () => window.clearInterval(t);
  }, [type, checkout?.upiQrRefreshAfterSeconds, loadCheckout]);

  useEffect(() => {
    const refreshSec = checkout?.upiQrRefreshAfterSeconds ?? 0;
    if (refreshSec < 5) {
      setQrSecondsLeft(0);
      return;
    }
    setQrSecondsLeft(refreshSec);
    const t = window.setInterval(() => {
      setQrSecondsLeft((s) => (s <= 1 ? refreshSec : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [checkout?.upiQrRefreshAfterSeconds]);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (type === "course" && batchId && courseId) {
      qs.set("batchId", batchId);
      qs.set("courseId", courseId);
    }
    if (type === "shop" && productId) qs.set("productId", productId);
    setChecking(true);
    setAccessBlockedByAdmin(false);

    const applyPending = (r: {
      success: boolean;
      data?: {
        coursePending: boolean;
        shopPending: boolean;
        courseRejected?: boolean;
        shopRejected?: boolean;
        courseRejectReason?: string;
        shopRejectReason?: string;
      };
    }) => {
      if (r.success && r.data) {
        setCoursePending(!!r.data.coursePending);
        setShopPending(!!r.data.shopPending);
        setCourseRejected(!!r.data.courseRejected);
        setShopRejected(!!r.data.shopRejected);
        setCourseRejectReason(r.data.courseRejectReason?.trim() ?? "");
        setShopRejectReason(r.data.shopRejectReason?.trim() ?? "");
      }
    };

    if (type === "course" && batchId && courseId) {
      Promise.all([
        api<{
          coursePending: boolean;
          shopPending: boolean;
          courseRejected?: boolean;
          shopRejected?: boolean;
          courseRejectReason?: string;
          shopRejectReason?: string;
        }>(`/api/student/payments/pending?${qs.toString()}`),
        api<{ accessBlocked?: boolean }>(
          `/api/student/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}`
        ),
        api<PaymentTimeline>(
          `/api/student/payments/timeline?kind=COURSE&batchId=${encodeURIComponent(batchId)}&courseId=${encodeURIComponent(courseId)}`
        ),
      ])
        .then(([payRes, courseRes, timelineRes]) => {
          applyPending(payRes);
          if (courseRes.success && courseRes.data?.accessBlocked === true) {
            setAccessBlockedByAdmin(true);
          }
          setTimeline(timelineRes.success ? (timelineRes.data ?? null) : null);
          setLastTimelineCheckedAt(new Date().toLocaleTimeString());
        })
        .finally(() => setChecking(false));
      return;
    }

    api<{
      coursePending: boolean;
      shopPending: boolean;
      courseRejected?: boolean;
      shopRejected?: boolean;
      courseRejectReason?: string;
      shopRejectReason?: string;
    }>(`/api/student/payments/pending?${qs.toString()}`)
      .then(applyPending)
      .finally(() => setChecking(false));
  }, [type, batchId, courseId, productId]);

  useEffect(() => {
    if (!(type === "course" && batchId && courseId && coursePending)) return;
    const t = window.setInterval(() => {
      api<PaymentTimeline>(
        `/api/student/payments/timeline?kind=COURSE&batchId=${encodeURIComponent(batchId)}&courseId=${encodeURIComponent(courseId)}`
      ).then((r) => {
        setTimeline(r.success ? (r.data ?? null) : null);
        setLastTimelineCheckedAt(new Date().toLocaleTimeString());
      });
    }, 15000);
    return () => window.clearInterval(t);
  }, [type, batchId, courseId, coursePending]);

  function getOrCreateDeviceId(): string {
    if (typeof window === "undefined") return "server";
    const key = "funt_device_id";
    const existing = window.localStorage.getItem(key);
    if (existing?.trim()) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `dev-${Date.now()}`;
    window.localStorage.setItem(key, next);
    return next;
  }

  async function handleUpiSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const parsedPaidAt = new Date(paidAt);
    if (Number.isNaN(parsedPaidAt.getTime())) {
      setMsg({ type: "err", text: "Enter a valid payment date and time." });
      setLoading(false);
      return;
    }
    const body: Record<string, string | number> = {
      kind: type === "shop" ? "SHOP" : "COURSE",
      transactionId: transactionId.trim(),
      paidAt: parsedPaidAt.toISOString(),
    };
    if (type === "course") {
      const paise = Math.round(Number(amountRupees) * 100);
      if (!Number.isFinite(paise) || paise < 0) {
        setMsg({ type: "err", text: "Enter a valid amount (INR)." });
        setLoading(false);
        return;
      }
      body.amountPaise = paise;
      body.payerName = payerName.trim();
      body.batchId = batchId;
      body.courseId = courseId;
      if (appliedCoupon.trim()) body.couponCode = appliedCoupon.trim();
    } else {
      body.productId = productId;
    }
    const res = await api("/api/student/payments", {
      method: "POST",
      headers: {
        "x-device-id": getOrCreateDeviceId(),
        "x-idempotency-key":
          typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `idem-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.success) {
      const okText =
        res.message ??
        "Submitted. An administrator will verify your payment and link your license.";
      setMsg({ type: "ok", text: okText });
      if (type === "course" && courseId) {
        window.setTimeout(() => {
          router.push(`/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}`);
        }, 2800);
      } else if (type === "shop") {
        window.setTimeout(() => router.push("/shop"), 2000);
      }
    } else {
      setMsg({ type: "err", text: res.message ?? "Could not submit." });
    }
  }

  const showManualUpi = !!(checkout && checkout.enrollmentPriceInPaise >= 100 && checkout.allowUpiManual);
  const showRazorpay = !!(checkout?.razorpayEnabled);

  async function openRazorpay() {
    setMsg(null);
    if (!batchId || !courseId) return;
    setLoading(true);
    try {
      const orderRes = await api<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        courseTitle: string;
      }>("/api/student/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({
          batchId,
          courseId,
          ...(appliedCoupon.trim() ? { couponCode: appliedCoupon.trim() } : {}),
        }),
      });
      if (!orderRes.success || !orderRes.data) {
        setMsg({ type: "err", text: orderRes.message ?? "Could not start checkout." });
        setLoading(false);
        return;
      }
      const { orderId, amount, keyId, courseTitle } = orderRes.data;
      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } })
        .Razorpay;
      const opts = {
        key: keyId,
        amount,
        currency: "INR",
        order_id: orderId,
        name: "FUNT Learn",
        description: courseTitle,
        theme: { color: "#0f766e" },
        handler: async (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setLoading(true);
          const confirm = await api("/api/student/payments/razorpay/confirm", {
            method: "POST",
            body: JSON.stringify({
              batchId,
              courseId,
              ...(appliedCoupon.trim() ? { couponCode: appliedCoupon.trim() } : {}),
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          setLoading(false);
          if (confirm.success) {
            setMsg({
              type: "ok",
              text:
                confirm.message ??
                "Payment successful. You are enrolled.",
            });
            window.setTimeout(() => {
              router.push(`/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}`);
            }, 2400);
          } else {
            setMsg({ type: "err", text: confirm.message ?? "Could not confirm payment." });
          }
        },
      };
      new Razorpay(opts).open();
      setLoading(false);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Checkout failed." });
      setLoading(false);
    }
  }

  const waiting = (type === "course" && coursePending) || (type === "shop" && shopPending);

  if (type === "course" && (!batchId || !courseId)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-lg">
        <p className="font-medium text-funt-ink">Missing course details.</p>
        <p className="mt-2 text-sm text-black/60">Open a course from the catalog and use Pay from there.</p>
        <Link href="/courses" className="mt-6 inline-block text-sm font-semibold text-funt-gold-deep underline">
          Back to courses
        </Link>
      </div>
    );
  }

  if (type === "shop" && !productId) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-lg">
        <p className="font-medium text-funt-ink">No product selected.</p>
        <Link href="/shop" className="mt-6 inline-block text-sm font-semibold text-funt-gold-deep underline">
          Back to shop
        </Link>
      </div>
    );
  }

  if (!checking && type === "course" && accessBlockedByAdmin) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <Link
          href={`/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}`}
          className="text-sm font-medium text-funt-gold-deep hover:underline"
        >
          ← Course
        </Link>
        <div className="surface-blocked mt-4">
          <p className="label-overline text-rose-800/90">Payment</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-rose-950">Access blocked</h1>
          <p className="text-muted mt-3 text-rose-900/90">Administrator turned off LMS access — payment will not unlock this course until they restore it.</p>
        </div>
      </div>
    );
  }

  return (
    <AppPageShell className="max-w-lg">
      <Link
        href={type === "shop" ? "/shop" : `/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}`}
        className="text-sm font-medium text-funt-gold-deep hover:underline"
      >
        ← Back
      </Link>
      <FormPanel className="mt-4 border-funt-gold/35 bg-gradient-to-br from-white via-funt-butter/80 to-funt-honey/30 p-8 shadow-xl shadow-black/10 ring-funt-gold/20">
        <h1 className="text-xl font-semibold tracking-tight text-funt-ink">
          {type === "course" ? "Enroll — payment" : "Shop payment"}
        </h1>
        <p className="text-muted mt-2">
          {type === "course"
            ? checkout?.courseTitle
              ? `Course: ${checkout.courseTitle}`
              : "Course checkout."
            : productName
              ? decodeURIComponent(productName)
              : "Order proof."}
        </p>

        {type === "course" && (
          <p className="mt-3 text-sm text-black/70">
            Already have a code?{" "}
            <Link href="/enroll-license" className="font-semibold text-funt-gold-deep underline">
              Enter license key
            </Link>
          </p>
        )}
        {type === "course" ? (
          <div className="mt-4 rounded-xl border border-black/10 bg-white/90 p-3 shadow-sm ring-1 ring-black/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Simple steps</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-slate-700">
              <li>Apply coupon (optional) and confirm final amount.</li>
              <li>Pay using UPI QR or Razorpay.</li>
              <li>Submit details only for manual UPI, then track approval timeline.</li>
            </ol>
          </div>
        ) : null}

        {type === "course" && checkoutErr && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{checkoutErr}</p>
        )}

        {checking ? (
          <div className="mt-8 flex justify-center py-6">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-funt-gold/30 border-t-funt-gold-deep" />
          </div>
        ) : waiting ? (
          <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-4 text-sm font-medium text-amber-950 shadow-md shadow-amber-200/40 ring-1 ring-amber-100/80">
            <p className="font-semibold">Waiting for administrator approval</p>
            <p className="mt-2 text-sm font-normal text-amber-900/95">
              Your payment details were already submitted for this course. You cannot submit again. You will get access
              after an admin confirms your payment.
            </p>
            <p className="mt-2 text-xs font-normal text-amber-900/90">
              Auto-refreshing status every 15 seconds. Last checked: {lastTimelineCheckedAt || "just now"}.
            </p>
            <p className="mt-1 text-xs font-normal text-amber-900/90">
              Next action: wait for verification. Access unlocks automatically after admin approval.
            </p>
          </div>
          {timeline && (timeline.statusHistory?.length ?? 0) > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment review timeline</p>
              <p className="mt-1 text-xs text-slate-600">Expected review SLA: ~{timeline.expectedSlaHours ?? 24} hours</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-700">
                {(timeline.statusHistory ?? []).slice().reverse().slice(0, 4).map((e, idx) => (
                  <li key={`${e.status}-${idx}`} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                    <span className="font-semibold">{e.status}</span> - {e.note ?? "Status updated"}
                    <span className="ml-1 text-slate-500">({new Date(e.at).toLocaleString()})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          </div>
        ) : type === "course" ? (
          <>
            {checkout && checkout.enrollmentPriceInPaise >= 100 ? (
              <div className="mt-4 rounded-xl border border-black/10 bg-white/90 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-black/50">Coupon (optional)</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="input min-w-[10rem] flex-1"
                    value={couponDraft}
                    onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                    placeholder="Code"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-sm"
                    onClick={() => setAppliedCoupon(couponDraft.trim())}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-sm"
                    onClick={() => {
                      setCouponDraft("");
                      setAppliedCoupon("");
                    }}
                  >
                    Clear
                  </button>
                </div>
                {checkout.couponMessage ? (
                  <p className="text-sm font-medium text-amber-900">{checkout.couponMessage}</p>
                ) : null}
                {(checkout.discountPaise ?? 0) > 0 ? (
                  <p className="text-sm text-black/80">
                    <span className="font-semibold">Discount:</span> −₹{((checkout.discountPaise ?? 0) / 100).toFixed(2)}
                  </p>
                ) : null}
              </div>
            ) : null}
            {checkout &&
            checkout.enrollmentPriceInPaise >= 100 &&
            checkout.allowUpiManual === false &&
            checkout.razorpayEnabled === false ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No payment method is enabled for this course. Contact your school.
              </p>
            ) : null}
            {!checkout?.razorpayEnabled && checkout?.allowRazorpayMethod ? (
              <p className="mt-2 text-xs text-black/50">Online checkout is not available yet. Your school has been notified.</p>
            ) : null}

            {showManualUpi ? (
              <div className="mt-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-black/50">Scan &amp; pay</p>
                {checkout?.upiQrUrl ? (
                  <div className="rounded-xl border border-black/10 bg-white p-4 text-center shadow-sm ring-1 ring-black/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-black/50">Scan to pay</p>
                    <img src={checkout.upiQrUrl} alt="UPI QR" className="mx-auto mt-3 max-h-56 w-auto max-w-full object-contain" />
                    {checkout.upiQrRefreshAfterSeconds ? (
                      <div className="mx-auto mt-3 max-w-xs">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full bg-teal-600 transition-all duration-1000"
                            style={{ width: `${Math.max(0, (qrSecondsLeft / checkout.upiQrRefreshAfterSeconds) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">QR refreshes in {qrSecondsLeft}s</p>
                      </div>
                    ) : null}
                    {checkout.upiPaymentLink ? (
                      <p className="mt-2 text-[11px] text-black/50">Use any UPI app to scan and pay.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-black/15 bg-funt-honey/30 px-3 py-2 text-sm text-black/70">
                    Your school has not uploaded a UPI QR for this batch yet. Ask them to add one in batch settings, or use
                    Razorpay if available.
                  </p>
                )}
                {checkout && checkout.enrollmentPriceInPaise > 0 && (
                  <div className="space-y-1 text-center text-sm text-black">
                    <p>
                      <span className="text-black/60">List price:</span>{" "}
                      <span className="font-semibold">₹{checkout.enrollmentPriceRupees.toFixed(2)}</span>
                    </p>
                    {(checkout.discountPaise ?? 0) > 0 ? (
                      <p>
                        <span className="text-black/60">After discount:</span>{" "}
                        <span className="font-bold">₹{(checkout.finalPriceRupees ?? checkout.enrollmentPriceRupees).toFixed(2)}</span>
                      </p>
                    ) : (
                      <p className="font-bold">Amount due: ₹{checkout.enrollmentPriceRupees.toFixed(2)}</p>
                    )}
                  </div>
                )}
                {!checking && courseRejected ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-950">
                    Previous payment was not approved.
                    {courseRejectReason ? (
                      <span className="mt-1 block font-normal text-amber-900/90">Reason: {courseRejectReason}</span>
                    ) : null}
                  </div>
                ) : null}
                {timeline && (timeline.statusHistory?.length ?? 0) > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment review timeline</p>
                    <p className="mt-1 text-xs text-slate-600">Expected review SLA: ~{timeline.expectedSlaHours ?? 24} hours</p>
                    <ul className="mt-2 space-y-2 text-xs text-slate-700">
                      {(timeline.statusHistory ?? []).slice().reverse().slice(0, 4).map((e, idx) => (
                        <li key={`${e.status}-${idx}`} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                          <span className="font-semibold">{e.status}</span> - {e.note ?? "Status updated"}
                          <span className="ml-1 text-slate-500">({new Date(e.at).toLocaleString()})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <form onSubmit={handleUpiSubmit} className="space-y-4">
                  <label className="block text-sm font-medium text-funt-ink">
                    Your name (as on UPI / bank)
                    <input
                      className="input mt-1.5"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      required
                      placeholder="Full name"
                    />
                  </label>
                  <label className="block text-sm font-medium text-funt-ink">
                    Amount paid (INR)
                    <input
                      className="input mt-1.5"
                      type="number"
                      min={0}
                      step="0.01"
                      value={amountRupees}
                      onChange={(e) => setAmountRupees(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-funt-ink">
                    UPI / bank reference (UTR)
                    <input
                      className="input mt-1.5"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      required
                      placeholder="12-digit UTR or reference"
                    />
                  </label>
                  <label className="block text-sm font-medium text-funt-ink">
                    Date &amp; time paid
                    <input
                      type="datetime-local"
                      className="input mt-1.5"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                      required
                    />
                  </label>
                  {msg && (
                    <div
                      className={`rounded-xl px-3 py-2 text-sm font-medium ${
                        msg.type === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}
                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                    {loading ? "Submitting…" : "Submit payment details"}
                  </button>
                </form>
              </div>
            ) : null}

            {showRazorpay ? (
              <div className={`space-y-4 ${showManualUpi ? "mt-8 border-t border-black/10 pt-8" : "mt-5"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-black/50">Pay online</p>
                <p className="text-sm text-black/75">
                  Pay with Razorpay. After a successful payment your enrollment and license key are confirmed automatically.
                  {checkout && checkout.enrollmentPriceInPaise > 0 ? (
                    <span className="mt-1 block font-semibold text-black">
                      You will be charged ₹{(checkout.finalPriceRupees ?? checkout.enrollmentPriceRupees).toFixed(2)}.
                    </span>
                  ) : null}
                </p>
                {msg && (
                  <div
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      msg.type === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}
                <button type="button" disabled={loading} onClick={() => void openRazorpay()} className="btn-primary w-full py-3">
                  {loading ? "Opening…" : "Pay with Razorpay"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <form onSubmit={handleUpiSubmit} className="mt-6 space-y-4">
            {!checking && shopRejected ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-950">
                Previous payment was not approved.
                {shopRejectReason ? (
                  <span className="mt-1 block font-normal text-amber-900/90">Reason: {shopRejectReason}</span>
                ) : null}
              </div>
            ) : null}
            <label className="block text-sm font-medium text-funt-ink">
              Transaction / reference ID
              <input
                className="input mt-1.5"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium text-funt-ink">
              Date &amp; time paid
              <input
                type="datetime-local"
                className="input mt-1.5"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                required
              />
            </label>
            {msg && (
              <div
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  msg.type === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"
                }`}
              >
                {msg.text}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Submitting…" : "Submit payment details"}
            </button>
          </form>
        )}
      </FormPanel>
    </AppPageShell>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-funt-gold/30 border-t-funt-gold-deep" />
        </div>
      }
    >
      <PaymentForm />
    </Suspense>
  );
}
