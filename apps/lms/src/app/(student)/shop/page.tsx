"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Coins, ShoppingCart, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { AppPageShell, PageSection } from "@/components/ui";

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
  items: Array<{ productName: string; quantity: number }>;
  coinsSpent: number;
  payablePaise?: number;
  status?: string;
  statusHistory?: Array<{ status: string; note?: string; at: string }>;
  source?: string;
  couponCode?: string;
  createdAt: string;
}

type Shelf = "KITS" | "COMPONENTS";

interface CoinGrantRow {
  id: string;
  amountOriginal: number;
  amountRemaining: number;
  grantedAt: string;
  expiresAt: string;
  source: string;
  sourceRef?: string;
}

function coinGrantSourceLabel(source: string): string {
  switch (source) {
    case "BATCH_COMPLETION":
      return "Programme completion";
    case "CERTIFICATE_GRANT":
      return "Certificate reward";
    case "ADMIN_ADJUST":
      return "Admin adjustment";
    case "LEGACY_SYNC":
      return "Balance sync";
    default:
      return source;
  }
}

function IconCoin() {
  return <Coins className="h-4 w-4" aria-hidden />;
}

function IconCart() {
  return <ShoppingCart className="h-4 w-4" aria-hidden />;
}

function IconTruck() {
  return <Truck className="h-4 w-4" aria-hidden />;
}

