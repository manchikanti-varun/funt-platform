"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ensureCsrfToken } from "@/lib/api";

export default function SupportLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Initialize CSRF token on mount
  useEffect(() => { void ensureCsrfToken(); }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) { setError("Username and password are required"); return; }

    setLoading(true);
    try {
      const res = await api<{ user: { roles: string[] } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          email: username.includes("@") && !username.endsWith("@funt") ? username.trim() : undefined,
          password,
          portal: "support",
        }),
      });
      if (!res.success || !res.data?.user) { setError(res.message ?? "Invalid username or password"); setLoading(false); return; }

      const roles: string[] = res.data.user.roles ?? [];
      const isStaff = roles.some((r) => ["SUPER_ADMIN", "ADMIN", "SUPPORT_AGENT"].includes(r));
      if (!isStaff) { setError("Access denied. Only support staff can use this portal."); setLoading(false); return; }

      router.push("/dashboard");
    } catch { setError("Unable to connect to server"); }
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{ background: "radial-gradient(520px 280px at 50% -8%, rgba(99,102,241,0.20), transparent 70%)" }}
      />

      <div className="relative w-full max-w-[410px] rounded-3xl border border-slate-200/90 bg-white/95 px-7 py-6 shadow-xl ring-1 ring-slate-100/80 sm:px-8 sm:py-7">
        <header className="mb-6 text-center">
          <div className="mx-auto flex flex-col items-center gap-2.5">
            <img src="/funt-logo.png" alt="FUNT Support" className="h-12 w-auto max-w-full object-contain sm:h-14" />
            <div>
              <p className="label-overline text-black/70">FUNT Support</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-800 sm:text-[1.65rem]">Sign in</h1>
            </div>
          </div>
        </header>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Username or Email</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
              className="input font-mono text-black placeholder:text-black/45" placeholder="Username or email" autoComplete="username" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                className="input pr-10 text-black placeholder:text-black/45" placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-black/35 transition hover:bg-black/[0.04] hover:text-black/55"
                aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-1 w-full py-2.5 text-base">
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-600">
            Want to join the support team?{" "}
            <Link href="/signup" className="font-semibold text-indigo-700 hover:underline">Request access</Link>
            {" "}— an admin must approve before you can sign in.
          </p>
        </form>
      </div>
    </div>
  );
}
