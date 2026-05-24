"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { AdminSpinner } from "./InvoiceAdminUi";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

type InvoicePdfPreviewProps = {
  /** API path including leading slash, e.g. `/api/admin/invoices/abc/pdf` */
  pdfPath: string;
  title?: string;
};

export function InvoicePdfPreview({ pdfPath, title = "Invoice PDF" }: InvoicePdfPreviewProps) {
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

  return (
    <iframe
      src={url}
      title={title}
      className="block w-full min-h-[1056px] border-0 bg-white"
    />
  );
}
