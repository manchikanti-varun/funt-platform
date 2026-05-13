"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL, markClientLoggedIn } from "@/lib/api";
import { FormPanel } from "@/components/ui/FormPanel";


const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12", "other"];
const COUNTRY_CODES = ["+91", "+1", "+44", "+61", "+971", "+65"];
const USERNAME_MIN_LENGTH = 4;
const USERNAME_MAX_LENGTH = 32;
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{3,31}$/;

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return "Password must contain at least one special character";
  return null;
}

function passwordStrength(password: string) {
  const lengthOk = password.length >= 8;
  const upperOk = /[A-Z]/.test(password);
  const lowerOk = /[a-z]/.test(password);
  const numberOk = /[0-9]/.test(password);
  const specialOk = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const score = [lengthOk, upperOk, lowerOk, numberOk, specialOk].filter(Boolean).length; // 0..5
  const pct = Math.round((score / 5) * 100);

  if (score <= 1) return { score, pct, label: "Very weak", hint: "Use 8+ characters and mix types." };
  if (score === 2) return { score, pct, label: "Weak", hint: "Add more character variety for safety." };
  if (score === 3) return { score, pct, label: "Good", hint: "Almost there — finish the remaining rule(s)." };
  if (score === 4) return { score, pct, label: "Strong", hint: "Great — this looks secure." };
  return { score, pct, label: "Very strong", hint: "Excellent password strength." };
}

