"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { FormPanel } from "@/components/ui/FormPanel";
import {
  clearParentSession,
  setParentMobileSession,
  setParentSelectedStudentSession,
} from "@/lib/parentSelection";

const COUNTRY_CODES = ["+91", "+1", "+44", "+61", "+971", "+65"];

interface LinkedStudent {
  username: string;
  name: string;
  grade?: string;
  schoolName?: string;
}

export function ParentLinkedStudentsPicker({
  title = "Parent profiles",
  heading = "Choose a student to view",
  subtitle = "Enter your phone number once, then select the child you want to track.",
}: {
  title?: string;
  heading?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [parentName, setParentName] = useState("");
  const [profiles, setProfiles] = useState<LinkedStudent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState("");

  const normalizedMobile = useMemo(() => `${countryCode}${mobileNumber.trim()}`, [countryCode, mobileNumber]);

  function handleExitToStudent() {
    clearParentSession();
    router.push("/login");
  }

  async function fetchProfiles(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setProfiles([]);
    setParentName("");
    setSelectedUsername("");

    const res = await api<{ parentName: string; students: LinkedStudent[] }>("/api/auth/parent-linked-students", {
      method: "POST",
      body: JSON.stringify({ mobile: normalizedMobile }),
    });

    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.message ?? "Could not find linked profiles");
      return;
    }

    setParentMobileSession(normalizedMobile);
    setParentName(res.data.parentName ?? "");
    setProfiles(res.data.students ?? []);

    if ((res.data.students ?? []).length === 0) {
      setError("No linked student profiles found for this number.");
    }
  }

  async function openProfile(username: string) {
    if (!normalizedMobile) return;
    setError("");
    setLoading(true);
    const res = await api<{ success?: boolean }>("/api/auth/parent-delegate-session", {
      method: "POST",
      body: JSON.stringify({ mobile: normalizedMobile, studentUsername: username }),
    });
    setLoading(false);
    if (!res.success) {
      setError(res.message ?? "Could not start a secure parent session. Try again.");
      return;
    }
    setParentMobileSession(normalizedMobile);
    setParentSelectedStudentSession(username);
    router.push("/parent/dashboard");
  }

  return (
    <FormPanel className="w-full max-w-xl rounded-3xl border border-funt-gold/20 bg-white/95 p-7 shadow-xl shadow-funt-gold/10 sm:p-8">
      <div className="mb-6 text-center">
        <p className="label-overline text-black/70">{title}</p>
        <h1 className="mt-1 text-2xl font-black text-black">{heading}</h1>
        <p className="mt-2 text-sm text-black/65">{subtitle}</p>
      </div>

      <form onSubmit={fetchProfiles} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-black">Parent phone number *</label>
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
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.515a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <input
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, ""))}
              required
              className="input text-black placeholder:text-black/45"
              placeholder="Enter mobile number"
              autoComplete="tel"
            />
          </div>
        </div>

        {error && <p className="rounded-lg border border-amber-900/15 bg-funt-honey px-3 py-2 text-sm text-black">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-base">
          {loading ? "Fetching profiles..." : "Get linked profiles"}
        </button>
      </form>

      {profiles.length > 0 && (
        <div className="mt-6 space-y-3 rounded-2xl border border-black/10 bg-gradient-to-b from-white to-[#fffdf6] p-4">
          <p className="text-sm font-semibold text-black">
            {parentName ? `${parentName}'s linked students` : "Linked students"}
          </p>

          <div className="space-y-2">
            {profiles.map((s) => (
              <button
                key={s.username}
                type="button"
                onClick={() => {
                  setSelectedUsername(s.username);
                  void openProfile(s.username);
                }}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-left transition hover:border-funt-gold/40 hover:bg-funt-butter/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-black">{s.name}</p>
                    <p className="font-mono text-xs text-black/55">{s.username}</p>
                    {(s.grade || s.schoolName) && (
                      <p className="mt-1 text-[11px] text-black/45">
                        {[s.grade, s.schoolName].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-funt-ink">
                    {selectedUsername === s.username ? "Opening..." : "Open"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-sm text-black/55">
        Student?{" "}
        <Link
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            handleExitToStudent();
          }}
          className="font-medium text-funt-ink hover:text-black"
        >
          Sign in as student
        </Link>
      </p>
    </FormPanel>
  );
}

