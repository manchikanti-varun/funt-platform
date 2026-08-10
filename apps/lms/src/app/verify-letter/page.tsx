"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://funt.in").replace(/\/+$/, "");

function RedirectContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("id") ?? "";
    const target = id
      ? `${MARKETING_URL}/verify-letter?id=${encodeURIComponent(id)}`
      : `${MARKETING_URL}/verify-letter`;
    window.location.replace(target);
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-slate-500">Redirecting to verification page…</p>
    </div>
  );
}

export default function VerifyLetterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-sm text-slate-500">Redirecting…</p></div>}>
      <RedirectContent />
    </Suspense>
  );
}
