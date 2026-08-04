"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ensureCsrfToken } from "@/lib/api";
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

// ─── Payment method tabs (UPI / Razorpay side-by-side chooser) ───────────────
type MsgState = { type: "ok" | "err"; text: string } | null;

function PaymentMethodTabs({
  showManualUpi,
  showRazorpay,
  both,
  checkout,
  qrSecondsLeft,
  checking,
  courseRejected,
  courseRejectReason,
  timeline,
  amountDueRupees,
  amountDuePaise: _amountDuePaise,
  payerName,
  setPayerName,
  transactionId,
  setTransactionId,
  paidAt,
  setPaidAt,
  upiMsg,
  razorpayMsg,
  enrollStatus,
  enrolledLicenseKey,
  setEnrollStatus,
  setRazorpayMsg,
  loading,
  handleUpiSubmit,
  openRazorpay,
}: {
  showManualUpi: boolean;
  showRazorpay: boolean;
  both: boolean;
  checkout: CheckoutInfo | null;
  qrSecondsLeft: number;
  checking: boolean;
  courseRejected: boolean;
  courseRejectReason: string;
  timeline: PaymentTimeline | null;
  amountDueRupees: number | null;
  amountDuePaise: number | null;
  payerName: string;
  setPayerName: (v: string) => void;
  transactionId: string;
  setTransactionId: (v: string) => void;
  paidAt: string;
  setPaidAt: (v: string) => void;
  upiMsg: MsgState;
  razorpayMsg: MsgState;
  enrollStatus: "idle" | "paid" | "enrolling" | "enrolled" | "enroll_failed";
  enrolledLicenseKey: string | null;
  setEnrollStatus: (s: "idle" | "paid" | "enrolling" | "enrolled" | "enroll_failed") => void;
  setRazorpayMsg: (m: MsgState) => void;
  loading: boolean;
  handleUpiSubmit: (e: React.FormEvent) => void;
  openRazorpay: () => void;
}) {
  // null = nothing chosen yet (only when both are available)
  const [chosen, setChosen] = useState<"upi" | "razorpay" | null>(
    both ? null : showManualUpi ? "upi" : "razorpay"
  );

  return (
    <div className="mt-5 space-y-4">

      {/* ── Choose-a-method buttons (only when both are available) ── */}
      {both && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-black/50">How would you like to pay?</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Scan & Pay button */}
            <button
              type="button"
              onClick={() => setChosen(chosen === "upi" ? null : "upi")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition-all ${
                chosen === "upi"
                  ? "border-funt-teal bg-teal-50 text-teal-800 shadow-sm"
                  : "border-black/10 bg-white text-black/60 hover:border-black/20 hover:text-black/80"
              }`}
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>Scan &amp; Pay</span>
              <span className="text-[11px] font-normal text-black/40">UPI / QR code</span>
            </button>

            {/* Pay Online button */}
            <button
              type="button"
              onClick={() => setChosen(chosen === "razorpay" ? null : "razorpay")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition-all ${
                chosen === "razorpay"
                  ? "border-indigo-400 bg-indigo-50 text-indigo-800 shadow-sm"
                  : "border-black/10 bg-white text-black/60 hover:border-black/20 hover:text-black/80"
              }`}
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
              <span>Pay Online</span>
              <span className="text-[11px] font-normal text-black/40">Card / Net banking</span>
            </button>
          </div>
        </div>
      )}

      {/* ── UPI / Scan & Pay section ── */}
      {showManualUpi && chosen === "upi" && (
        <div className="space-y-4 rounded-xl border border-teal-100 bg-teal-50/40 p-4">
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
              <p className="mt-2 text-[11px] text-black/50">Use any UPI app to scan and pay.</p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-black/15 bg-white px-3 py-2 text-sm text-black/70">
              Your school has not uploaded a UPI QR yet. Ask them to add one in batch settings.
            </p>
          )}
          {checkout && checkout.enrollmentPriceInPaise > 0 && (
            <div className="rounded-lg bg-white px-4 py-3 text-center text-sm text-black shadow-sm">
              {(checkout.discountPaise ?? 0) > 0 ? (
                <>
                  <span className="text-black/50 line-through mr-2">₹{checkout.enrollmentPriceRupees.toFixed(2)}</span>
                  <span className="font-bold text-teal-700">₹{(checkout.finalPriceRupees ?? checkout.enrollmentPriceRupees).toFixed(2)}</span>
                  <span className="ml-2 text-xs text-black/50">after discount</span>
                </>
              ) : (
                <span className="font-bold">Amount due: ₹{checkout.enrollmentPriceRupees.toFixed(2)}</span>
              )}
            </div>
          )}
          {!checking && courseRejected ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-950">
              Previous payment was not approved.
              {courseRejectReason ? <span className="mt-1 block font-normal text-amber-900/90">Reason: {courseRejectReason}</span> : null}
            </div>
          ) : null}
          {timeline && (timeline.statusHistory?.length ?? 0) > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment review timeline</p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                {(timeline.statusHistory ?? []).slice().reverse().slice(0, 4).map((e, idx) => (
                  <li key={`${e.status}-${idx}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <span className="font-semibold">{e.status}</span> — {e.note ?? "Status updated"}
                    <span className="ml-1 text-slate-400">({new Date(e.at).toLocaleString()})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form onSubmit={handleUpiSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-funt-ink">
              Your name (as on UPI / bank)
              <input className="input mt-1.5" value={payerName} onChange={(e) => setPayerName(e.target.value)} required placeholder="Full name" />
            </label>
            <div className="block text-sm font-medium text-funt-ink">
              <span>Amount to pay (INR)</span>
              <p className="input mt-1.5 cursor-not-allowed bg-slate-100 font-semibold text-slate-900 tabular-nums">
                {amountDueRupees != null ? `₹${amountDueRupees.toFixed(2)}` : "—"}
              </p>
              <p className="mt-1 text-xs font-normal text-black/55">Pay exactly this amount, then submit your UTR below.</p>
            </div>
            <label className="block text-sm font-medium text-funt-ink">
              UPI / bank reference (UTR)
              <input className="input mt-1.5" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required placeholder="12-digit UTR or reference" />
            </label>
            <label className="block text-sm font-medium text-funt-ink">
              Date &amp; time paid
              <input type="datetime-local" className="input mt-1.5" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
            </label>
            {upiMsg && (
              <div className={`rounded-xl px-3 py-2 text-sm font-medium ${upiMsg.type === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>{upiMsg.text}</div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Submitting…" : "Submit payment details"}
            </button>
          </form>
        </div>
      )}

      {/* ── Razorpay section ── */}
      {showRazorpay && chosen === "razorpay" && (
        <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm text-black/75">
            Instant confirmation — your enrollment and license key are activated automatically after payment.
          </p>
          {checkout && checkout.enrollmentPriceInPaise > 0 && (
            <div className="rounded-lg bg-white px-4 py-3 text-center text-sm text-black shadow-sm">
              {(checkout.discountPaise ?? 0) > 0 ? (
                <>
                  <span className="text-black/50 line-through mr-2">₹{checkout.enrollmentPriceRupees.toFixed(2)}</span>
                  <span className="font-bold text-indigo-700">₹{(checkout.finalPriceRupees ?? checkout.enrollmentPriceRupees).toFixed(2)}</span>
                  <span className="ml-2 text-xs text-black/50">after discount</span>
                </>
              ) : (
                <span className="font-bold">You will be charged ₹{checkout.enrollmentPriceRupees.toFixed(2)}</span>
              )}
            </div>
          )}
          {razorpayMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${razorpayMsg.type === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
              {razorpayMsg.text}
            </div>
          )}
          {/* Step-by-step enrollment status */}
          {(enrollStatus === "paid" || enrollStatus === "enrolling" || enrollStatus === "enrolled" || enrollStatus === "enroll_failed") && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Enrollment Status</p>
              <div className="space-y-2">
                {/* Step 1: Payment */}
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                  <span className="text-sm font-medium text-emerald-700">Payment received by Razorpay</span>
                </div>
                {/* Step 2: Enrolling */}
                <div className="flex items-center gap-3">
                  {enrollStatus === "enrolling" ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    </span>
                  ) : enrollStatus === "enrolled" ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                  ) : enrollStatus === "enroll_failed" ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">✗</span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs">2</span>
                  )}
                  <span className={`text-sm font-medium ${enrollStatus === "enrolling" ? "text-indigo-700" : enrollStatus === "enrolled" ? "text-emerald-700" : enrollStatus === "enroll_failed" ? "text-red-700" : "text-slate-400"}`}>
                    {enrollStatus === "enrolling" ? "Activating course access..." : enrollStatus === "enrolled" ? "Course access activated!" : enrollStatus === "enroll_failed" ? "Enrollment failed — contact support" : "Activate course access"}
                  </span>
                </div>
                {/* Step 3: License key (if applicable) */}
                {enrollStatus === "enrolled" && enrolledLicenseKey && (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-700">Your license key</p>
                    <p className="mt-1 font-mono text-sm font-bold text-emerald-900">{enrolledLicenseKey}</p>
                  </div>
                )}
                {/* Redirect notice */}
                {enrollStatus === "enrolled" && (
                  <p className="text-xs text-slate-500">Redirecting to your course in a moment...</p>
                )}
                {/* Enroll failed: manual retry */}
                {enrollStatus === "enroll_failed" && (
                  <button
                    type="button"
                    onClick={() => { setEnrollStatus("idle"); setRazorpayMsg(null); }}
                    className="mt-2 text-xs font-semibold text-indigo-600 underline"
                  >
                    Try again / Contact support
                  </button>
                )}
              </div>
            </div>
          )}
          <button type="button" disabled={loading || enrollStatus === "enrolled" || enrollStatus === "enrolling"} onClick={openRazorpay} className="btn-primary w-full py-3 disabled:opacity-60">
            {loading || enrollStatus === "enrolling" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {enrollStatus === "enrolling" ? "Enrolling..." : "Processing..."}
              </span>
            ) : enrollStatus === "enrolled" ? "Enrolled ✓" : "Pay with Razorpay"}
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Ensure CSRF token is available before any POST — must be awaited
  useEffect(() => { void ensureCsrfToken(); }, []);
  const type = (searchParams.get("type") ?? "course").toLowerCase() === "shop" ? "shop" : "course";
  const batchId = searchParams.get("batchId") ?? "";
  const courseId = searchParams.get("courseId") ?? "";
  const productId = searchParams.get("productId") ?? "";
  const productName = searchParams.get("productName") ?? "";
  const milestoneId = searchParams.get("milestoneId") ?? "";

  const [enteredBatchId, setEnteredBatchId] = useState("");
  const [batchIdConfirmed, setBatchIdConfirmed] = useState(!!batchId);
  const effectiveBatchId = batchId || enteredBatchId.trim();

  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);

  const [payerName, setPayerName] = useState("");
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
  const [upiMsg, setUpiMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [razorpayMsg, setRazorpayMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<"idle" | "paid" | "enrolling" | "enrolled" | "enroll_failed">("idle");
  const [enrolledLicenseKey, setEnrolledLicenseKey] = useState<string | null>(null);
  const [razorpayOverlay, setRazorpayOverlay] = useState<"verifying" | "activating" | null>(null);
  const [accessBlockedByAdmin, setAccessBlockedByAdmin] = useState(false);
  const [timeline, setTimeline] = useState<PaymentTimeline | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const [lastTimelineCheckedAt, setLastTimelineCheckedAt] = useState("");

  const loadCheckout = useCallback(() => {
    if (type !== "course" || !effectiveBatchId || !courseId) return;
    setCheckoutErr(null);
    const qs = new URLSearchParams();
    qs.set("batchId", effectiveBatchId);
    if (appliedCoupon.trim()) qs.set("couponCode", appliedCoupon.trim());
    api<CheckoutInfo>(`/api/student/courses/${encodeURIComponent(courseId)}/checkout?${qs.toString()}`)
      .then((r) => {
        if (r.success && r.data) {
          setCheckout(r.data);
        } else setCheckoutErr(r.message ?? "Could not load checkout");
      })
      .catch(() => setCheckoutErr("Could not load checkout"));
  }, [type, effectiveBatchId, courseId, appliedCoupon]);

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
    if (type === "course" && effectiveBatchId && courseId) {
      qs.set("batchId", effectiveBatchId);
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

    if (type === "course" && effectiveBatchId && courseId) {
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
          `/api/student/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(effectiveBatchId)}`
        ),
        api<PaymentTimeline>(
          `/api/student/payments/timeline?kind=COURSE&batchId=${encodeURIComponent(effectiveBatchId)}&courseId=${encodeURIComponent(courseId)}`
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
        .catch(() => {
          // Ensure checking state is cleared even if Promise.all rejects unexpectedly
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
  }, [type, effectiveBatchId, courseId, productId]);

  useEffect(() => {
    if (!(type === "course" && effectiveBatchId && courseId && coursePending)) return;
    const t = window.setInterval(() => {
      api<PaymentTimeline>(
        `/api/student/payments/timeline?kind=COURSE&batchId=${encodeURIComponent(effectiveBatchId)}&courseId=${encodeURIComponent(courseId)}`
      ).then((r) => {
        setTimeline(r.success ? (r.data ?? null) : null);
        setLastTimelineCheckedAt(new Date().toLocaleTimeString());
      });
    }, 15000);
    return () => window.clearInterval(t);
  }, [type, effectiveBatchId, courseId, coursePending]);

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
    setUpiMsg(null);
    setLoading(true);
    const parsedPaidAt = new Date(paidAt);
    if (Number.isNaN(parsedPaidAt.getTime())) {
      setUpiMsg({ type: "err", text: "Enter a valid payment date and time." });
      setLoading(false);
      return;
    }
    const body: Record<string, string | number> = {
      kind: type === "shop" ? "SHOP" : "COURSE",
      transactionId: transactionId.trim(),
      paidAt: parsedPaidAt.toISOString(),
    };
    if (type === "course") {
      if (amountDuePaise == null || !Number.isFinite(amountDuePaise) || amountDuePaise < 0) {
        setUpiMsg({ type: "err", text: "Could not determine amount due. Refresh the page and try again." });
        setLoading(false);
        return;
      }
      body.amountPaise = Math.floor(amountDuePaise);
      body.payerName = payerName.trim();
      body.batchId = effectiveBatchId;
      body.courseId = courseId;
      if (appliedCoupon.trim()) body.couponCode = appliedCoupon.trim();
      if (milestoneId.trim()) body.milestoneId = milestoneId.trim();
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
      const okText = res.message ?? "Submitted. An administrator will verify your payment and link your license.";
      setUpiMsg({ type: "ok", text: okText });
      if (type === "course" && courseId) {
        window.setTimeout(() => {
          router.push(`/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(effectiveBatchId)}`);
        }, 2800);
      } else if (type === "shop") {
        window.setTimeout(() => router.push("/shop"), 2000);
      }
    } else {
      setUpiMsg({ type: "err", text: res.message ?? "Could not submit." });
    }
  }

  const amountDuePaise =
    checkout != null ? (checkout.finalPriceInPaise ?? checkout.enrollmentPriceInPaise) : null;
  const amountDueRupees =
    checkout != null
      ? Number((checkout.finalPriceRupees ?? checkout.enrollmentPriceRupees).toFixed(2))
      : null;

  const showManualUpi = !!(checkout && checkout.enrollmentPriceInPaise >= 100 && checkout.allowUpiManual);
  const showRazorpay = !!(checkout?.razorpayEnabled);

  async function openRazorpay() {
    setRazorpayMsg(null);
    if (!effectiveBatchId || !courseId) return;
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
          batchId: effectiveBatchId,
          courseId,
          ...(appliedCoupon.trim() ? { couponCode: appliedCoupon.trim() } : {}),
          ...(milestoneId.trim() ? { milestoneId: milestoneId.trim() } : {}),
        }),
      });
      if (!orderRes.success || !orderRes.data) {
        setRazorpayMsg({ type: "err", text: orderRes.message ?? "Could not start checkout." });
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
          // Step 1: Payment captured by Razorpay — show verifying overlay
          setRazorpayOverlay("verifying");
          setEnrollStatus("paid");
          setRazorpayMsg({ type: "ok", text: "✓ Payment received. Enrolling you in the course..." });
          setLoading(true);

          // Step 2: Confirm with backend and enroll
          setEnrollStatus("enrolling");
          const confirm = await api<{ assignedLicenseKey?: string }>("/api/student/payments/razorpay/confirm", {
            method: "POST",
            body: JSON.stringify({
              batchId: effectiveBatchId,
              courseId,
              ...(appliedCoupon.trim() ? { couponCode: appliedCoupon.trim() } : {}),
              ...(milestoneId.trim() ? { milestoneId: milestoneId.trim() } : {}),
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          setLoading(false);

          if (confirm.success) {
            // Step 3: Enrolled successfully — show activating overlay
            setRazorpayOverlay("activating");
            setEnrollStatus("enrolled");
            const licenseKey = confirm.data?.assignedLicenseKey ?? null;
            setEnrolledLicenseKey(licenseKey);
            setRazorpayMsg({
              type: "ok",
              text: licenseKey
                ? `✓ Enrolled! Your license key: ${licenseKey}`
                : "✓ Payment successful. You are enrolled!",
            });
            window.setTimeout(() => {
              setRazorpayOverlay(null);
              router.push(`/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(effectiveBatchId)}`);
            }, 3000);
          } else {
            // Step 3 failed: payment went through but enrollment failed
            setRazorpayOverlay(null);
            setEnrollStatus("enroll_failed");
            setRazorpayMsg({
              type: "err",
              text: `Payment was received but enrollment failed: ${confirm.message ?? "Unknown error"}. Contact support with your payment ID: ${resp.razorpay_payment_id}`,
            });
          }
        },
      };
      new Razorpay(opts).open();
      setLoading(false);
    } catch (err) {
      setRazorpayMsg({ type: "err", text: err instanceof Error ? err.message : "Checkout failed." });
      setLoading(false);
    }
  }

  const waiting = (type === "course" && coursePending) || (type === "shop" && shopPending);

  if (type === "course" && !effectiveBatchId && !batchIdConfirmed && courseId) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-funt-gold/30 bg-gradient-to-br from-white via-funt-butter/60 to-funt-honey/20 p-8 shadow-lg">
        <h2 className="text-lg font-semibold text-funt-ink">Enter Batch ID (Optional)</h2>
        <p className="mt-2 text-sm text-black/60">
          If your trainer or franchise gave you a Batch ID, enter it below. Otherwise skip to continue as an online student.
        </p>
        <div className="mt-4">
          <input
            type="text"
            value={enteredBatchId}
            onChange={(e) => setEnteredBatchId(e.target.value.toUpperCase())}
            className="input w-full font-mono"
            placeholder="e.g. BT-000001"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setBatchIdConfirmed(true)}
            disabled={!enteredBatchId.trim()}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
          >
            Continue with Batch ID
          </button>
          <button
            type="button"
            onClick={() => { setEnteredBatchId(""); setBatchIdConfirmed(true); }}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Skip — I'm an online student
          </button>
        </div>
      </div>
    );
  }

  if (type === "course" && !effectiveBatchId && !courseId) {
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
          href={`/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(effectiveBatchId)}`}
          className="text-sm font-medium text-funt-gold-deep hover:underline"
        >
          Course
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
      {/* Razorpay payment verification overlay */}
      {razorpayOverlay && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
              {razorpayOverlay === "verifying" ? (
                <svg className="h-7 w-7 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {razorpayOverlay === "verifying" ? "Verifying Payment" : "Payment Verified!"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {razorpayOverlay === "verifying"
                ? "Don\u2019t go back or close \u2014 your payment is being verified."
                : "Payment verified. Activating your course..."}
            </p>
            {razorpayOverlay === "verifying" && (
              <p className="mt-3 text-xs font-medium text-amber-700">Please wait, this may take a few seconds.</p>
            )}
          </div>
        </div>
      )}

      <Link
        href={type === "shop" ? "/shop" : `/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(effectiveBatchId)}`}
        className="text-sm font-medium text-funt-gold-deep hover:underline"
      >
        Back
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

        {checking && !checkout ? (
          <div className="mt-8 flex justify-center py-6">
            <div className="spinner" />
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
            {checkout && checkout.enrollmentPriceInPaise < 100 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Enrollment price not configured</p>
                <p className="mt-1 text-amber-800">
                  The fee for this course has not been set by admin yet. Please contact your school or trainer to get access via license key, or wait for the price to be configured.
                </p>
              </div>
            )}
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

            {showManualUpi || showRazorpay ? (
              (() => {
                const both = showManualUpi && showRazorpay;
                return (
                  <PaymentMethodTabs
                    showManualUpi={showManualUpi}
                    showRazorpay={showRazorpay}
                    both={both}
                    checkout={checkout}
                    qrSecondsLeft={qrSecondsLeft}
                    checking={checking}
                    courseRejected={courseRejected}
                    courseRejectReason={courseRejectReason}
                    timeline={timeline}
                    amountDueRupees={amountDueRupees}
                    amountDuePaise={amountDuePaise}
                    payerName={payerName}
                    setPayerName={setPayerName}
                    transactionId={transactionId}
                    setTransactionId={setTransactionId}
                    paidAt={paidAt}
                    setPaidAt={setPaidAt}
                    upiMsg={upiMsg}
                    razorpayMsg={razorpayMsg}
                    enrollStatus={enrollStatus}
                    enrolledLicenseKey={enrolledLicenseKey}
                    setEnrollStatus={setEnrollStatus}
                    setRazorpayMsg={setRazorpayMsg}
                    loading={loading}
                    handleUpiSubmit={handleUpiSubmit}
                    openRazorpay={() => void openRazorpay()}
                  />
                );
              })()
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
            {upiMsg && (
              <div
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  upiMsg.type === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"
                }`}
              >
                {upiMsg.text}
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
          <div className="spinner" />
        </div>
      }
    >
      <PaymentForm />
    </Suspense>
  );
}
