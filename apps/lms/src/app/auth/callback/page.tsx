"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { setToken } from "@/lib/api";
import { parseJwtPayload } from "@/lib/auth";
import { ROLE } from "@funt-platform/constants";

function AuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    if (error) {
      window.location.replace(`/login?error=${encodeURIComponent(decodeURIComponent(error))}`);
      return;
    }
    if (!token?.trim()) {
      window.location.replace("/login");
      return;
    }
    setToken(token.trim());
    const payload = parseJwtPayload(token.trim());
    if (payload?.roles?.includes(ROLE.PARENT)) {
      window.location.replace("/parent");
    } else {
      window.location.replace("/dashboard");
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50/40">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      <p className="mt-4 text-sm font-medium text-slate-600">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
