"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "@/lib/api";

import logoSrc from "@/assets/funt-logo.png";

function ParentLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/parent";
  const [studentFuntId, setStudentFuntId] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await api<{ token: string }>("/api/auth/parent-login", {
      method: "POST",
      body: JSON.stringify({ studentFuntId, mobile }),
    });
    setLoading(false);
    if (!res.success || !res.data?.token) {
      setError(res.message ?? "Invalid credentials");
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
          <img src={typeof logoSrc === "string" ? logoSrc : (logoSrc as { src: string }).src} alt="FUNT LEARN" className="h-16 w-auto object-contain" />
          <span className="mt-1 font-brand-learn text-xl tracking-[0.2em] text-black sm:text-2xl">LEARN</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Student FUNT ID</label>
            <input value={studentFuntId} onChange={(e) => setStudentFuntId(e.target.value)} required className="input font-mono" placeholder="Student FUNT ID" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mobile</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} required className="input" placeholder="Mobile" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Student? <Link href="/login" className="font-medium text-teal-600 hover:text-teal-700">Sign in as student</Link>
        </p>
      </div>
    </div>
  );
}

export default function ParentLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" /></div>}>
      <ParentLoginForm />
    </Suspense>
  );
}
