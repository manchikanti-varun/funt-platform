"use client";

import { useState } from "react";
import Link from "next/link";

export default function SupportSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!name.trim() || !email.trim() || !mobile.trim() || !password.trim()) { setError("All fields are required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!/[A-Z]/.test(password)) { setError("Password must contain at least one uppercase letter"); return; }
    if (!/[a-z]/.test(password)) { setError("Password must contain at least one lowercase letter"); return; }
    if (!/[0-9]/.test(password)) { setError("Password must contain at least one number"); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError("Password must contain at least one special character"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/support-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), mobile: mobile.trim(), city: city.trim() || undefined, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) setSuccess("Your request has been submitted! An admin will review and approve your account.");
      else setError(data.message ?? "Signup failed");
    } catch { setError("Unable to connect to server"); }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 p-4">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden style={{ background: "radial-gradient(520px 280px at 50% -8%, rgba(99,102,241,0.20), transparent 70%)" }} />
        <div className="relative w-full max-w-[410px] rounded-3xl border border-slate-200/90 bg-white/95 px-7 py-8 shadow-xl ring-1 ring-slate-100/80 text-center">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Request Submitted</h2>
          <p className="mt-2 text-sm text-slate-500">{success}</p>
          <Link href="/login" className="mt-6 inline-block btn-primary px-6 py-2.5">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 p-4">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden style={{ background: "radial-gradient(520px 280px at 50% -8%, rgba(99,102,241,0.20), transparent 70%)" }} />

      <div className="relative w-full max-w-[460px] rounded-3xl border border-slate-200/90 bg-white/95 px-7 py-6 shadow-xl ring-1 ring-slate-100/80 sm:px-8 sm:py-7">
        <header className="mb-6 text-center">
          <img src="/funt-logo.png" alt="FUNT Support" className="mx-auto h-12 w-auto object-contain sm:h-14" />
          <p className="mt-2 label-overline text-black/70">FUNT Support</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-800">Request Access</h1>
          <p className="mt-1 text-sm text-slate-500">Submit your details. An admin will review and approve.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800">{error}</p>}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Full Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Your full name" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="your@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Mobile *</label>
              <input type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, ""))} className="input" placeholder="9876543210" maxLength={14} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Password *</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Min 8 chars, upper+lower+number+special" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Confirm Password *</label>
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" placeholder="Repeat password" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary mt-1 w-full py-2.5 text-base">
            {loading ? "Submitting…" : "Request Account"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-indigo-700 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
