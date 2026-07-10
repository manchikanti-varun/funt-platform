"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

interface VerifyResult {
  isValid: boolean;
  signatureValid: boolean;
  letterId?: string;
  type?: string;
  recipientName?: string;
  designation?: string;
  department?: string;
  employmentType?: string;
  joiningDate?: string;
  endDate?: string;
  status?: string;
  issuedAt?: string;
  signedBy?: string;
  issuer?: string;
}

function VerifyLetterContent() {
  const searchParams = useSearchParams();
  const [letterId, setLetterId] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setLetterId(id);
      void doVerify(id);
    }
  }, [searchParams]);

  async function doVerify(id?: string) {
    const target = (id ?? letterId).trim().toUpperCase();
    if (!target) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/verify/letter/${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Letter not found or invalid.");
        setLoading(false);
        return;
      }
      const payload = data.data ?? data;
      setResult(payload as VerifyResult);
    } catch {
      setError("Verification request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(d?: string) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  }

  function typeLabel(t?: string) {
    if (t === "OFFER_LETTER") return "Offer Letter";
    if (t === "EXPERIENCE_LETTER") return "Experience Letter";
    return t ?? "—";
  }

  function empTypeLabel(t?: string) {
    if (t === "INTERN") return "Intern";
    if (t === "FULL_TIME") return "Full-Time";
    if (t === "PART_TIME") return "Part-Time";
    if (t === "CONTRACT") return "Contract";
    return t ?? "—";
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/funt-logo.png" alt="FUNT" className="mx-auto h-10 w-auto" />
          <h1 className="mt-3 text-xl font-bold text-black">Verify Letter</h1>
          <p className="mt-1 text-sm text-black/70">
            Enter a letter ID to verify its authenticity.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doVerify();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={letterId}
            onChange={(e) => setLetterId(e.target.value.toUpperCase())}
            placeholder="e.g. LTR-000001"
            className="input flex-1 font-mono text-sm"
          />
          <button type="submit" disabled={loading} className="btn-primary px-5 py-2.5 text-sm">
            {loading ? "Checking…" : "Verify"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {result && (
          <div className={`mt-6 rounded-2xl border p-5 ${result.isValid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            {/* Status Badge */}
            <div className="flex items-center justify-center gap-2">
              {result.isValid ? (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-emerald-800">Authentic & Valid</p>
                </>
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-red-800">Revoked</p>
                </>
              )}
            </div>

            {/* Signature status */}
            {result.signatureValid && (
              <p className="mt-2 text-center text-xs font-medium text-emerald-700">
                ✓ Digitally signed by {result.signedBy || "FUNT Robotics Academy"}
              </p>
            )}

            {/* Details */}
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between border-b border-black/5 pb-1">
                <span className="text-black/60">Letter ID</span>
                <span className="font-mono font-medium text-black">{result.letterId}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1">
                <span className="text-black/60">Type</span>
                <span className="font-medium text-black">{typeLabel(result.type)}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1">
                <span className="text-black/60">Recipient</span>
                <span className="font-medium text-black">{result.recipientName}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1">
                <span className="text-black/60">Designation</span>
                <span className="font-medium text-black">{result.designation}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1">
                <span className="text-black/60">Department</span>
                <span className="font-medium text-black">{result.department}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1">
                <span className="text-black/60">Employment Type</span>
                <span className="font-medium text-black">{empTypeLabel(result.employmentType)}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1">
                <span className="text-black/60">Joining Date</span>
                <span className="font-medium text-black">{formatDate(result.joiningDate)}</span>
              </div>
              {result.endDate && (
                <div className="flex justify-between border-b border-black/5 pb-1">
                  <span className="text-black/60">End Date</span>
                  <span className="font-medium text-black">{formatDate(result.endDate)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-black/60">Issued On</span>
                <span className="font-medium text-black">{formatDate(result.issuedAt)}</span>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-black/50">
              Issued by {result.issuer || "FUNT Robotics Academy"}
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-black/40">
          <Link href="/verify" className="hover:underline">Verify certificate</Link>
          {" · "}
          <Link href="/verify-invoice" className="hover:underline">Verify invoice</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyLetterPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-slate-500">Loading…</p>}>
      <VerifyLetterContent />
    </Suspense>
  );
}
