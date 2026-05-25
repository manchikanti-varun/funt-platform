"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { invoicePdfFilename } from "@/lib/invoicePdf";
import { AdminSpinner } from "./InvoiceAdminUi";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

type InvoicePdfPreviewProps = {
  /** API path including leading slash, e.g. `/api/admin/invoices/abc/pdf` */
  pdfPath: string;
  title?: string;
  /** Used if you save from the preview; Download PDF button uses the server filename. */
  invoiceNumber?: string;
};

export function InvoicePdfPreview({
  pdfPath,
  title = "Invoice PDF",
  invoiceNumber,
}: InvoicePdfPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      const headers: HeadersInit = {};
      const legacy = getToken()?.trim();
      if (legacy) (headers as Record<string, string>)["Authorization"] = `Bearer ${legacy}`;

      try {
        const res = await fetch(`${API_BASE}${pdfPath}`, { credentials: "include", headers });
        if (!res.ok) {
          if (!cancelled) {
            setError(
              "Could not load the PDF preview. Download PDF uses the same file students receive — redeploy the backend if it looks outdated."
            );
          }
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(objectUrl);
      } catch {
        if (!cancelled) setError("Could not load the PDF preview.");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfPath]);

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-900">
        {error}
      </div>
    );
  }

  if (!url) return <AdminSpinner className="min-h-[480px]" />;

  const saveName = invoiceNumber ? invoicePdfFilename(invoiceNumber) : undefined;

  return (
    <div>
      {saveName ? (
        <p className="mb-2 text-center text-[11px] text-slate-500">
          Use <strong>Download PDF</strong> above for{" "}
          <span className="font-mono text-slate-700">{saveName}</span> — saving from the viewer may use a random name.
        </p>
      ) : null}
      <iframe
        src={url}
        title={title}
        className="block w-full min-h-[1056px] border-0 bg-white"
      />
    </div>
  );
}