function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function validateUsername(value: string): string | null {
  const normalized = normalizeUsername(value);
  if (!normalized) return null;
  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`;
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return "Use lowercase letters, numbers, dot (.), underscore (_) or hyphen (-)";
  }
  if (normalized.endsWith("@funt")) {
    return "This username is reserved";
  }
  return null;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isGoogleFlow = !!token;

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [address, setAddress] = useState("");
  const [grade, setGrade] = useState("");
  const [gradeOther, setGradeOther] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });

  const strength = passwordStrength(password);
  const lengthOk = password.length >= 8;
  const upperOk = /[A-Z]/.test(password);
  const lowerOk = /[a-z]/.test(password);
  const numberOk = /[0-9]/.test(password);
  const specialOk = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPreviewError("");
      try {
        const res = await fetch(`${API_URL}/api/auth/google/signup-preview?token=${encodeURIComponent(token)}`);
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

  useEffect(() => {
    const candidate = normalizeUsername(username);
    if (!candidate) {
      setUsernameStatus({ checking: false, available: null, message: "" });
      return;
    }
    const validationError = validateUsername(candidate);
    if (validationError) {
      setUsernameStatus({ checking: false, available: false, message: validationError });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUsernameStatus((s) => ({ ...s, checking: true }));
      try {
        const res = await fetch(
          `${API_URL}/api/auth/username-availability?username=${encodeURIComponent(candidate)}`,
          { signal: controller.signal }
        );
        const json = (await res.json().catch(() => ({}))) as {
          available?: boolean;
          message?: string;
          data?: { available?: boolean; message?: string };
        };
        if (!res.ok) {
          setUsernameStatus({
            checking: false,
            available: null,
            message: json.message ?? "Could not verify username right now. Try again.",
          });
          return;
        }
        const availableRaw = json.available ?? json.data?.available;
        if (typeof availableRaw !== "boolean") {
          setUsernameStatus({
            checking: false,
            available: null,
            message: json.message ?? "Could not verify username right now. Try again.",
          });
          return;
        }
        const available = availableRaw;
        setUsernameStatus({
          checking: false,
          available,
          message:
            available ? "\u2713 Username available" : "\u2717 Username not available",
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setUsernameStatus({ checking: false, available: null, message: "" });
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [username]);

  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!name.trim()) {
      setSubmitError("Full name is required");
      return;
    }
    if (!mobileNumber.trim()) {
      setSubmitError("Parent phone number is required");
      return;
    }
    if (!/^\d{6,15}$/.test(mobileNumber.trim())) {
      setSubmitError("Enter a valid mobile number");
      return;
    }
    if (!username.trim()) {
      setSubmitError("Username is required");
      return;
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      setSubmitError(usernameError);
      return;
    }
    if (usernameStatus.available === false) {
      setSubmitError(usernameStatus.message || "Please choose a different username");
      return;
    }
    if (!isGoogleFlow && !isValidEmailFormat(email)) {
      setSubmitError("Enter a valid email address");
      return;
    }
    const ageNum = parseInt(age, 10);
    if (!age || Number.isNaN(ageNum) || ageNum < 7) {
      setSubmitError("Age is required (minimum 7 years)");
      return;
    }
    if (!address.trim()) {
      setSubmitError("Address is required");
      return;
    }
    if (!schoolName.trim()) {
      setSubmitError("School / college name is required");
      return;
    }
    if (grade === "other" && !gradeOther.trim()) {
      setSubmitError("Please enter your grade, degree, or year");
      return;
    }
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent, options?: { skipPassword?: boolean }) {
    e.preventDefault();
    setSubmitError("");
    // Google flow allows skipping password entirely (sign in with Google only).
    // Non-Google flow always requires a password.
    const skipPassword = !!(options?.skipPassword && isGoogleFlow);
    if (!skipPassword) {
      const err = validatePassword(password);
      if (err) {
        setSubmitError(err);
        return;
      }
      if (password !== confirmPassword) {
        setSubmitError("Passwords do not match");
        return;
      }
    }
    setSubmitting(true);
    try {
      const endpoint = isGoogleFlow ? `${API_URL}/api/auth/google/signup-complete` : `${API_URL}/api/auth/signup`;
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isGoogleFlow ? { signupToken: token } : {}),
          username: normalizeUsername(username),
          name: name.trim(),
          email: email.trim(),
          mobile: `${countryCode}${mobileNumber.trim()}`,
          age: parseInt(age, 10),
          address: address.trim(),
          class: grade || undefined,
          gradeOther: grade === "other" ? gradeOther.trim() : undefined,
          schoolName: schoolName.trim(),
          city: city.trim() || undefined,
          ...(skipPassword ? {} : { password }),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
        data?: { user?: unknown };
      };
      if (res.ok) {
        markClientLoggedIn();
        router.replace("/dashboard");
        router.refresh();
      } else {
        setSubmitError(data.message ?? data.error ?? `Sign up failed (${res.status}). Try again.`);
      }
    } catch {
      setSubmitError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-funt-paper">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    );
  }
  if (isGoogleFlow && previewError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-funt-paper p-4">
        <FormPanel className="w-full max-w-md rounded-3xl p-8 text-center">
          <p className="mb-4 text-black/65">{previewError}</p>
          <Link href="/login" className="font-semibold text-funt-ink underline decoration-funt-gold underline-offset-2">Back to Sign In</Link>
        </FormPanel>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-funt-paper p-4">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden style={{ background: "radial-gradient(560px 280px at 50% -8%, rgba(212,175,55,0.2), transparent 70%)" }} />
      <FormPanel className="relative w-full max-w-3xl rounded-3xl p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center justify-center">
          <img src="/funt-logo.png" alt="FUNT LEARN" className="h-14 w-auto max-w-full object-contain" />
          <span className="mt-1 font-brand-learn text-xl tracking-[0.2em] text-black">LEARN</span>
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-black">
          {step === 1 ? "Complete your profile" : "Set your password"}
        </h1>
        <p className="mt-1 text-center text-sm text-black/60">
          {step === 1 ? "Fill in your details to create your account." : "Set a strong password to secure your account."}
        </p>
        <div className="mx-auto mt-4 max-w-xl">
          <div className="h-2 w-full rounded-full bg-black/10">
            <div className={`h-2 rounded-full bg-funt-gold-deep transition-all ${step === 1 ? "w-1/2" : "w-full"}`} />
          </div>
          <p className="mt-1 text-center text-xs text-black/55">Step {step} of 2</p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1Next} className="mx-auto mt-6 max-w-2xl space-y-5">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Account</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Username *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="input w-full text-black placeholder:text-black/45"
                placeholder="Choose a username"
                autoComplete="username"
              />
              <p className="mt-1 text-xs text-black/50">
                Allowed: 4-32 chars, lowercase letters, numbers, dot (.), underscore (_) or hyphen (-). Example:
                {" "}user.name, user_123, user-dev
              </p>
              {username.trim() ? (
                <p
                  className={`mt-1 text-xs ${
                    usernameStatus.available === true
                      ? "text-emerald-700"
                      : usernameStatus.available === false
                        ? "text-rose-700"
                        : "text-black/50"
                  }`}
                >
                  {usernameStatus.checking ? "Checking availability..." : usernameStatus.message}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input w-full text-black placeholder:text-black/45"
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                {isGoogleFlow ? "Email (from Google) *" : "Email *"}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={isGoogleFlow}
                required
                className={`input w-full text-black placeholder:text-black/45 ${isGoogleFlow ? "bg-black/[0.03] text-black/65" : ""}`}
                placeholder="Enter your email address"
                aria-readonly={isGoogleFlow}
              />
              {!isGoogleFlow && email.trim() && !isValidEmailFormat(email) && (
                <p className="mt-1 text-xs text-rose-700">Enter a valid email address</p>
              )}
            </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Student Details</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Parent Phone Number *</label>
              <div className="grid grid-cols-[120px,1fr] gap-2">
                <div className="relative">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="input w-full appearance-none pr-9 text-black"
                    aria-label="Country code"
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.515a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, ""))}
                  className="input w-full text-black placeholder:text-black/45"
                  placeholder="Enter mobile number"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Age *</label>
              <input
                type="number"
                min={7}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                className="input w-full text-black placeholder:text-black/45"
                placeholder="Enter your age"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Address *</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                rows={3}
                className="input w-full resize-y text-black placeholder:text-black/45"
                placeholder="Enter your address"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Class</label>
              <div className="relative">
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="input w-full appearance-none pr-9 text-black"
                >
                  <option value="">Select class</option>
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c === "other" ? "Other (above 12 / college)" : c}
                    </option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.515a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            {grade === "other" && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-black">Describe your grade / program</label>
                <input
                  type="text"
                  value={gradeOther}
                  onChange={(e) => setGradeOther(e.target.value)}
                  className="input w-full text-black placeholder:text-black/45"
                  placeholder="Enter your grade or program"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">School / college name *</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
                className="input w-full text-black placeholder:text-black/45"
                placeholder="Enter school or college name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input w-full text-black placeholder:text-black/45"
                placeholder="Enter your city"
              />
            </div>
              </div>
            </div>
            {submitError && <p className="rounded-lg border border-amber-900/15 bg-funt-honey px-3 py-2 text-sm text-black">{submitError}</p>}
            <button type="submit" className="btn-primary w-full">Next: Set password</button>
          </form>
        ) : (
          <form onSubmit={(e) => handleSubmit(e)} className="mx-auto mt-6 max-w-lg space-y-4 rounded-2xl border border-black/10 bg-white/70 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Security</p>
            {isGoogleFlow && (
              <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs text-black/65">
                Since you signed up with Google, setting a password is optional. You can always set one later from your profile.
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Password {isGoogleFlow ? "(optional)" : "*"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  required={!isGoogleFlow}
                  className="input w-full pr-10 text-black placeholder:text-black/45"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-black/35 hover:text-black/55"
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

              <div className="mt-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-black/55">Strength: {strength.label}</p>
                  <p className="text-xs font-mono font-semibold text-black/60">{strength.pct}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-funt-gold-deep to-funt-gold"
                    style={{ width: `${Math.min(100, Math.max(0, strength.pct))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-black/55">{strength.hint}</p>

                <ul className="mt-2 space-y-1 text-xs">
                  <li className="flex items-center gap-2 text-black/65">
                    <span className={`inline-block h-2 w-2 rounded-full ${lengthOk ? "bg-emerald-500" : "bg-black/20"}`} aria-hidden />
                    8+ characters
                  </li>
                  <li className="flex items-center gap-2 text-black/65">
                    <span className={`inline-block h-2 w-2 rounded-full ${upperOk ? "bg-emerald-500" : "bg-black/20"}`} aria-hidden />
                    Uppercase (A-Z)
                  </li>
                  <li className="flex items-center gap-2 text-black/65">
                    <span className={`inline-block h-2 w-2 rounded-full ${lowerOk ? "bg-emerald-500" : "bg-black/20"}`} aria-hidden />
                    Lowercase (a-z)
                  </li>
                  <li className="flex items-center gap-2 text-black/65">
                    <span className={`inline-block h-2 w-2 rounded-full ${numberOk ? "bg-emerald-500" : "bg-black/20"}`} aria-hidden />
                    Number (0-9)
                  </li>
                  <li className="flex items-center gap-2 text-black/65">
                    <span className={`inline-block h-2 w-2 rounded-full ${specialOk ? "bg-emerald-500" : "bg-black/20"}`} aria-hidden />
                    Special character
                  </li>
                </ul>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Confirm Password {isGoogleFlow ? "(optional)" : "*"}
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                required={!isGoogleFlow}
                className="input w-full text-black placeholder:text-black/45"
                placeholder="Re-enter your password"
              />
            </div>
            {submitError && <p className="rounded-lg border border-amber-900/15 bg-funt-honey px-3 py-2 text-sm text-black">{submitError}</p>}
            <div className="flex gap-3 pt-1">
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
            {isGoogleFlow && (
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => handleSubmit(e as unknown as React.FormEvent, { skipPassword: true })}
                className="mt-1 w-full text-sm font-medium text-black/60 underline-offset-4 hover:text-black hover:underline disabled:opacity-60"
              >
                Skip — continue with Google only
              </button>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-sm text-black/55">
          Already have an account? <Link href="/login" className="font-medium text-funt-ink hover:text-black">Sign in</Link>
        </p>
      </FormPanel>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-funt-paper">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
