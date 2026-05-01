"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-[#fffdf7] via-[#fffaf0] to-[#fff7e6] px-4 py-10 sm:px-6 sm:py-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        aria-hidden
        style={{
          background:
            "radial-gradient(640px 320px at 12% -5%, rgba(212, 175, 55, 0.28), transparent 58%), radial-gradient(520px 260px at 100% 8%, rgba(244, 223, 149, 0.2), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-funt-gold/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-1/4 h-56 w-56 rounded-full bg-amber-200/20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-lg">
        <section className="rounded-3xl border border-funt-gold/25 bg-white/95 px-6 py-7 shadow-xl shadow-funt-gold/12 backdrop-blur-sm sm:px-8 sm:py-8">
          <header className="mb-7 text-center">
            <div className="mx-auto flex flex-col items-center gap-3">
              <img src="/funt-logo.png" alt="FUNT Learn" className="h-11 w-auto max-w-full object-contain sm:h-[3.25rem]" />
              <div>
                <p className="label-overline text-black/65">Public verification</p>
                <h1 className="mt-1.5 font-brand-learn text-2xl font-black tracking-tight text-black sm:text-[1.65rem]">
                  Verify certificate
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-black/70">
                  Enter a certificate ID to confirm it was issued by FUNT Learn. No account needed.
                </p>
              </div>
            </div>
          </header>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerify();
            }}
          >
            <div>
              <label htmlFor="cert-id" className="mb-1.5 block text-sm font-semibold text-black">
                Certificate ID
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <input
                  id="cert-id"
                  type="text"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  placeholder="e.g. CERT-26-000001"
                  autoComplete="off"
                  className="input min-h-[46px] flex-1 font-mono text-sm"
                />
                <button
                  type="submit"
                  disabled={loading || !certId.trim()}
                  className="btn-primary shrink-0 px-6 py-2.5 sm:min-w-[120px]"
                >
                  {loading ? "Checking…" : "Verify"}
                </button>
              </div>
            </div>
          </form>

          {result && (
            <div className="mt-7">
              {result.valid ? (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/95 to-white p-5 shadow-[0_12px_32px_-18px_rgba(5,150,105,0.35)] ring-1 ring-emerald-100/80 sm:p-6">
                  <div
                    className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-200/25 blur-2xl"
                    aria-hidden
                  />
                  <div className="relative flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/25">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <div>
                      <p className="font-brand-learn text-lg font-bold tracking-tight text-emerald-950">Valid certificate</p>
                      <p className="mt-0.5 text-sm text-emerald-900/75">This record matches an issued certificate on file.</p>
                    </div>
                  </div>

                  <dl className="relative mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 shadow-sm sm:col-span-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-black/45">Certificate ID</dt>
                      <dd className="mt-1 font-mono text-sm font-semibold tracking-wide text-black">{result.certificateId}</dd>
                    </div>
                    <div className="rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 shadow-sm">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-black/45">Student</dt>
                      <dd className="mt-1 text-sm font-semibold text-black">{result.studentName ?? "—"}</dd>
                    </div>
                    <div className="rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 shadow-sm">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-black/45">Issued on</dt>
                      <dd className="mt-1 text-sm font-semibold text-black">{formatDate(result.issuedAt)}</dd>
                    </div>
                    <div className="rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 shadow-sm sm:col-span-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-black/45">Course</dt>
                      <dd className="mt-1 text-sm font-semibold leading-snug text-black">{result.courseName ?? "—"}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50/95 to-white p-5 shadow-[0_12px_32px_-18px_rgba(190,18,60,0.18)] ring-1 ring-rose-100/80 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-600/25">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                    <div>
                      <p className="font-brand-learn text-lg font-bold tracking-tight text-rose-950">Not verified</p>
                      <p className="mt-1 text-sm leading-relaxed text-rose-900/85">
                        {result.message ?? "Certificate not found or no longer valid."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-sm text-black/60">
          <Link href="/login" className="font-semibold text-funt-gold-deep underline decoration-funt-gold/40 underline-offset-2 transition hover:text-black hover:decoration-funt-gold">
            Sign in
          </Link>{" "}
          to view and download your own certificates.
        </p>
      </div>
    </div>
  );
}

function VerifyFallback() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fffdf7] via-[#fffaf0] to-[#fff7e6] px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          background: "radial-gradient(520px 280px at 50% -8%, rgba(212, 175, 55, 0.22), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-4">
        <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-funt-gold/25 border-t-funt-gold-deep" />
        <p className="text-sm font-medium text-black/60">Loading…</p>
      </div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyCertificateContent />
    </Suspense>
  );
}
