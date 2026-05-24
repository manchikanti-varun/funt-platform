"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import type { InvoiceSettingsDto } from "@/components/invoices/invoiceSettingsTypes";
import { DEFAULT_INVOICE_SETTINGS } from "@/components/invoices/invoiceSettingsTypes";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}

export default function InvoiceSettingsPage() {
  const [form, setForm] = useState<InvoiceSettingsDto>(DEFAULT_INVOICE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<InvoiceSettingsDto>("/api/admin/invoices/settings")
      .then((r) => {
        if (r.success && r.data) setForm({ ...DEFAULT_INVOICE_SETTINGS, ...r.data });
      })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof InvoiceSettingsDto>(key: K, value: InvoiceSettingsDto[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await api<InvoiceSettingsDto>("/api/admin/invoices/settings", {
      method: "PATCH",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.success && res.data) {
      setForm(res.data);
      setMsg({ type: "success", text: "Saved." });
    } else {
      setMsg({ type: "error", text: res.message ?? "Could not save." });
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  return (
    <AppPageShell className="w-full max-w-3xl">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Invoice settings</h1>
        <Link href="/invoices" className="text-sm font-semibold text-teal-700 hover:underline">
          Back to invoices
        </Link>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        Configure company details and tax columns. Enter the enrollment <strong>total amount</strong> (INR);
        taxable value and CGST/SGST/IGST are calculated automatically from the percentages you enable.
      </p>

      <form onSubmit={save} className="space-y-8">
        <section className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Company details</h2>
          <Toggle label="Show company name" checked={form.showLegalName} onChange={(v) => set("showLegalName", v)} />
          <input className="input" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
          <Toggle label="Show address" checked={form.showAddress} onChange={(v) => set("showAddress", v)} />
          <textarea
            className="input min-h-[72px]"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
          <Toggle label="Show GST number" checked={form.showGstin} onChange={(v) => set("showGstin", v)} />
          {form.showGstin ? (
            <input className="input" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} placeholder="GSTIN" />
          ) : null}
          <Toggle label="Show PAN number" checked={form.showPan} onChange={(v) => set("showPan", v)} />
          {form.showPan ? (
            <input className="input" value={form.pan} onChange={(e) => set("pan", e.target.value)} placeholder="PAN" />
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Recipient state (place of supply)</label>
            <input className="input" value={form.placeOfSupply} onChange={(e) => set("placeOfSupply", e.target.value)} />
          </div>
          <Toggle label="Show recipient details" checked={form.showRecipient} onChange={(v) => set("showRecipient", v)} />
          {form.showRecipient ? (
            <div className="ml-4 space-y-2 border-l-2 border-slate-200 pl-4">
              <Toggle label="Show student email" checked={form.showRecipientEmail} onChange={(v) => set("showRecipientEmail", v)} />
              <Toggle label="Show student address" checked={form.showRecipientAddress} onChange={(v) => set("showRecipientAddress", v)} />
              <Toggle label="Show student phone" checked={form.showRecipientPhone} onChange={(v) => set("showRecipientPhone", v)} />
            </div>
          ) : null}
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Invoice table</h2>
          <p className="text-sm text-slate-500">
            Description, Quantity, Unit Price, and Total are always shown. Enable optional columns below.
          </p>
          <Toggle label="Show HSN column (kits / goods)" checked={form.showHsn} onChange={(v) => set("showHsn", v)} />
          {form.showHsn ? (
            <div>
              <label className="mb-1 block text-xs text-slate-600">Default HSN (digits only, e.g. 950300)</label>
              <input
                className="input max-w-xs font-mono"
                inputMode="numeric"
                value={form.hsnCode}
                onChange={(e) => set("hsnCode", e.target.value.replace(/\D/g, ""))}
                placeholder="HSN for kits"
              />
            </div>
          ) : null}
          <Toggle label="Show SAC column (courses / services)" checked={form.showSac} onChange={(v) => set("showSac", v)} />
          {form.showSac ? (
            <div>
              <label className="mb-1 block text-xs text-slate-600">Default SAC (6 digits, e.g. 999293)</label>
              <input
                className="input max-w-xs font-mono"
                inputMode="numeric"
                maxLength={6}
                value={form.sacCode}
                onChange={(e) => set("sacCode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="999293"
              />
            </div>
          ) : null}
          <p className="text-xs text-slate-500">
            Course enrollments use SAC; kit sales use HSN. The other column shows — on each line.
          </p>
          <Toggle
            label="Show taxable value (auto from total)"
            checked={form.showTaxableValue}
            onChange={(v) => set("showTaxableValue", v)}
          />
          <Toggle label="Show CGST column" checked={form.showCgst} onChange={(v) => set("showCgst", v)} />
          {form.showCgst ? (
            <input
              type="number"
              min={0}
              max={100}
              className="input max-w-[100px]"
              value={form.cgstPercent}
              onChange={(e) => set("cgstPercent", Number(e.target.value))}
            />
          ) : null}
          <Toggle label="Show SGST/UGST column" checked={form.showSgst} onChange={(v) => set("showSgst", v)} />
          {form.showSgst ? (
            <input
              type="number"
              min={0}
              max={100}
              className="input max-w-[100px]"
              value={form.sgstPercent}
              onChange={(e) => set("sgstPercent", Number(e.target.value))}
            />
          ) : null}
          <Toggle label="Show IGST column" checked={form.showIgst} onChange={(v) => set("showIgst", v)} />
          {form.showIgst ? (
            <input
              type="number"
              min={0}
              max={100}
              className="input max-w-[100px]"
              value={form.igstPercent}
              onChange={(e) => set("igstPercent", Number(e.target.value))}
            />
          ) : null}
          <p className="text-xs text-slate-500">
            Formula: Taxable = Total ÷ (1 + CGST% + SGST% + IGST%). Tax amounts = taxable × each rate.
          </p>
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Footer</h2>
          <Toggle label="Show system footer" checked={form.showSystemFooter} onChange={(v) => set("showSystemFooter", v)} />
          {form.showSystemFooter ? (
            <textarea
              className="input min-h-[60px]"
              value={form.systemFooterText}
              onChange={(e) => set("systemFooterText", e.target.value)}
            />
          ) : null}
          <Toggle label="Show total in words" checked={form.showTotalInWords} onChange={(v) => set("showTotalInWords", v)} />
        </section>

        {msg ? (
          <p className={msg.type === "success" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.text}</p>
        ) : null}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </AppPageShell>
  );
}
