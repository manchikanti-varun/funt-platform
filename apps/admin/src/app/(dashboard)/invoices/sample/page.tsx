"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  InvoicePreviewFrame,
  InvoiceSubNav,
  PaymentsCommerceNav,
} from "@/components/invoices/InvoiceAdminUi";
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
      <div className="print:hidden space-y-4">
        <PageHeader
          title="Invoice preview"
          subtitle="Sample tax invoice using your saved settings. Use Print to check layout on paper."
          backHref="/invoices"
          backLabel="All invoices"
          actions={
            <>
              <button type="button" onClick={() => window.print()} className="btn-primary">
                Print
              </button>
              <Link href="/invoices/settings" className="btn-secondary">
                Edit settings
              </Link>
            </>
          }
        />
        <PaymentsCommerceNav />
        <InvoiceSubNav />
      </div>
      <div className="mt-2 print:mt-0">
        <InvoicePreviewFrame badge="Screen preview — not a real invoice">
          <InvoiceDocument invoice={invoice} />
        </InvoicePreviewFrame>
        <div className="hidden print:block">
          <InvoiceDocument invoice={invoice} />
        </div>
      </div>
    </AppPageShell>
  );
}
