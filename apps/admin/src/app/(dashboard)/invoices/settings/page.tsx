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
        Choose what appears on tax invoices and PDFs. Students can download invoices after enrollment.
      </p>

      <form onSubmit={save} className="space-y-8">
        <section className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Company (seller)</h2>
          <Toggle label="Show legal name" checked={form.showLegalName} onChange={(v) => set("showLegalName", v)} />
          <input
            className="input"
            value={form.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            placeholder="Legal name"
          />
          <Toggle label="Show address" checked={form.showAddress} onChange={(v) => set("showAddress", v)} />
          <textarea
            className="input min-h-[80px]"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Address"
          />
          <Toggle label="Show GSTIN" checked={form.showGstin} onChange={(v) => set("showGstin", v)} />
          <input className="input" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} placeholder="GSTIN" />
          <Toggle label="Show PAN" checked={form.showPan} onChange={(v) => set("showPan", v)} />
          <input className="input" value={form.pan} onChange={(e) => set("pan", e.target.value)} placeholder="PAN" />
          <Toggle label="Show email" checked={form.showEmail} onChange={(v) => set("showEmail", v)} />
          <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" />
          <Toggle label="Show phone" checked={form.showPhone} onChange={(v) => set("showPhone", v)} />
          <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" />
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Invoice details</h2>
          <Toggle label="Show invoice meta (#, date, terms)" checked={form.showInvoiceMeta} onChange={(v) => set("showInvoiceMeta", v)} />
          <Toggle label="Show terms" checked={form.showTerms} onChange={(v) => set("showTerms", v)} />
          <input className="input" value={form.terms} onChange={(e) => set("terms", e.target.value)} placeholder="Terms" />
          <Toggle label="Show due date" checked={form.showDueDate} onChange={(v) => set("showDueDate", v)} />
          <Toggle label="Show place of supply" checked={form.showPlaceOfSupply} onChange={(v) => set("showPlaceOfSupply", v)} />
          <input
            className="input"
            value={form.placeOfSupply}
            onChange={(e) => set("placeOfSupply", e.target.value)}
            placeholder="Place of supply"
          />
          <Toggle label="Show HSN/SAC column" checked={form.showHsnSac} onChange={(v) => set("showHsnSac", v)} />
          <input className="input" value={form.hsnSac} onChange={(e) => set("hsnSac", e.target.value)} placeholder="HSN/SAC" />
          <Toggle label="Show IGST columns" checked={form.showIgst} onChange={(v) => set("showIgst", v)} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">IGST %</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input max-w-[120px]"
              value={form.igstPercent}
              onChange={(e) => set("igstPercent", Number(e.target.value))}
            />
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Customer &amp; footer</h2>
          <Toggle label="Show Bill To" checked={form.showBillTo} onChange={(v) => set("showBillTo", v)} />
          <Toggle label="Show Ship To" checked={form.showShipTo} onChange={(v) => set("showShipTo", v)} />
          <Toggle label="Show total in words" checked={form.showTotalInWords} onChange={(v) => set("showTotalInWords", v)} />
          <Toggle label="Show notes" checked={form.showNotes} onChange={(v) => set("showNotes", v)} />
          <input
            className="input"
            value={form.defaultNotes}
            onChange={(e) => set("defaultNotes", e.target.value)}
            placeholder="Default notes"
          />
          <Toggle label="Show balance due" checked={form.showBalanceDue} onChange={(v) => set("showBalanceDue", v)} />
          <Toggle
            label="Show digital signature block"
            checked={form.showDigitalSignature}
            onChange={(v) => set("showDigitalSignature", v)}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Signed by (name on invoice)</label>
            <input
              className="input"
              value={form.signatoryName}
              onChange={(e) => set("signatoryName", e.target.value)}
              placeholder="Funt Robotics"
            />
          </div>
          <Toggle label="Show verify link on PDF" checked={form.showVerifyLink} onChange={(v) => set("showVerifyLink", v)} />
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
