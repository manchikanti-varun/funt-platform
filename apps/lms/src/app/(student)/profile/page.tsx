"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, api, clearLegacyJwtStorage, markClientLoggedIn } from "@/lib/api";
import { AppPageShell, PageSection } from "@/components/ui";

interface LoginEntry {
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

interface UserMe {
  id: string;
  username: string;
  name: string;
  email?: string;
  mobile: string;
  roles: string[];
  status: string;
  studentXp?: number;
  studentLevel?: number;
  funtCoins?: number;
  /** Whether this account has a password set. False for Google-only signups. */
  hasPassword?: boolean;
  lastLogin?: LoginEntry | null;
  loginHistory?: LoginEntry[];
}

const MAX_LOGIN_HISTORY = 4;

function SetPasswordPrompt() {
  function handleStart() {
    // Send the user through Google re-auth. After Google verifies them,
    // the backend will redirect to /profile/set-password?token=... where
    // they can choose a new password.
    window.location.href = `${API_URL}/api/auth/google?app=lms&intent=set_password`;
  }
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:col-span-3 lg:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Security</p>
      <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Set a password</h2>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        Your account doesn't have a password yet — you've been signing in with Google. You can
        optionally set a password so you can also sign in with your username and password.
        For your security, we'll first verify it's really you by signing in with Google again.
      </p>
      <button
        type="button"
        onClick={handleStart}
        className="mt-4 w-fit rounded-xl bg-funt-gold px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-funt-gold-hover"
      >
        Verify with Google to set password
      </button>
    </section>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    setLoading(true);
    const res = await api<{ message?: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);
    if (res.success) {
      clearLegacyJwtStorage();
      markClientLoggedIn();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Password updated successfully. Your session was refreshed." });
    } else {
      setMessage({ type: "error", text: res.message ?? "Failed to update password." });
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:col-span-3 lg:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Security</p>
      <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Change password</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex max-w-md flex-col gap-4">
        <div>
          <label htmlFor="current-password" className="block text-xs font-medium text-slate-600">Current password</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-funt-gold focus:outline-none focus:ring-1 focus:ring-funt-gold"
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-xs font-medium text-slate-600">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-funt-gold focus:outline-none focus:ring-1 focus:ring-funt-gold"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-xs font-medium text-slate-600">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-funt-gold focus:outline-none focus:ring-1 focus:ring-funt-gold"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {message && (
          <p className={`text-sm ${message.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded-xl bg-funt-gold px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-funt-gold-hover disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<UserMe>("/api/users/me?include=loginHistory").then((r) => {
      if (r.success && r.data) setUser(r.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <p className="text-slate-500">Unable to load profile.</p>
      </div>
    );
  }

  const loginHistory = (user.loginHistory ?? []).slice(0, MAX_LOGIN_HISTORY);

  return (
    <AppPageShell className="flex h-full min-h-0 flex-col">
      <div className="page-hero shrink-0 pb-4">
        <p className="text-xs font-black uppercase tracking-wider text-black">Security</p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-black">Security &amp; activity</h1>
        <p className="mt-1 text-sm text-black/60">Manage password and review recent login activity.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/account" className="rounded-xl border-2 border-black/15 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-funt-honey/50">
            Profile details
          </Link>
          <Link href="/progress" className="rounded-xl border-2 border-black/15 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-funt-honey/50">
            Progress
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {user.hasPassword === false ? <SetPasswordPrompt /> : <ChangePasswordSection />}

        <PageSection className="flex flex-col bg-white/95 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Session summary</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Current account</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Name:</span> {user.name}
            </p>
            <p>
              <span className="font-medium text-slate-900">Username:</span>{" "}
              <span className="font-mono">{user.username}</span>
            </p>
            <p>
              <span className="font-medium text-slate-900">Status:</span>{" "}
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {user.status}
              </span>
            </p>
            <p>
              <span className="font-medium text-slate-900">Last login:</span>{" "}
              {user.lastLogin ? new Date(user.lastLogin.timestamp).toLocaleString() : "—"}
            </p>
          </div>
        </PageSection>

        <PageSection className="bg-white/95 lg:col-span-3 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Activity</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Last login & history</h2>
          <p className="mt-1 text-xs text-slate-500">Track where and when your account was used recently.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last login</p>
              {user.lastLogin ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {new Date(user.lastLogin.timestamp).toLocaleString()}
                  </p>
                  {user.lastLogin.userAgent && (
                    <p className="mt-1 break-words text-xs text-slate-500" title={user.lastLogin.userAgent}>
                      {user.lastLogin.userAgent}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No login recorded yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent logins</p>
              {loginHistory.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {loginHistory.map((e, i) => (
                    <li key={i} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-slate-800">{new Date(e.timestamp).toLocaleString()}</p>
                      {e.userAgent ? (
                        <p className="mt-0.5 break-words text-[11px] text-slate-500" title={e.userAgent}>
                          {e.userAgent}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No recent logins</p>
              )}
            </div>
          </div>
        </PageSection>
      </div>
    </AppPageShell>
  );
}
