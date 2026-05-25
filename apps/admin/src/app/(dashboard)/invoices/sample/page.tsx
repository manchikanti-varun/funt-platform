"use client";

import Link from "next/link";
import { AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  InvoicePreviewFrame,
  InvoiceSubNav,
  PaymentsCommerceNav,
} from "@/components/invoices/InvoiceAdminUi";
import { InvoicePdfPreview } from "@/components/invoices/InvoicePdfPreview";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

export default function InvoiceSamplePage() {
  return (
    <AppPageShell className="w-full print:p-0">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <div className="print:hidden space-y-4">
        <PageHeader
          title="Invoice preview"
          subtitle="Sample invoice PDF using your saved settings — same layout as student downloads."
          backHref="/invoices"
          backLabel="All invoices"
          actions={
            <>
              <Link href="/invoices/settings" className="btn-primary">
                Edit settings
              </Link>
            </>
          }
        />
        <PaymentsCommerceNav />
        <InvoiceSubNav />
      </div>
      <div className="mt-2 print:mt-0">
        <InvoicePreviewFrame badge="Sample PDF — not a real invoice">
          <InvoicePdfPreview
            pdfPath="/api/admin/invoices/sample/pdf"
            title="Sample invoice"
            invoiceNumber="FUNT-INV-SAMPLE"
          />
        </InvoicePreviewFrame>
      </div>
    </AppPageShell>
  );
}
