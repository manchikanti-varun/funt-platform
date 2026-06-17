"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, clearLegacyJwtStorage, markClientLoggedIn } from "@/lib/api";
import { AppPageShell, PageSection } from "@/components/ui";

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return "Password must contain at least one special character";
  }
  return null;
}

function SetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setMessage({ type: "error", text: "Missing or invalid set-password link. Please start again from your profile." });
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!token) return;
    const err = validatePassword(newPassword);
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    setLoading(true);
    const res = await api<{ message?: string }>("/api/auth/set-password-google", {
      method: "POST",
      body: JSON.stringify({ setPasswordToken: token, newPassword }),
    });
    setLoading(false);
    if (res.success) {
      clearLegacyJwtStorage();
      markClientLoggedIn();
      setMessage({ type: "success", text: "Password set successfully. Redirecting…" });
      setTimeout(() => {
        router.replace("/profile");
        router.refresh();
      }, 800);
    } else {
      setMessage({ type: "error", text: res.message ?? "Failed to set password." });
    }
  }

  return (
    <AppPageShell className="flex h-full min-h-0 flex-col">
      <div className="page-hero shrink-0 pb-4">
        <p className="text-xs font-black uppercase tracking-wider text-black">Security</p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-black">Set a password</h1>
        <p className="mt-1 text-sm text-black/60">Choose a strong password to add password sign-in to your account.</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <PageSection className="flex flex-col bg-white/95 lg:col-span-3 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">New password</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Choose your password</h2>

          {!token ? (
            <div className="mt-4">
              <p className="text-sm text-red-600">
                Missing or invalid set-password link. Please return to your profile and verify again.
              </p>
              <Link
                href="/profile"
                className="mt-3 inline-block rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to profile
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 flex max-w-md flex-col gap-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-medium text-slate-600">
                  New password
                </label>
                <div className="relative mt-1">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-800 shadow-sm focus:border-funt-gold focus:outline-none focus:ring-1 focus:ring-funt-gold"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  At least 8 characters, with uppercase, lowercase, number, and special character.
                </p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-xs font-medium text-slate-600">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-funt-gold focus:outline-none focus:ring-1 focus:ring-funt-gold"
                  required
                  autoComplete="new-password"
                />
              </div>
              {message && (
                <p
                  className={`text-sm ${
                    message.type === "success" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {message.text}
                </p>
              )}
              <div className="flex gap-3">
                <Link
                  href="/profile"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-funt-gold px-4 py-2.5 text-sm font-medium text-black shadow-sm hover:bg-funt-gold-hover disabled:opacity-60"
                >
                  {loading ? "Saving…" : "Set password"}
                </button>
              </div>
            </form>
          )}
        </PageSection>
      </div>
    </AppPageShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 items-center justify-center">
          <div className="spinner" />
        </div>
      }
    >
      <SetPasswordInner />
    </Suspense>
  );
}
