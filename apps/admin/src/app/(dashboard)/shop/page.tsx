"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { DeleteIconButton } from "@/components/ui/actionIconButtons";
import { AppPageShell, DataPanel, FormPanel, PageSection, useAppDialog } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

interface ProductRow {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  imageUrl: string;
  active: boolean;
  stock: number | null;
  sortOrder: number;
  shopShelf?: "KITS" | "COMPONENTS";
}

interface ShopOrderRow {
  id: string;
  studentId: string;
  items: Array<{ productName: string; quantity: number }>;
  address?: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  } | null;
  totalCoins: number;
  coinsRedeemed: number;
  payablePaise: number;
  status: "CONFIRMED" | "PACKED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "ISSUE" | "CANCELLED";
  statusReason?: string;
  statusHistory?: Array<{ status: string; note?: string; at?: string }>;
  createdAt: string;
}

interface ShopStockInsights {
  lowStockProducts: Array<{
    productId: string;
    productName: string;
    stockNow: number | null;
    shopShelf?: "KITS" | "COMPONENTS" | string;
  }>;
  reservedByProduct: Array<{
    productId: string;
    productName: string;
    reservedQty: number;
    stockNow: number | null;
    shopShelf?: "KITS" | "COMPONENTS" | string;
  }>;
  reservedTotalQty: number;
}

