"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getToken } from "@/lib/api";
import { AppPageShell } from "@/components/ui";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  courseTitle: string;
  batchName: string;
  amountFormatted: string;
  issuedAt: string;
}

export default function StudentInvoicesPage() {
  const [list, setList] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<InvoiceRow[]>("/api/student/invoices")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setList(r.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function downloadPdf(invoiceId: string, invoiceNumber: string) {
    setDownloadingId(invoiceId);
    setError("");
    const legacy = getToken()?.trim();
    const headers: HeadersInit = {};
    if (legacy) (headers as Record<string, string>)["Authorization"] = `Bearer ${legacy}`;
    try {
      const res = await fetch(
        `${API_BASE}/api/student/invoices/${encodeURIComponent(invoiceId)}/pdf`,
        { credentials: "include", headers }
      );
      if (!res.ok) {
        setError("Download failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <AppPageShell className="w-full">
      <h1 className="text-2xl font-bold text-funt-ink">My invoices</h1>
      <p className="mt-1 text-sm text-black/60">Download tax invoices for your course enrollments.</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-black/50">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-8 text-sm text-black/50">No invoices yet. Invoices are created when you enroll in a batch.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-mono text-xs text-black/50">{inv.invoiceNumber}</p>
                <p className="font-semibold text-funt-ink">{inv.courseTitle || inv.batchName}</p>
                <p className="text-sm text-black/55">
                  {new Date(inv.issuedAt).toLocaleDateString("en-IN")} · {inv.amountFormatted}
                </p>
              </div>
              <button
                type="button"
                disabled={downloadingId === inv.id}
                onClick={() => downloadPdf(inv.id, inv.invoiceNumber)}
                className="rounded-xl bg-funt-gold px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
              >
                {downloadingId === inv.id ? "Downloading…" : "Download PDF"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-black/45">
        <Link href={`/verify-invoice`} className="text-funt-gold-deep underline">
          Verify an invoice
        </Link>
      </p>
    </AppPageShell>
  );
}
