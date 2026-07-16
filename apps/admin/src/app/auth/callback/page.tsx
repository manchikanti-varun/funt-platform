"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { establishSessionFromCodeDetailed, establishSessionFromTokenDetailed, markClientLoggedIn } from "@/lib/api";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      window.location.replace(`/login?error=${encodeURIComponent(decodeURIComponent(error))}`);
      return;
    }
    // Prefer opaque session code; fall back to legacy raw token
    const code = searchParams.get("code")?.trim();
    const token = searchParams.get("token")?.trim();
    if (!code && !token) {
      window.location.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      const result = code
        ? await establishSessionFromCodeDetailed(code)
        : await establishSessionFromTokenDetailed(token!);
      if (cancelled) return;
      const session = result.session;
      if (!session) {
        setMessage("Could not complete sign-in.");
        window.location.replace(
          "/login?error=" + encodeURIComponent(result.error ?? "Session could not be established.")
        );
        return;
      }
      markClientLoggedIn();
      window.location.replace("/dashboard");
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <div className="spinner" />
      <p className="mt-4 text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="spinner" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
