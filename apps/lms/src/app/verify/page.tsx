"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472";

interface VerifyResult {
  valid: boolean;
  message?: string;
  certificateId?: string;
  studentName?: string;
  courseName?: string;
  issuedAt?: string;
}

function VerifyCertificateContent() {
  const searchParams = useSearchParams();
  const [certId, setCertId] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) setCertId(id);
  }, [searchParams]);

  async function handleVerify() {
    const id = certId.trim();
    if (!id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(id)}`);
      const data = (await res.json()) as VerifyResult & { data?: VerifyResult };
      const payload = data.data ?? data;
      setResult({
        valid: payload.valid === true,
        message: payload.message,
        certificateId: payload.certificateId,
        studentName: payload.studentName,
        courseName: payload.courseName,
        issuedAt: payload.issuedAt,
      });
    } catch {
      setResult({ valid: false, message: "Verification request failed." });
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (iso: string | undefined) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg ring-1 ring-slate-100 sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Verify certificate</h1>
          <p className="mt-2 text-sm text-slate-600">
            Anyone can verify a certificate using its ID. No login required.
          </p>
          <div className="mt-6">
            <label htmlFor="cert-id" className="block text-sm font-medium text-slate-700">
              Certificate ID
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="cert-id"
                type="text"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                placeholder="e.g. CERT-26-000001"
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || !certId.trim()}
                className="shrink-0 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? "Checking…" : "Verify"}
              </button>
            </div>
          </div>

          {result && (
            <div className="mt-6 rounded-xl border p-4">
              {result.valid ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold">Valid certificate</span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div>
                      <dt className="text-slate-500">Certificate ID</dt>
                      <dd className="font-mono font-medium text-slate-800">{result.certificateId}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Student</dt>
                      <dd className="font-medium text-slate-800">{result.studentName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Course</dt>
                      <dd className="font-medium text-slate-800">{result.courseName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Issued on</dt>
                      <dd className="font-medium text-slate-800">{formatDate(result.issuedAt)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="flex items-center gap-2 text-red-700">
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">{result.message ?? "Certificate not found or revoked."}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          <a href="/login" className="text-teal-600 hover:underline">Sign in</a> to view and download your own certificates.
        </p>
      </div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" /></div>}>
      <VerifyCertificateContent />
    </Suspense>
  );
}
