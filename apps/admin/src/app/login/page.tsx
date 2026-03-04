"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setToken } from "@/lib/api";
import logoSrc from "@/assets/funt-logo.png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/dashboard";
  const tokenFromQuery = searchParams.get("token");
  const errorFromQuery = searchParams.get("error");
  const [funtId, setFuntId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorFromQuery ?? "");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (tokenFromQuery) {
      setToken(tokenFromQuery);
      router.replace("/dashboard");
      router.refresh();
    }
  }, [tokenFromQuery, router]);

  useEffect(() => {
    if (errorFromQuery) setError(decodeURIComponent(errorFromQuery));
  }, [errorFromQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await api<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ funtId: funtId.trim(), password }),
    });
    setLoading(false);
    if (!res.success || !res.data?.token) {
      setError(res.message ?? "Invalid FUNT ID or password");
      return;
    }
    setToken(res.data.token);
    router.push(from);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50/40 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8 flex flex-col items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={typeof logoSrc === "string" ? logoSrc : (logoSrc as { src: string }).src}
            alt="FUNT Admin"
            className="h-14 w-auto object-contain"
          />
          <span className="mt-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
            Admin
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">FUNT ID</label>
            <input
              type="text"
              value={funtId}
              onChange={(e) => setFuntId(e.target.value)}
              required
              className="input font-mono"
              placeholder="FUNT ID"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
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
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div className="relative my-6">
            <span className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></span>
            <span className="relative flex justify-center bg-white px-3 text-xs text-slate-400">or</span>
          </div>
          <a
            href={`${API_BASE}/api/auth/google?app=admin`}
            className="btn-secondary flex w-full items-center justify-center gap-2"
          >
            Sign in with Google
          </a>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
