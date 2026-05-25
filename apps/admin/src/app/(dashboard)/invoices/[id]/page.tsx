"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";
import { filenameFromContentDisposition, invoicePdfFilename } from "@/lib/invoicePdf";
import { AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  AdminSpinner,
  InvoicePreviewFrame,
  InvoiceSubNav,
  PaymentsCommerceNav,
} from "@/components/invoices/InvoiceAdminUi";
import type { InvoiceDocumentData } from "@/components/invoices/InvoiceDocument";
import { InvoicePdfPreview } from "@/components/invoices/InvoicePdfPreview";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [invoice, setInvoice] = useState<InvoiceDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<InvoiceDocumentData>(`/api/admin/invoices/${encodeURIComponent(id)}`)
      .then((r) => {
        if (r.success && r.data) setInvoice(r.data);
        else setError(r.message ?? "Not found.");
      })
      .catch(() => setError("Could not load."))
      .finally(() => setLoading(false));
  }, [id]);

  async function downloadPdf() {
    if (!id) return;
    setDownloading(true);
    const legacy = getToken()?.trim();
    const headers: HeadersInit = {};
    if (legacy) (headers as Record<string, string>)["Authorization"] = `Bearer ${legacy}`;
    try {
      const res = await fetch(`${API_BASE}/api/admin/invoices/${encodeURIComponent(id)}/pdf`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fromHeader = filenameFromContentDisposition(res.headers.get("Content-Disposition"));
      a.download =
        fromHeader ??
        invoicePdfFilename(invoice?.invoiceNumber ?? id);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
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

  if (!invoice) {
    return (
      <AppPageShell>
        <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/invoices"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          All invoices
        </Link>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell className="w-full print:p-0">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <div className="print:hidden space-y-4">
        <PageHeader
          title={invoice.invoiceNumber}
          subtitle={`${invoice.studentName} · ${invoice.courseTitle || invoice.batchName}`}
          backHref="/invoices"
          backLabel="All invoices"
          actions={
            <>
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={downloading}
                className="btn-primary"
              >
                {downloading ? "Downloading…" : "Download PDF"}
              </button>
            </>
          }
        />
        <PaymentsCommerceNav />
        <InvoiceSubNav />
      </div>
      <div className="mt-2">
        <p className="mb-3 text-center text-xs text-slate-500 print:hidden">
          Preview matches the PDF students download (same server generator).
        </p>
        <InvoicePreviewFrame>
          <InvoicePdfPreview
            pdfPath={`/api/admin/invoices/${encodeURIComponent(id)}/pdf`}
            title={`Invoice ${invoice.invoiceNumber}`}
            invoiceNumber={invoice.invoiceNumber}
          />
        </InvoicePreviewFrame>
      </div>
    </AppPageShell>
  );
}
