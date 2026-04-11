"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

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

export default function AdminShopPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (!confirm(`Delete “${p.name}”?`)) return;
    const res = await api(`/api/admin/shop/products/${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (res.success) {
      setMessage({ type: "ok", text: "Deleted." });
      load();
    } else setMessage({ type: "err", text: res.message ?? "Delete failed" });
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student shop</h1>
        <p className="mt-1 text-sm text-slate-600">
          Products listed here appear in the LMS shop. Students pay with FUNT coins earned from certificates (after you grant rewards).
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
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
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
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
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No products yet.</p>}
        </div>
      </div>
    </div>
  );
}
