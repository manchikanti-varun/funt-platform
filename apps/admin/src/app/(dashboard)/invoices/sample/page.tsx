"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { InvoiceDocument, SAMPLE_INVOICE, type InvoiceDocumentData } from "@/components/invoices/InvoiceDocument";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import type { InvoiceSettingsDto } from "@/components/invoices/invoiceSettingsTypes";

export default function InvoiceSamplePage() {
  const [invoice, setInvoice] = useState<InvoiceDocumentData>(SAMPLE_INVOICE);

  useEffect(() => {
    api<InvoiceSettingsDto>("/api/admin/invoices/settings").then((r) => {
      const settings = r.success ? r.data : undefined;
      if (!settings) return;
      setInvoice((prev) => ({ ...prev, settings, displayNotes: settings.defaultNotes }));
    });
  }, []);

  return (
    <AppPageShell className="w-full print:p-0">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="btn-primary">
          Print
        </button>
        <Link href="/invoices/settings" className="btn-secondary">
          Settings
        </Link>
        <Link href="/invoices" className="btn-secondary">
          Back
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-500 print:hidden">Sample tax invoice (uses your saved settings)</p>
      <InvoiceDocument invoice={invoice} />
    </AppPageShell>
  );
}
