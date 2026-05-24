"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import {
  AdminSpinner,
  FieldLabel,
  InvoiceSubNav,
  PaymentsCommerceNav,
  SettingsSection,
  SettingsToggle,
} from "@/components/invoices/InvoiceAdminUi";
import type { InvoiceSettingsDto } from "@/components/invoices/invoiceSettingsTypes";
import { DEFAULT_INVOICE_SETTINGS } from "@/components/invoices/invoiceSettingsTypes";

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
      setMsg({ type: "success", text: "Settings saved successfully." });
    } else {
      setMsg({ type: "error", text: res.message ?? "Could not save." });
    }
  }

  if (loading) {
    return (
      <AppPageShell className="w-full">
        <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
        <AdminSpinner className="py-24" />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <PageHeader
        title="Invoice settings"
        subtitle="Company block, GST columns (HSN/SAC, CGST/SGST/IGST), and footer. Tax is reverse-calculated from the enrollment total."
        backHref="/invoices"
        backLabel="All invoices"
        actions={
          <Link href="/invoices/sample" className="btn-primary text-sm">
            Preview template
          </Link>
        }
      />

      <PaymentsCommerceNav />
      <InvoiceSubNav />

      <form onSubmit={save} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <SettingsSection
            title="Company details"
            description="Shown in the header block on every tax invoice."
          >
            <SettingsToggle
              label="Company name"
              checked={form.showLegalName}
              onChange={(v) => set("showLegalName", v)}
            >
              <input className="input" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
            </SettingsToggle>
            <SettingsToggle
              label="Address"
              checked={form.showAddress}
              onChange={(v) => set("showAddress", v)}
            >
              <textarea
                className="input min-h-[88px]"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </SettingsToggle>
            <SettingsToggle label="GSTIN" checked={form.showGstin} onChange={(v) => set("showGstin", v)}>
              <input
                className="input font-mono text-sm"
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value)}
                placeholder="29XXXXX0000X1Z5"
              />
            </SettingsToggle>
            <SettingsToggle label="PAN" checked={form.showPan} onChange={(v) => set("showPan", v)}>
              <input
                className="input font-mono text-sm"
                value={form.pan}
                onChange={(e) => set("pan", e.target.value)}
                placeholder="ABCDE1234F"
              />
            </SettingsToggle>
            <div>
              <FieldLabel hint="Place of supply on the invoice">Recipient state</FieldLabel>
              <input
                className="input"
                value={form.placeOfSupply}
                onChange={(e) => set("placeOfSupply", e.target.value)}
              />
            </div>
            <SettingsToggle
              label="Recipient block"
              description="Name, email, address, and phone from the student profile."
              checked={form.showRecipient}
              onChange={(v) => set("showRecipient", v)}
            >
              <div className="space-y-2">
                <SettingsToggle
                  label="Email"
                  checked={form.showRecipientEmail}
                  onChange={(v) => set("showRecipientEmail", v)}
                />
                <SettingsToggle
                  label="Address"
                  checked={form.showRecipientAddress}
                  onChange={(v) => set("showRecipientAddress", v)}
                />
                <SettingsToggle
                  label="Phone"
                  checked={form.showRecipientPhone}
                  onChange={(v) => set("showRecipientPhone", v)}
                />
              </div>
            </SettingsToggle>
          </SettingsSection>

          <SettingsSection
            title="Tax table columns"
            description="Description, quantity, unit price, and total are always shown."
          >
            <SettingsToggle
              label="HSN column"
              description="Kits and physical goods."
              checked={form.showHsn}
              onChange={(v) => set("showHsn", v)}
            >
              <FieldLabel hint="Digits only">Default HSN</FieldLabel>
              <input
                className="input max-w-xs font-mono"
                inputMode="numeric"
                value={form.hsnCode}
                onChange={(e) => set("hsnCode", e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 950300"
              />
            </SettingsToggle>
            <SettingsToggle
              label="SAC column"
              description="Courses and services."
              checked={form.showSac}
              onChange={(v) => set("showSac", v)}
            >
              <FieldLabel hint="6 digits">Default SAC</FieldLabel>
              <input
                className="input max-w-xs font-mono"
                inputMode="numeric"
                maxLength={6}
                value={form.sacCode}
                onChange={(e) => set("sacCode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="999293"
              />
            </SettingsToggle>
            <SettingsToggle
              label="Taxable value"
              description="Reverse-calculated from inclusive total."
              checked={form.showTaxableValue}
              onChange={(v) => set("showTaxableValue", v)}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <SettingsToggle label="CGST" checked={form.showCgst} onChange={(v) => set("showCgst", v)}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input w-full"
                  value={form.cgstPercent}
                  onChange={(e) => set("cgstPercent", Number(e.target.value))}
                />
              </SettingsToggle>
              <SettingsToggle label="SGST / UGST" checked={form.showSgst} onChange={(v) => set("showSgst", v)}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input w-full"
                  value={form.sgstPercent}
                  onChange={(e) => set("sgstPercent", Number(e.target.value))}
                />
              </SettingsToggle>
              <SettingsToggle label="IGST" checked={form.showIgst} onChange={(v) => set("showIgst", v)}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input w-full"
                  value={form.igstPercent}
                  onChange={(e) => set("igstPercent", Number(e.target.value))}
                />
              </SettingsToggle>
            </div>
            <p className="rounded-xl border border-teal-200/80 bg-teal-50 px-3 py-2.5 text-xs text-teal-900">
              Taxable = Total ÷ (1 + CGST% + SGST% + IGST%). Each tax = taxable × rate.
            </p>
          </SettingsSection>
        </div>

        <SettingsSection title="Footer" description="Authorization text and amount in words.">
          <SettingsToggle
            label="System footer"
            description="Computer-generated invoice disclaimer."
            checked={form.showSystemFooter}
            onChange={(v) => set("showSystemFooter", v)}
          >
            <textarea
              className="input min-h-[72px]"
              value={form.systemFooterText}
              onChange={(e) => set("systemFooterText", e.target.value)}
            />
          </SettingsToggle>
          <SettingsToggle
            label="Total in words"
            checked={form.showTotalInWords}
            onChange={(v) => set("showTotalInWords", v)}
          />
        </SettingsSection>

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-lg ring-1 ring-slate-100/80 backdrop-blur-sm">
          {msg ? (
            <Alert variant={msg.type} className="min-w-[200px] flex-1">
              {msg.text}
            </Alert>
          ) : (
            <p className="flex-1 text-sm text-slate-500">Changes apply to new PDFs and previews immediately.</p>
          )}
          <button type="submit" disabled={saving} className="btn-primary shrink-0 px-8">
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </AppPageShell>
  );
}
