"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, apiUrl, markClientLoggedIn, clearToken } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { safeRedirectPath } from "@/lib/safeRedirectPath";
import { FormPanel } from "@/components/ui/FormPanel";

import { SUPPORT_EMAIL, supportWhatsAppHref } from "@/lib/support";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeRedirectPath(searchParams.get("from"), "/dashboard");
  const tokenFromQuery = searchParams.get("token");
  const errorFromQuery = searchParams.get("error");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(errorFromQuery ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = tokenFromQuery?.trim();
    if (t) {
      router.replace(`/auth/callback?token=${encodeURIComponent(t)}`);
    }
  }, [tokenFromQuery, router]);

  useEffect(() => {
    if (errorFromQuery) setError(decodeURIComponent(errorFromQuery));
  }, [errorFromQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await api<{ user: { roles: string[] } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password, portal: "lms" }),
    });
    setLoading(false);
    if (!res.success || !res.data?.user) {
      setError(res.message ?? "Invalid username or password");
      return;
    }
    const roles = res.data.user.roles ?? [];
    if (roles.includes(ROLE.PARENT)) {
      markClientLoggedIn();
      router.push("/parent/profiles");
      router.refresh();
      return;
    }
    if (!roles.includes(ROLE.STUDENT)) {
      clearToken();
      setError("FUNT Learn is for student accounts. Staff should use the Admin portal instead.");
      return;
    }
    markClientLoggedIn();
    router.push(from);
    router.refresh();
  }

  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fffdf7] via-[#fffaf0] to-[#fff7e6] px-4 py-3">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          background:
            "radial-gradient(520px 280px at 50% -8%, rgba(212, 175, 55, 0.22), transparent 70%)",
        }}
      />
      <FormPanel className="relative w-full max-w-[410px] rounded-3xl border border-funt-gold/20 bg-white/95 px-7 py-6 shadow-xl shadow-funt-gold/10 sm:px-8 sm:py-7">
        <header className="mb-6 text-center">
          <div className="mx-auto flex flex-col items-center gap-2.5">
            <img
              src="/funt-logo.png"
              alt="FUNT Learn"
              className="h-12 w-auto max-w-full object-contain sm:h-14"
            />
            <div>
              <p className="label-overline text-black/70">FUNT Learn</p>
              <h1 className="mt-1 font-brand-learn text-2xl font-black tracking-tight text-black sm:text-[1.65rem]">
                Sign in
              </h1>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-sm font-medium text-black">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="input text-black placeholder:text-black/45"
              placeholder="Enter your username"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-black">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                required
                className="input pr-11 text-black placeholder:text-black/45"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-black/35 transition hover:bg-black/[0.04] hover:text-black/55"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-amber-900/15 bg-funt-honey px-3.5 py-2.5 text-sm font-medium leading-snug text-black"
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-1 w-full py-2.5 text-base">
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <Link href="/signup" className="btn-secondary block w-full py-2 text-center text-sm font-semibold">
              Create account
            </Link>
            <Link href="/forgot-username" className="btn-secondary block w-full py-2 text-center text-sm font-semibold">
              Forgot username
            </Link>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-black/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gradient-to-b from-white to-[#fffdf6] px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
                or continue with
              </span>
            </div>
          </div>

          <a
            href={apiUrl("/api/auth/google?app=lms")}
            className="btn-secondary flex w-full items-center justify-center gap-2.5 border-funt-gold/25 bg-white/90 py-2.5 font-semibold hover:bg-funt-honey/30"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </a>
        </form>

        <footer className="mt-5 border-t border-black/[0.08] pt-4 text-center">
          <p className="text-xs text-black/55">
            Parent or guardian?{" "}
            <Link href="/parent/profiles" className="font-semibold text-funt-ink hover:text-black">
              Parent Dashboard
            </Link>
          </p>
          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-black/45">
            <span className="text-black/50">Need password help?</span>
            <a
              href={supportWhatsAppHref("Hi, I need help with my FUNT Learn account password.")}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-funt-ink hover:text-black"
            >
              WhatsApp
            </a>
            <span className="text-black/25">|</span>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=FUNT%20Learn%20account`} className="font-semibold text-funt-ink hover:text-black">
              Email
            </a>
          </div>
        </footer>
      </FormPanel>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      <p className="text-sm font-medium text-black/50">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
