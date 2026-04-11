"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface CouponRow {
  id: string;
  code: string;
  kind: "COURSE" | "SHOP";
  batchId: string;
  courseId: string;
  productId: string;
  discountType: "PERCENT" | "FIXED_COINS";
  discountValue: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  perStudentLimit: number;
  validFrom?: string;
  validUntil?: string;
  active: boolean;
  notes: string;
}

interface ProductOpt {
  id: string;
  name: string;
}

export default function AdminCouponsPage() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"COURSE" | "SHOP">("SHOP");
  const [batchId, setBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [productId, setProductId] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED_COINS">("PERCENT");
  const [discountValue, setDiscountValue] = useState(10);
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [perStudentLimit, setPerStudentLimit] = useState(1);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<CouponRow[]>("/api/admin/coupons"),
      api<ProductOpt[]>("/api/admin/shop/products"),
    ])
      .then(([cRes, pRes]) => {
        if (cRes.success && Array.isArray(cRes.data)) setRows(cRes.data);
        else setRows([]);
        if (pRes.success && Array.isArray(pRes.data)) setProducts(pRes.data.filter((p) => p.id));
        else setProducts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await api("/api/admin/coupons", {
      method: "POST",
      body: JSON.stringify({
        code,
        kind,
        batchId: kind === "COURSE" ? batchId.trim() : undefined,
        courseId: kind === "COURSE" ? courseId.trim() : undefined,
        productId: kind === "SHOP" ? productId : undefined,
        discountType,
        discountValue: Number(discountValue),
        maxRedemptions: maxRedemptions.trim() === "" ? null : Number(maxRedemptions),
        perStudentLimit: Number(perStudentLimit) || 1,
        validUntil: validUntil.trim() ? new Date(validUntil).toISOString() : undefined,
        notes: notes.trim() || undefined,
      }),
    });
    if (res.success) {
      setMsg("Coupon created.");
      setCode("");
      setNotes("");
      load();
    } else setMsg(res.message ?? "Failed");
  }

  async function toggleActive(row: CouponRow) {
    setActingId(row.id);
    setMsg(null);
    const res = await api(`/api/admin/coupons/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !row.active }),
    });
    setActingId(null);
    if (res.success) load();
    else setMsg(res.message ?? "Failed");
  }

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Coupons</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create codes for shop items (coin checkout) or for a specific batch + course (certificate coin fee). Students enter the code when they pay with coins or generate a certificate.
        </p>
      </div>

      {msg && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{msg}</div>}

      <form onSubmit={createCoupon} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">New coupon</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Code</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Applies to</span>
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as "COURSE" | "SHOP")}>
              <option value="SHOP">Shop product (coin purchase)</option>
              <option value="COURSE">Course certificate fee (batch + course)</option>
            </select>
          </label>
        </div>
        {kind === "SHOP" ? (
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Product</span>
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Batch ID (Mongo _id)</span>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="64abc..." required />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Course ID (snapshot courseId)</span>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs" value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
            </label>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Discount type</span>
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED_COINS")}>
              <option value="PERCENT">Percent off coin price</option>
              <option value="FIXED_COINS">Fixed coins off</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">{discountType === "PERCENT" ? "Percent (1–100)" : "Coins to subtract"}</span>
            <input type="number" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} min={1} required />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Max uses (empty = unlimited)</span>
            <input type="number" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} min={1} placeholder="∞" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Uses per student</span>
            <input type="number" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={perStudentLimit} onChange={(e) => setPerStudentLimit(Number(e.target.value))} min={1} required />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Valid until (optional)</span>
            <input type="datetime-local" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Internal notes</span>
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Create coupon
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-700">Code</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Kind</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Target</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Discount</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Uses</th>
              <th className="px-4 py-3 font-semibold text-slate-700 w-28">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{r.code}</td>
                <td className="px-4 py-3 text-slate-600">{r.kind}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {r.kind === "SHOP" ? r.productId : `${r.batchId.slice(0, 8)}… / ${r.courseId}`}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {r.discountType === "PERCENT" ? `${r.discountValue}%` : `${r.discountValue} coins`}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {r.redemptionCount}
                  {r.maxRedemptions != null ? ` / ${r.maxRedemptions}` : ""}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => toggleActive(r)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${r.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                  >
                    {r.active ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No coupons yet.</p>}
      </div>
    </div>
  );
}
