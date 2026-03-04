"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CertificatesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/batches");
  }, [router]);
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="text-sm text-slate-500">Redirecting to Batches…</p>
    </div>
  );
}
