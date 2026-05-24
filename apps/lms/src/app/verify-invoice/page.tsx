"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

interface VerifyResult {
  valid: boolean;
  message?: string;
  invoiceNumber?: string;
  documentId?: string;
  studentName?: string;
  courseTitle?: string;
  batchName?: string;
  amountFormatted?: string;
  electronicallySignedAt?: string;
  signedBy?: string;
  documentHash?: string;
}

function VerifyInvoiceContent() {
  const searchParams = useSearchParams();
  const [invoiceId, setInvoiceId] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) setInvoiceId(id);
  }, [searchParams]);

  async function handleVerify() {
    const id = invoiceId.trim();
    if (!id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/verify/invoice/${encodeURIComponent(id)}`);
      const data = (await res.json()) as VerifyResult & { data?: VerifyResult; success?: boolean };
      if (!res.ok) {
        setResult({
          valid: false,
          message: data.message ?? (res.status === 409 ? "Integrity check failed." : "Invoice not found."),
        });
        return;
      }
      const payload = data.data ?? data;
      setResult({
        valid: payload.valid === true,
        message: payload.message,
        invoiceNumber: payload.invoiceNumber,
        documentId: payload.documentId,
        studentName: payload.studentName,
        courseTitle: payload.courseTitle,
        batchName: payload.batchName,
        amountFormatted: payload.amountFormatted,
        electronicallySignedAt: payload.electronicallySignedAt,
        signedBy: payload.signedBy,
        documentHash: payload.documentHash,
      });
    } catch {
      setResult({ valid: false, message: "Verification request failed." });
    } finally {
      setLoading(false);
    }
  }

  const formatDateTime = (iso: string | undefined) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#fffdf7] to-[#fff7e6] px-4 py-10">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-funt-gold/25 bg-white p-6 shadow-lg sm:p-8">
        <header className="mb-6 text-center">
          <img src="/funt-logo.png" alt="FUNT" className="mx-auto h-10 w-auto" />
          <h1 className="mt-3 text-xl font-bold text-black">Verify invoice</h1>
          <p className="mt-1 text-sm text-black/70">
            Enter an invoice document ID to confirm it was issued and not altered.
          </p>
        </header>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleVerify();
          }}
        >
          <div>
            <label htmlFor="invoice-id" className="mb-1 block text-sm font-semibold text-black">
              Document ID
            </label>
            <input
              id="invoice-id"
              type="text"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              placeholder="e.g. FUNT-INV-20250524-0001"
              className="input w-full font-mono text-sm"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        {result ? (
          <div
            className={`mt-6 rounded-lg border p-4 text-sm ${
              result.valid
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <p className="font-bold">{result.valid ? "Valid — digitally authorized" : "Not verified"}</p>
            {result.message ? <p className="mt-1">{result.message}</p> : null}
            {result.valid ? (
              <ul className="mt-3 space-y-1 text-black/80">
                <li>
                  <span className="text-black/50">Document ID: </span>
                  <span className="font-mono">{result.documentId}</span>
                </li>
                <li>
                  <span className="text-black/50">Student: </span>
                  {result.studentName}
                </li>
                <li>
                  <span className="text-black/50">Course: </span>
                  {result.courseTitle}
                  {result.batchName ? ` (${result.batchName})` : ""}
                </li>
                <li>
                  <span className="text-black/50">Amount: </span>
                  {result.amountFormatted}
                </li>
                <li>
                  <span className="text-black/50">Signed by: </span>
                  {result.signedBy}
                </li>
                <li>
                  <span className="text-black/50">Signed at (IST): </span>
                  {formatDateTime(result.electronicallySignedAt)}
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-black/50">
          <Link href="/login" className="text-teal-800 underline">
            Sign in
          </Link>{" "}
          to view your invoices in the student portal.
        </p>
      </div>
    </div>
  );
}

export default function VerifyInvoicePage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-slate-500">Loading…</p>}>
      <VerifyInvoiceContent />
    </Suspense>
  );
}