export default function AdminShopPage() {
  const dialog = useAppDialog();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<ShopOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ShopOrderRow | null>(null);
  const [statusReasonByOrder, setStatusReasonByOrder] = useState<Record<string, string>>({});
  const [statusNoteByOrder, setStatusNoteByOrder] = useState<Record<string, string>>({});
  const [stockByProduct, setStockByProduct] = useState<Record<string, string>>({});
  const [stockInsights, setStockInsights] = useState<ShopStockInsights | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    priceCoins: "100",
    imageUrl: "",
    active: true,
    stock: "",
    sortOrder: "0",
    shopShelf: "KITS" as "KITS" | "COMPONENTS",
  });

  const load = useCallback(() => {
    setLoading(true);
    api<ProductRow[]>("/api/admin/shop/products")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setProducts(r.data);
        else setProducts([]);
        if (r.success && Array.isArray(r.data)) {
          const next: Record<string, string> = {};
          for (const p of r.data) next[p.id] = p.stock == null ? "" : String(p.stock);
          setStockByProduct(next);
        }
      });
    api<ShopOrderRow[]>("/api/admin/shop/orders")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setOrders(r.data);
        else setOrders([]);
      });
    api<ShopStockInsights>("/api/admin/shop/stock-insights")
      .then((r) => {
        if (r.success && r.data) setStockInsights(r.data);
        else setStockInsights(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () =>
    setForm({
      name: "",
      description: "",
      priceCoins: "100",
      imageUrl: "",
      active: true,
      stock: "",
      sortOrder: String(products.length),
      shopShelf: "KITS",
    });

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      priceCoins: Number(form.priceCoins) || 0,
      imageUrl: form.imageUrl.trim(),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      shopShelf: form.shopShelf,
    };
    if (form.stock.trim() === "") body.stock = null;
    else body.stock = Math.max(0, Number(form.stock) || 0);

    const res = await api("/api/admin/shop/products", { method: "POST", body: JSON.stringify(body) });
    setSaving(false);
    if (res.success) {
      setMessage({ type: "ok", text: "Product created." });
      resetForm();
      load();
    } else setMessage({ type: "err", text: res.message ?? "Failed" });
  };

  const toggleActive = async (p: ProductRow) => {
    const res = await api(`/api/admin/shop/products/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !p.active }),
    });
    if (res.success) load();
    else setMessage({ type: "err", text: res.message ?? "Update failed" });
  };

  const remove = async (p: ProductRow) => {
    const ok = await dialog.confirm({
      title: "Delete product",
      message: `Delete “${p.name}”?`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const res = await api(`/api/admin/shop/products/${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (res.success) {
      setMessage({ type: "ok", text: "Deleted." });
      load();
    } else setMessage({ type: "err", text: res.message ?? "Delete failed" });
  };

  function statusLabel(status: ShopOrderRow["status"]): string {
    if (status === "OUT_FOR_DELIVERY") return "Out for delivery";
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  function downloadOrderDetails(order: ShopOrderRow) {
    const lines = [
      `Order ID: ${order.id}`,
      `Student ID: ${order.studentId}`,
      `Created At: ${new Date(order.createdAt).toLocaleString()}`,
      `Status: ${statusLabel(order.status)}`,
      "",
      "Items:",
      ...(order.items ?? []).map((it) => `- ${it.productName} x${it.quantity}`),
      "",
      `Total Coins: ${order.totalCoins}`,
      `Coins Redeemed: ${order.coinsRedeemed}`,
      `Payable INR: ${(order.payablePaise / 100).toFixed(2)}`,
      "",
      "Shipping Address:",
      `Name: ${order.address?.fullName ?? ""}`,
      `Phone: ${order.address?.phone ?? ""}`,
      `Line 1: ${order.address?.line1 ?? ""}`,
      `Line 2: ${order.address?.line2 ?? ""}`,
      `City: ${order.address?.city ?? ""}`,
      `State: ${order.address?.state ?? ""}`,
      `Postal Code: ${order.address?.postalCode ?? ""}`,
      "",
      "Status Notes:",
      ...((order.statusHistory ?? []).map((h) => `- [${h.status}] ${h.note ?? ""} (${h.at ? new Date(h.at).toLocaleString() : ""})`)),
      "",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shop-order-${order.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printSticker(order: ShopOrderRow) {
    const w = window.open("", "_blank", "width=720,height=920");
    if (!w) return;
    const addr = order.address;
    const addressBlock = [addr?.line1 ?? "", addr?.line2 ?? "", `${addr?.city ?? ""}, ${addr?.state ?? ""} ${addr?.postalCode ?? ""}`]
      .filter(Boolean)
      .join("<br/>");
    w.document.write(`
      <html>
        <head>
          <title>Shipping Sticker - ${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 14px; }
            .card { border: 2px solid #111; border-radius: 12px; padding: 14px; width: 100%; box-sizing: border-box; }
            .title { font-size: 20px; font-weight: 700; margin-bottom: 10px; }
            .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
            .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #555; margin-top: 8px; }
            .value { font-size: 14px; margin-top: 3px; }
            .divider { border-top: 1px dashed #999; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">FUNT Shop Shipping Sticker</div>
            <div class="label">Order ID</div>
            <div class="value mono">${order.id}</div>
            <div class="label">Student ID</div>
            <div class="value mono">${order.studentId}</div>
            <div class="label">Items</div>
            <div class="value">${(order.items ?? []).map((it) => `${it.productName} x${it.quantity}`).join(", ")}</div>
            <div class="divider"></div>
            <div class="label">Ship To</div>
            <div class="value"><strong>${addr?.fullName ?? ""}</strong><br/>${addr?.phone ?? ""}<br/>${addressBlock}</div>
            <div class="divider"></div>
            <div class="label">Status</div>
            <div class="value">${statusLabel(order.status)}</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <AppPageShell className="w-full gap-8">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <PageSection>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student shop</h1>
        <p className="mt-1 text-sm text-slate-600">
          Products listed here appear in the LMS shop. Students pay with FUNT coins earned from certificates (after you grant rewards).
        </p>
      </PageSection>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {stockInsights && (
        <DataPanel>
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Stock operations</h2>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Low stock (&lt;=5)</p>
              {stockInsights.lowStockProducts.length === 0 ? (
                <p className="mt-2 text-sm text-amber-900/80">No low-stock products.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {stockInsights.lowStockProducts.map((p) => (
                    <li key={p.productId}>{p.productName} — stock {p.stockNow ?? "∞"}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800">Reserved in pending checkouts</p>
              <p className="mt-1 text-sm font-semibold text-indigo-900">Total reserved qty: {stockInsights.reservedTotalQty}</p>
              {stockInsights.reservedByProduct.length === 0 ? (
                <p className="mt-2 text-sm text-indigo-900/80">No active reservations.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-indigo-900">
                  {stockInsights.reservedByProduct.map((p) => (
                    <li key={p.productId}>{p.productName} — reserved {p.reservedQty} (stock now {p.stockNow ?? "∞"})</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DataPanel>
      )}

      <FormPanel className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Add product</h2>
        <form onSubmit={createProduct} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 block text-sm">
            <span className="font-medium text-slate-700">Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="sm:col-span-2 block text-sm">
            <span className="font-medium text-slate-700">Description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Price (coins)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.priceCoins}
              onChange={(e) => setForm((f) => ({ ...f, priceCoins: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Shop shelf</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.shopShelf}
              onChange={(e) => setForm((f) => ({ ...f, shopShelf: e.target.value as "KITS" | "COMPONENTS" }))}
            >
              <option value="KITS">Kits</option>
              <option value="COMPONENTS">Components</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Sort order</span>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Image URL (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Stock (blank = unlimited)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              placeholder="Unlimited"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="font-medium text-slate-700">Visible in LMS</span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create product"}
            </button>
          </div>
        </form>
      </FormPanel>

      <DataPanel>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Catalog ({products.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Shelf</th>
                <th className="px-4 py-3 font-semibold">Coins</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Visible</th>
                <th className="px-4 py-3 font-semibold w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      value={p.shopShelf ?? "KITS"}
                      onChange={async (e) => {
                        const v = e.target.value as "KITS" | "COMPONENTS";
                        const res = await api(`/api/admin/shop/products/${encodeURIComponent(p.id)}`, {
                          method: "PATCH",
                          body: JSON.stringify({ shopShelf: v }),
                        });
                        if (res.success) load();
                        else setMessage({ type: "err", text: res.message ?? "Update failed" });
                      }}
                    >
                      <option value="KITS">Kits</option>
                      <option value="COMPONENTS">Components</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.priceCoins}</td>
                  <td className="px-4 py-3">{p.stock == null ? "∞" : p.stock}</td>
                  <td className="px-4 py-3">{p.active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(p)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                    >
                      {p.active ? "Hide" : "Show"}
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={stockByProduct[p.id] ?? ""}
                      onChange={(e) => setStockByProduct((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Stock"
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      className="rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                      onClick={async () => {
                        const raw = (stockByProduct[p.id] ?? "").trim();
                        const stock = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));
                        const res = await api(`/api/admin/shop/products/${encodeURIComponent(p.id)}`, {
                          method: "PATCH",
                          body: JSON.stringify({ stock }),
                        });
                        if (res.success) {
                          setMessage({ type: "ok", text: `Stock updated for ${p.name}.` });
                          load();
                        } else {
                          setMessage({ type: "err", text: res.message ?? "Stock update failed" });
                        }
                      }}
                    >
                      Save stock
                    </button>
                    <DeleteIconButton title="Delete product" aria-label="Delete product" onClick={() => remove(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No products yet.</p>}
        </div>
      </DataPanel>

      <DataPanel>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Orders ({orders.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reason / Message</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/80 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{o.studentId}</p>
                    <p className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {(o.items ?? []).map((it) => `${it.productName} x${it.quantity}`).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {o.totalCoins} coins · redeemed {o.coinsRedeemed} · ₹{(o.payablePaise / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      value={o.status}
                      onChange={(e) => {
                        const status = e.target.value as ShopOrderRow["status"];
                        setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x)));
                      }}
                    >
                      <option value="CONFIRMED">Order confirmed</option>
                      <option value="PACKED">Packed</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="OUT_FOR_DELIVERY">Out for delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="ISSUE">Issue / Hold</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="mb-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Reason (required when not confirmed)"
                      value={statusReasonByOrder[o.id] ?? o.statusReason ?? ""}
                      onChange={(e) => setStatusReasonByOrder((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Optional message note"
                      value={statusNoteByOrder[o.id] ?? ""}
                      onChange={(e) => setStatusNoteByOrder((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        onClick={async () => {
                          const reason = (statusReasonByOrder[o.id] ?? o.statusReason ?? "").trim();
                          const note = (statusNoteByOrder[o.id] ?? "").trim();
                          if (o.status !== "CONFIRMED" && !reason) {
                            setMessage({ type: "err", text: "Reason is required for non-confirmed statuses." });
                            return;
                          }
                          const res = await api(`/api/admin/shop/orders/${encodeURIComponent(o.id)}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: o.status, reason, note }),
                          });
                          if (res.success) {
                            setMessage({ type: "ok", text: "Order status updated." });
                            load();
                          } else {
                            setMessage({ type: "err", text: res.message ?? "Could not update order status" });
                          }
                        }}
                      >
                        Update status
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                        onClick={() => setSelectedOrder(o)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                        onClick={() => downloadOrderDetails(o)}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        className="rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                        onClick={() => printSticker(o)}
                      >
                        Print sticker
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No orders yet.</p>}
        </div>
      </DataPanel>
      {selectedOrder && (
        <FormPanel className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Order details</h3>
              <p className="mt-1 text-xs text-slate-500">Order ID: {selectedOrder.id}</p>
            </div>
            <button type="button" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" onClick={() => setSelectedOrder(null)}>Close</button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Shipping address</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selectedOrder.address?.fullName ?? "—"}</p>
              <p className="text-sm text-slate-700">{selectedOrder.address?.phone ?? "—"}</p>
              <p className="mt-1 text-sm text-slate-700">{selectedOrder.address?.line1 ?? "—"}</p>
              {selectedOrder.address?.line2 ? <p className="text-sm text-slate-700">{selectedOrder.address.line2}</p> : null}
              <p className="text-sm text-slate-700">
                {selectedOrder.address?.city ?? ""} {selectedOrder.address?.state ?? ""} {selectedOrder.address?.postalCode ?? ""}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Checkout summary</p>
              <p className="mt-2 text-sm text-slate-700">{(selectedOrder.items ?? []).map((it) => `${it.productName} x${it.quantity}`).join(", ")}</p>
              <p className="mt-1 text-sm text-slate-700">Total: {selectedOrder.totalCoins} coins</p>
              <p className="text-sm text-slate-700">Redeemed: {selectedOrder.coinsRedeemed} coins</p>
              <p className="text-sm text-slate-700">Payable: ₹{(selectedOrder.payablePaise / 100).toFixed(2)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Status: {statusLabel(selectedOrder.status)}</p>
              {selectedOrder.statusReason ? <p className="text-sm text-rose-700">Reason: {selectedOrder.statusReason}</p> : null}
            </div>
          </div>
        </FormPanel>
      )}
    </AppPageShell>
  );
}