function ShopInner() {
  const searchParams = useSearchParams();
  const shelfParam = searchParams.get("shelf");
  const shelf: Shelf = shelfParam === "COMPONENTS" ? "COMPONENTS" : "KITS";

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [coinGrants, setCoinGrants] = useState<CoinGrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [couponCode, setCouponCode] = useState("");
  const [coinsToRedeem, setCoinsToRedeem] = useState("0");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [quote, setQuote] = useState<{
    items: Array<{ productId: string; productName: string; quantity: number; lineTotalCoins: number }>;
    subtotalCoins: number;
    couponDiscountCoins: number;
    couponCodeApplied?: string;
    totalCoinsAfterDiscount: number;
    coinsToRedeem: number;
    payableCoins: number;
    payablePaise: number;
    payableRupees: number;
    upiQrUrl?: string;
    upiPaymentLink?: string;
  } | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paidAt, setPaidAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
  });

  function cartItemsPayload() {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
  }
  const cartCount = Object.values(cart).reduce((acc, q) => acc + (q > 0 ? q : 0), 0);
  const cartValueCoins = products.reduce((acc, p) => acc + p.priceCoins * Math.max(0, cart[p.id] ?? 0), 0);

  const refresh = useCallback(() => {
    setLoading(true);
    const q = shelf === "COMPONENTS" ? "?shelf=COMPONENTS" : "?shelf=KITS";
    Promise.all([
      api<Product[]>(`/api/shop/products${q}`),
      api<OrderRow[]>("/api/shop/orders"),
      api<{ funtCoins?: number }>("/api/users/me"),
      api<CoinGrantRow[]>("/api/student/coin-grants"),
    ])
      .then(([pRes, oRes, meRes, grantsRes]) => {
        if (pRes.success && Array.isArray(pRes.data)) setProducts(pRes.data);
        else setProducts([]);
        if (oRes.success && Array.isArray(oRes.data)) setOrders(oRes.data);
        else setOrders([]);
        if (meRes.success && meRes.data) setBalance(meRes.data.funtCoins ?? 0);
        if (grantsRes.success && Array.isArray(grantsRes.data)) setCoinGrants(grantsRes.data);
        else setCoinGrants([]);
      })
      .finally(() => setLoading(false));
  }, [shelf]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function loadQuote() {
    setQuoteLoading(true);
    setMsg(null);
    const res = await api<{
      items: Array<{ productId: string; productName: string; quantity: number; lineTotalCoins: number }>;
      subtotalCoins: number;
      couponDiscountCoins: number;
      couponCodeApplied?: string;
      totalCoinsAfterDiscount: number;
      coinsToRedeem: number;
      payableCoins: number;
      payablePaise: number;
      payableRupees: number;
      upiQrUrl?: string;
      upiPaymentLink?: string;
    }>("/api/shop/checkout/quote", {
      method: "POST",
      body: JSON.stringify({
        items: cartItemsPayload(),
        couponCode: couponCode.trim() || undefined,
        coinsToRedeem: Math.max(0, Math.floor(Number(coinsToRedeem || "0"))),
      }),
    });
    setQuoteLoading(false);
    if (res.success && res.data) setQuote(res.data);
    else setMsg(res.message ?? "Could not prepare checkout.");
  }

  async function submitCheckout() {
    setCheckoutLoading(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      items: cartItemsPayload(),
      couponCode: couponCode.trim() || undefined,
      coinsToRedeem: Math.max(0, Math.floor(Number(coinsToRedeem || "0"))),
      address,
    };
    if ((quote?.payablePaise ?? 0) > 0) {
      payload.transactionId = transactionId.trim();
      payload.payerName = payerName.trim();
      payload.paidAt = new Date(paidAt).toISOString();
    }
    const res = await api<{ orderId?: string; message?: string }>("/api/shop/checkout/submit", {
      method: "POST",
      headers: {
        "x-idempotency-key": typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `idem-${Date.now()}`,
        "x-device-id": "shop-web",
      },
      body: JSON.stringify(payload),
    });
    setCheckoutLoading(false);
    if (res.success) {
      setMsg(res.message ?? "Checkout submitted.");
      setCart({});
      setQuote(null);
      setTransactionId("");
      refresh();
      return;
    }
    setMsg(res.message ?? "Checkout failed.");
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <AppPageShell className="max-w-6xl gap-10">
      <header className="page-hero py-8">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-funt-gold-deep">Store</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-black">Kits &amp; Components</h1>
          <p className="mt-3 text-sm leading-relaxed text-black/65">
            Premium robotics accessories with smart checkout, coupons, coin redemption, and delivery tracking.
          </p>
        </div>
        <div className="relative z-10 mt-6 flex flex-wrap gap-2">
          <Link
            href="/shop?shelf=KITS"
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              shelf === "KITS"
                ? "btn-primary shadow-md"
                : "border border-indigo-200 bg-white/90 text-black hover:bg-indigo-50"
            }`}
          >
            Kits
          </Link>
          <Link
            href="/shop?shelf=COMPONENTS"
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              shelf === "COMPONENTS"
                ? "btn-primary shadow-md"
                : "border border-indigo-200 bg-white/90 text-black hover:bg-indigo-50"
            }`}
          >
            Components
          </Link>
        </div>
        {balance != null && (
          <div className="relative z-10 mt-6 inline-flex items-center gap-3 rounded-2xl border border-indigo-200 bg-white px-5 py-3 shadow-sm">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-black/50"><IconCoin />Coin balance</span>
            <span className="text-2xl font-black tabular-nums text-black">{balance}</span>
          </div>
        )}
      </header>

      {msg && <div className="rounded-2xl border-2 border-black/10 bg-indigo-50/50 px-4 py-3 text-sm font-semibold text-black">{msg}</div>}

      <PageSection className="border border-indigo-200 bg-gradient-to-b from-white to-indigo-50/40">
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
                className="group flex flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-b from-white to-indigo-50/40 shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-indigo-50 to-slate-100">
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
                    <p className="inline-flex items-center gap-2 text-lg font-black tabular-nums text-indigo-700"><IconCoin />{p.priceCoins} coins</p>
                    {p.inStock ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-black/15 px-2 py-1 text-sm transition hover:bg-black/5"
                            onClick={() => setCart((prev) => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] ?? 0) - 1) }))}
                          >
                            -
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold">{cart[p.id] ?? 0}</span>
                          <button
                            type="button"
                            className="rounded-lg border border-black/15 px-2 py-1 text-sm transition hover:bg-black/5"
                            onClick={() => setCart((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }))}
                          >
                            +
                          </button>
                          {(cart[p.id] ?? 0) > 0 ? <span className="ml-auto rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">In cart</span> : null}
                        </div>
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
      </PageSection>

      <PageSection className="border border-indigo-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-black"><IconCart />Cart & checkout</h2>
          <span className="rounded-full border border-black/10 bg-indigo-50 px-3 py-1 text-xs font-semibold text-black/80">
            {cartCount} item(s) · {cartValueCoins} coins
          </span>
        </div>
        <p className="mt-1 text-sm text-black/60">Apply coupon, redeem FUNT coins (4 coins = ₹1), then pay remaining via UPI QR and submit proof.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input className="input" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
          <input className="input" placeholder="Coins to redeem" type="number" min={0} value={coinsToRedeem} onChange={(e) => setCoinsToRedeem(e.target.value)} />
          <button className="btn-primary" type="button" disabled={quoteLoading || cartItemsPayload().length === 0} onClick={() => void loadQuote()}>
            {quoteLoading ? "Calculating..." : "Calculate total"}
          </button>
        </div>
        {quote && (
          <div className="mt-4 space-y-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="grid gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 sm:grid-cols-2">
              <p className="text-sm font-semibold">Subtotal: {quote.subtotalCoins} coins</p>
              <p className="text-sm font-semibold">Coupon discount: -{quote.couponDiscountCoins} coins</p>
              <p className="text-sm font-semibold">Coins redeemed: -{quote.coinsToRedeem} coins</p>
              <p className="text-base font-bold">Payable: {quote.payableCoins} coins (₹{quote.payableRupees.toFixed(2)})</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-black/55">Order lines</p>
              <ul className="mt-2 space-y-1 text-sm text-black/75">
                {quote.items.map((it) => (
                  <li key={it.productId} className="flex justify-between gap-2">
                    <span>{it.productName} x{it.quantity}</span>
                    <span className="font-semibold">{it.lineTotalCoins} coins</span>
                  </li>
                ))}
              </ul>
            </div>
            {(quote.payablePaise ?? 0) > 0 ? (
              <>
                {quote.upiQrUrl ? <img src={quote.upiQrUrl} alt="UPI QR" className="max-h-56 w-auto rounded-lg border border-black/10" /> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="input" placeholder="Payer name" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
                  <input className="input" placeholder="UTR / transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
                  <input className="input sm:col-span-2" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
              </>
            ) : (
              <p className="text-sm text-emerald-700">No rupee payment needed. This order will be confirmed using coins only.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" placeholder="Full name" value={address.fullName} onChange={(e) => setAddress((p) => ({ ...p, fullName: e.target.value }))} />
              <input className="input" placeholder="Phone" value={address.phone} onChange={(e) => setAddress((p) => ({ ...p, phone: e.target.value }))} />
              <input className="input sm:col-span-2" placeholder="Address line 1" value={address.line1} onChange={(e) => setAddress((p) => ({ ...p, line1: e.target.value }))} />
              <input className="input sm:col-span-2" placeholder="Address line 2 (optional)" value={address.line2} onChange={(e) => setAddress((p) => ({ ...p, line2: e.target.value }))} />
              <input className="input" placeholder="City" value={address.city} onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))} />
              <input className="input" placeholder="State" value={address.state} onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))} />
              <input className="input sm:col-span-2" placeholder="Postal code" value={address.postalCode} onChange={(e) => setAddress((p) => ({ ...p, postalCode: e.target.value }))} />
            </div>
            <button className="btn-primary w-full" type="button" disabled={checkoutLoading} onClick={() => void submitCheckout()}>
              {checkoutLoading ? "Submitting..." : "Submit checkout"}
            </button>
          </div>
        )}
      </PageSection>

      {coinGrants.length > 0 && (
        <PageSection className="border border-indigo-200 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black">Coin credits</h2>
          <p className="mt-1 text-sm text-black/55">Grants and rewards that added coins to your wallet (remaining may decrease as you spend or as tranches expire).</p>
          <ul className="mt-4 divide-y divide-black/10">
            {coinGrants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-black">{coinGrantSourceLabel(g.source)}</p>
                  {g.sourceRef ? <p className="mt-0.5 font-mono text-[11px] text-black/45">{g.sourceRef}</p> : null}
                </div>
                <span className="font-black tabular-nums text-indigo-700">+{g.amountOriginal}</span>
                <span className="w-full text-xs text-black/45 sm:w-auto">
                  {new Date(g.grantedAt).toLocaleString()} · {g.amountRemaining} left · expires {new Date(g.expiresAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {orders.length > 0 && (
        <PageSection className="border border-indigo-200 bg-gradient-to-b from-white to-indigo-50/40 p-6 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-black"><IconTruck />Your orders</h2>
          <ul className="mt-4 divide-y divide-black/10">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-semibold text-black">{(o.items ?? []).map((it) => it.productName).join(", ") || "Order"}</span>
                <span className="text-xs font-medium text-black/50">
                  {(o.items ?? []).map((it) => `${it.productName} x${it.quantity}`).join(", ")}
                </span>
                <span className="rounded-full bg-black px-2 py-1 text-xs font-medium text-white">
                  {o.status ?? "CONFIRMED"} · {o.coinsSpent} coins · ₹{(((o.payablePaise ?? 0) / 100)).toFixed(2)}
                </span>
                <span className="w-full text-xs text-black/45 sm:w-auto">{new Date(o.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </AppPageShell>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="spinner" />
        </div>
      }
    >
      <ShopInner />
    </Suspense>
  );
}
