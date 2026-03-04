"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setToken } from "@/lib/api";

import logoSrc from "@/assets/funt-logo.png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472";
const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return "Password must contain at least one special character";
  return null;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [grade, setGrade] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPreviewError("");
      try {
        const res = await fetch(`${API_BASE}/api/auth/google/signup-preview?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.email) {
          setEmail(data.email);
          setName(data.name ?? "");
        } else if (!cancelled) {
          setPreviewError(data.message ?? "Invalid or expired signup link. Please sign in with Google again.");
        }
      } catch {
        if (!cancelled) setPreviewError("Could not load signup form. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, router]);

  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!name.trim()) {
      setSubmitError("Full name is required");
      return;
    }
    if (!mobile.trim()) {
      setSubmitError("Parent phone number is required");
      return;
    }
    if (!schoolName.trim()) {
      setSubmitError("School name is required");
      return;
    }
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const err = validatePassword(password);
    if (err) {
      setSubmitError(err);
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/signup-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupToken: token,
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          class: grade || undefined,
          schoolName: schoolName.trim(),
          city: city.trim() || undefined,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        setToken(data.token);
        router.replace("/dashboard");
        router.refresh();
      } else {
        setSubmitError(data.message ?? "Sign up failed. Try again.");
      }
    } catch {
      setSubmitError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return null;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50/40">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }
  if (previewError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50/40 p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft text-center">
          <p className="text-slate-600 mb-4">{previewError}</p>
          <Link href="/login" className="text-teal-600 font-semibold hover:underline">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50/40 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center justify-center">
          <img src={typeof logoSrc === "string" ? logoSrc : (logoSrc as { src: string }).src} alt="FUNT LEARN" className="h-14 w-auto object-contain" />
          <span className="mt-1 font-brand-learn text-xl tracking-[0.2em] text-black">LEARN</span>
        </div>
        <h1 className="text-center text-lg font-semibold text-slate-800">
          {step === 1 ? "Complete your profile" : "Set your password"}
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          {step === 1 ? "Fill in your details to create your account." : "Use at least one uppercase, one lowercase, one number, one special character (min 8 characters)."}
        </p>

        {step === 1 ? (
          <form onSubmit={handleStep1Next} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full Name (Required)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input w-full"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email (from Google)</label>
              <input
                type="email"
                value={email}
                readOnly
                className="input w-full bg-slate-50 text-slate-600"
                aria-readonly
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Parent Phone Number</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="input w-full"
                placeholder="Parent phone number"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Class</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="input w-full appearance-none bg-white"
              >
                <option value="">Select class</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">School Name (Required)</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
                className="input w-full"
                placeholder="School name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input w-full"
                placeholder="City"
              />
            </div>
            {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
            <button type="submit" className="btn-primary w-full">Next: Set password</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input w-full pr-10"
                  placeholder="Min 8 chars, 1 upper, 1 lower, 1 number, 1 special"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
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
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input w-full"
                placeholder="Confirm password"
              />
            </div>
            {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-medium text-teal-600 hover:text-teal-700">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
