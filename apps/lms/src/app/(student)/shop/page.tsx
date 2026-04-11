"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Product {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  imageUrl: string;
  inStock: boolean;
  shopShelf?: string;
}

interface OrderRow {
  id: string;
  productName: string;
  coinsSpent: number;
  source?: string;
  couponCode?: string;
  createdAt: string;
}

type Shelf = "KITS" | "COMPONENTS";

function ShopInner() {
  const searchParams = useSearchParams();
  const shelfParam = searchParams.get("shelf");
  const shelf: Shelf = shelfParam === "COMPONENTS" ? "COMPONENTS" : "KITS";

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [couponByProduct, setCouponByProduct] = useState<Record<string, string>>({});
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseMsg, setPurchaseMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    const q = shelf === "COMPONENTS" ? "?shelf=COMPONENTS" : "?shelf=KITS";
    Promise.all([
      api<Product[]>(`/api/shop/products${q}`),
      api<OrderRow[]>("/api/shop/orders"),
      api<{ funtCoins?: number }>("/api/users/me"),
    ])
      .then(([pRes, oRes, meRes]) => {
        if (pRes.success && Array.isArray(pRes.data)) setProducts(pRes.data);
        else setProducts([]);
        if (oRes.success && Array.isArray(oRes.data)) setOrders(oRes.data);
        else setOrders([]);
        if (meRes.success && meRes.data) setBalance(meRes.data.funtCoins ?? 0);
      })
      .finally(() => setLoading(false));
  }, [shelf]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function buyWithCoins(p: Product) {
    setPurchaseMsg(null);
    setPurchasingId(p.id);
    const coupon = couponByProduct[p.id]?.trim();
    const res = await api<{ newBalance?: number }>("/api/shop/purchase", {
      method: "POST",
      body: JSON.stringify({
        productId: p.id,
        ...(coupon ? { couponCode: coupon } : {}),
      }),
    });
    setPurchasingId(null);
    if (res.success && res.data?.newBalance != null) {
      setBalance(res.data.newBalance);
      setPurchaseMsg(`Purchased “${p.name}” with coins.`);
      refresh();
    } else {
      setPurchaseMsg(res.message ?? "Could not complete purchase.");
    }
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6">
      <header className="relative overflow-hidden rounded-[2rem] border-2 border-black bg-white px-6 py-8 shadow-lg sm:px-10">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-funt-gold/25 blur-3xl" aria-hidden />
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-black">Store</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-black">Kits &amp; components</h1>
          <p className="mt-3 text-sm leading-relaxed text-black/65">
            Switch between <strong className="text-black">Kits</strong> and <strong className="text-black">Components</strong>. Pay with FUNT coins or submit payment proof for admin verification.
          </p>
        </div>
        <div className="relative z-10 mt-6 flex flex-wrap gap-2">
          <Link
            href="/shop?shelf=KITS"
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${shelf === "KITS" ? "bg-funt-gold text-black shadow-md" : "border-2 border-black/10 bg-white text-black hover:bg-funt-honey/50"}`}
          >
            1) Kits
          </Link>
          <Link
            href="/shop?shelf=COMPONENTS"
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${shelf === "COMPONENTS" ? "bg-funt-gold text-black shadow-md" : "border-2 border-black/10 bg-white text-black hover:bg-funt-honey/50"}`}
          >
            2) Components
          </Link>
        </div>
        {balance != null && (
          <div className="relative z-10 mt-6 inline-flex items-center gap-3 rounded-2xl border-2 border-black/10 bg-white px-5 py-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/50">Coin balance</span>
            <span className="text-2xl font-black tabular-nums text-black">{balance}</span>
          </div>
        )}
      </header>

      {purchaseMsg && (
        <div className="rounded-2xl border-2 border-black/10 bg-funt-honey/50 px-4 py-3 text-sm font-semibold text-black">{purchaseMsg}</div>
      )}

      <section>
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">{shelf === "KITS" ? "Kits" : "Components"}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 ? (
            <p className="col-span-full rounded-2xl border-2 border-dashed border-black/15 bg-white py-16 text-center text-sm text-black/50">
              No items in this shelf yet.
            </p>
          ) : (
            products.map((p) => (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border-2 border-black/10 bg-white shadow-md transition hover:-translate-y-1 hover:border-funt-gold hover:shadow-xl"
              >
                <div className="aspect-[4/3] bg-funt-honey">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl opacity-40">📦</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold text-black">{p.name}</h3>
                  {p.description && <p className="mt-2 line-clamp-3 text-sm text-black/60">{p.description}</p>}
                  <div className="mt-auto flex flex-col gap-3 border-t border-black/10 pt-4">
                    <p className="text-lg font-black tabular-nums text-funt-gold-deep">{p.priceCoins} coins</p>
                    {p.inStock ? (
                      <>
                        <label className="block text-xs font-bold uppercase tracking-wide text-black/50">
                          Coupon (optional)
                          <input
                            className="input mt-1 w-full text-sm font-normal normal-case"
                            value={couponByProduct[p.id] ?? ""}
                            onChange={(e) => setCouponByProduct((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Code from admin"
                            autoComplete="off"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={purchasingId === p.id}
                          onClick={() => buyWithCoins(p)}
                          className="rounded-xl border-2 border-black bg-white py-2.5 text-center text-sm font-bold text-black hover:bg-funt-honey/50"
                        >
                          {purchasingId === p.id ? "Processing…" : "Buy with coins"}
                        </button>
                        <Link
                          href={`/payment?type=shop&productId=${encodeURIComponent(p.id)}&productName=${encodeURIComponent(p.name)}`}
                          className="inline-flex items-center justify-center rounded-xl bg-funt-gold py-2.5 text-center text-sm font-bold text-black shadow-md hover:bg-funt-gold-hover"
                        >
                          Pay &amp; submit proof
                        </Link>
                      </>
                    ) : (
                      <span className="text-center text-sm font-semibold text-black/50">Out of stock</span>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {orders.length > 0 && (
        <section className="rounded-2xl border-2 border-black/10 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">Your orders</h2>
          <ul className="mt-4 divide-y divide-black/10">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-semibold text-black">{o.productName}</span>
                <span className="text-xs font-medium text-black/50">
                  {o.source === "PAYMENT" ? "Paid (verified)" : `${o.coinsSpent} coins${o.couponCode ? ` · ${o.couponCode}` : ""}`}
                </span>
                <span className="w-full text-xs text-black/45 sm:w-auto">{new Date(o.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
        </div>
      }
    >
      <ShopInner />
    </Suspense>
  );
}
