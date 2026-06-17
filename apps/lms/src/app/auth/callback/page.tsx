"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { establishSessionFromTokenDetailed, markClientLoggedIn, clearToken } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      window.location.replace(`/login?error=${encodeURIComponent(decodeURIComponent(error))}`);
      return;
    }
    const token = searchParams.get("token")?.trim();
    if (!token) {
      window.location.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await establishSessionFromTokenDetailed(token);
      if (cancelled) return;
      const session = result.session;
      if (!session) {
        setMessage("Could not complete sign-in. Try again.");
        window.location.replace(
          "/login?error=" + encodeURIComponent(result.error ?? "Session could not be established.")
        );
        return;
      }
      if (session.roles.includes(ROLE.PARENT)) {
        markClientLoggedIn();
        window.location.replace("/parent");
        return;
      }
      if (!session.roles.includes(ROLE.STUDENT)) {
        clearToken();
        window.location.replace(
          "/login?error=" +
            encodeURIComponent("FUNT Learn is for student accounts. Staff should use the Admin portal instead.")
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-funt-paper">
      <div className="spinner" />
      <p className="mt-4 text-sm font-medium text-black/65">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-funt-paper">
          <div className="spinner" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
