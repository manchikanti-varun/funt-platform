"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");
import { AppPageShell } from "@/components/ui";
import { InvoiceDocument, type InvoiceDocumentData } from "@/components/invoices/InvoiceDocument";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

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
      a.download = `invoice-${invoice?.invoiceNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  if (!invoice) {
    return (
      <AppPageShell>
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/invoices" className="mt-3 inline-block text-sm text-teal-700 hover:underline">
          Back
        </Link>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell className="w-full print:p-0">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => void downloadPdf()} disabled={downloading} className="btn-primary">
          {downloading ? "Downloading…" : "Download PDF"}
        </button>
        <button type="button" onClick={() => window.print()} className="btn-secondary">
          Print
        </button>
        <Link href="/invoices" className="btn-secondary">
          Back
        </Link>
      </div>
      <InvoiceDocument invoice={invoice} />
    </AppPageShell>
  );
}
