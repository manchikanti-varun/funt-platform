"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function PaymentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = (searchParams.get("type") ?? "course").toLowerCase() === "shop" ? "shop" : "course";
  const batchId = searchParams.get("batchId") ?? "";
  const courseId = searchParams.get("courseId") ?? "";
  const productId = searchParams.get("productId") ?? "";
  const productName = searchParams.get("productName") ?? "";

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

  useEffect(() => {
    const qs = new URLSearchParams();
    if (type === "course" && batchId && courseId) {
      qs.set("batchId", batchId);
      qs.set("courseId", courseId);
    }
    if (type === "shop" && productId) qs.set("productId", productId);
    setChecking(true);
    api<{
      coursePending: boolean;
      shopPending: boolean;
      courseRejected?: boolean;
      shopRejected?: boolean;
      courseRejectReason?: string;
      shopRejectReason?: string;
    }>(`/api/student/payments/pending?${qs.toString()}`)
      .then((r) => {
        if (r.success && r.data) {
          setCoursePending(!!r.data.coursePending);
          setShopPending(!!r.data.shopPending);
          setCourseRejected(!!r.data.courseRejected);
          setShopRejected(!!r.data.shopRejected);
          setCourseRejectReason(r.data.courseRejectReason?.trim() ?? "");
          setShopRejectReason(r.data.shopRejectReason?.trim() ?? "");
        }
      })
      .finally(() => setChecking(false));
  }, [type, batchId, courseId, productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const body: Record<string, string> = {
      kind: type === "shop" ? "SHOP" : "COURSE",
      transactionId: transactionId.trim(),
      paidAt: new Date(paidAt).toISOString(),
    };
    if (type === "course") {
      body.batchId = batchId;
      body.courseId = courseId;
    } else {
      body.productId = productId;
    }
    const res = await api("/api/student/payments", { method: "POST", body: JSON.stringify(body) });
    setLoading(false);
    if (res.success) {
      setMsg({ type: "ok", text: res.message ?? "Submitted." });
      if (type === "course" && courseId) {
        router.push(`/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}`);
      } else if (type === "shop") {
        router.push("/shop");
      }
    } else {
      setMsg({ type: "err", text: res.message ?? "Could not submit." });
    }
  }

  const waiting =
    (type === "course" && coursePending) || (type === "shop" && shopPending);

  if (type === "course" && (!batchId || !courseId)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-lg">
        <p className="font-medium text-funt-ink">Missing course details.</p>
        <p className="mt-2 text-sm text-black/60">Open a course from the catalog and use the payment link from there.</p>
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

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link href={type === "shop" ? "/shop" : `/courses/${encodeURIComponent(courseId)}?batchId=${encodeURIComponent(batchId)}`} className="text-sm font-medium text-funt-gold-deep hover:underline">
        ← Back
      </Link>
      <div className="mt-4 rounded-3xl border border-funt-gold/40 bg-gradient-to-br from-white via-funt-butter to-funt-honey/40 p-8 shadow-lg ring-1 ring-funt-gold/25">
        <h1 className="text-xl font-bold text-funt-ink">
          {type === "course" ? "Course payment" : "Shop payment"}
        </h1>
        <p className="mt-2 text-sm text-black/65">
          {type === "course"
            ? "Submit your payment reference so an administrator can verify and start your course access."
            : `Submit payment proof for ${productName ? `“${decodeURIComponent(productName)}”` : "this item"}. After approval, it will appear in your orders.`}
        </p>

        {checking ? (
          <div className="mt-8 flex justify-center py-6">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-funt-gold/30 border-t-funt-gold-deep" />
          </div>
        ) : waiting ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-4 text-sm font-medium text-emerald-900">
            Payment received — waiting for admin approval. You will get access once it is verified.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!checking &&
            ((type === "course" && courseRejected) || (type === "shop" && shopRejected)) ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-950">
                Your previous payment was not approved.
                {type === "course" && courseRejectReason ? (
                  <span className="mt-1 block font-normal text-amber-900/90">Reason: {courseRejectReason}</span>
                ) : null}
                {type === "shop" && shopRejectReason ? (
                  <span className="mt-1 block font-normal text-amber-900/90">Reason: {shopRejectReason}</span>
                ) : null}
                <span className="mt-2 block font-normal text-amber-900/85">Submit new transaction details below.</span>
              </div>
            ) : null}
            <label className="block text-sm font-medium text-funt-ink">
              Transaction / reference ID
              <input
                className="input mt-1.5"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                required
                placeholder="UPI ref, bank ref, receipt no."
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
      </div>
    </div>
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
