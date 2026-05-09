"use client";

import { useState } from "react";
import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportWhatsAppHref } from "@/lib/support";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ForgotUsernamePage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!isValidEmailFormat(email)) {
      setErr("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((data as { message?: string }).message ?? "Could not look up email");
        return;
      }
      const u = (data as { data?: { username?: string | null } }).data;
      if (u?.username) {
        setMsg(`Your username is: ${u.username}`);
      } else {
        setMsg("No username is set on this account. Please contact support for help.");
      }
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-funt-paper p-4">
      <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-soft">
        <h1 className="text-center text-lg font-bold text-funt-ink">Forgot username</h1>
        <p className="mt-2 text-center text-sm text-black/60">
          Enter your registered email. We will show the username linked to it.
        </p>
        <p className="mt-3 text-center text-xs leading-relaxed text-black/50">
          Forgot your password? Chat on{" "}
          <a
            href={supportWhatsAppHref("Hi, I need help resetting my FUNT Learn password.")}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-funt-ink underline decoration-funt-gold"
          >
            WhatsApp {SUPPORT_WHATSAPP_DISPLAY}
          </a>{" "}
          or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-funt-ink underline decoration-funt-gold">
            {SUPPORT_EMAIL}
          </a>
          . If you know your current password, change it under Learn → Profile after signing in.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input text-black placeholder:text-black/45"
              placeholder="Enter your email address"
            />
            {email.trim() && !isValidEmailFormat(email) && (
              <p className="mt-1 text-xs text-rose-700">Enter a valid email address</p>
            )}
          </div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {msg && <p className="rounded-lg bg-funt-gold/15 px-3 py-2 text-sm text-funt-ink">{msg}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Looking up…" : "Show my username"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-black/50">
          <Link href="/login" className="font-medium text-funt-ink underline decoration-funt-gold">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
