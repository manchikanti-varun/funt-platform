"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

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
  lastLogin?: LoginEntry | null;
  loginHistory?: LoginEntry[];
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 2);
}

const MAX_LOGIN_HISTORY = 4;

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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Password updated successfully." });
    } else {
      setMessage({ type: "error", text: res.message ?? "Failed to update password." });
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:col-span-3 lg:p-6">
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
          className="w-fit rounded-xl bg-funt-gold px-4 py-2.5 text-sm font-medium text-black shadow-sm hover:bg-funt-gold-hover disabled:opacity-60"
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
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    api<UserMe>("/api/users/me?include=loginHistory").then((r) => {
      if (r.success && r.data) setUser(r.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api<unknown[]>("/api/achievements/me")
      .then((r) => setBadgeCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => setBadgeCount(0));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-funt-gold-deep" />
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

  const initials = getInitials(user.name);
  const loginHistory = (user.loginHistory ?? []).slice(0, MAX_LOGIN_HISTORY);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
      <div className="shrink-0 pb-4">
        <p className="text-xs font-black uppercase tracking-wider text-black">Account</p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-black">Profile &amp; settings</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/progress" className="rounded-xl border-2 border-black bg-funt-gold px-4 py-2 text-xs font-bold text-black">
            See full progress
          </Link>
          <Link href="/assignments" className="rounded-xl border-2 border-black/15 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-funt-honey/50">
            Projects / assignments
          </Link>
          <Link href="/skills" className="rounded-xl border-2 border-black/15 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-funt-honey/50">
            Skills
          </Link>
          <Link href="/certificates" className="rounded-xl border-2 border-black/15 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-funt-honey/50">
            Certificates
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {}
        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-funt-gold-deep">Identity</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Profile</h2>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-funt-gold to-funt-gold-deep text-lg font-semibold text-black shadow-sm ring-2 ring-slate-100">
              {initials}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="truncate text-lg font-semibold text-slate-800">{user.name}</p>
              <p className="mt-0.5 font-mono text-sm text-slate-500">{user.username}</p>
              <span className="mt-2 inline-block rounded-full border border-black/15 bg-funt-gold/25 px-2.5 py-0.5 text-xs font-bold text-black">
                {user.status}
              </span>
            </div>
          </div>
        </section>

        {}
        <section className="flex flex-col rounded-2xl border-2 border-black/10 bg-funt-honey/40 p-5 shadow-lg lg:p-6">
          <p className="text-xs font-black uppercase tracking-wider text-black">Rewards</p>
          <h2 className="mt-0.5 text-base font-black tracking-tight text-black">FUNT coins</h2>
          <p className="mt-3 text-4xl font-black tabular-nums text-black">{user.funtCoins ?? 0}</p>
          <p className="mt-2 text-xs text-black/65">
            Coin earning and redemption for kits/components will roll out in a future phase. Your balance may stay at 0 until then. XP and levels above stay active today.
          </p>
        </section>

        {}
        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Badges</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Achievements</h2>
          <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{badgeCount}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              badge{badgeCount === 1 ? "" : "s"} earned
            </p>
          </div>
        </section>

        {}
        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Details</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Contact & account</h2>
          <dl className="mt-4 grid flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {user.email && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-slate-800">{user.email}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Mobile</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-800">{user.mobile}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Status</dt>
              <dd className="mt-0.5">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {user.status}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        {}
        <ChangePasswordSection />

        {}
        <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:col-span-3 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Activity</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Last login & history</h2>
          <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Last login</p>
              {user.lastLogin ? (
                <>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {new Date(user.lastLogin.timestamp).toLocaleString()}
                  </p>
                  {user.lastLogin.userAgent && (
                    <p className="mt-0.5 truncate text-xs text-slate-500" title={user.lastLogin.userAgent}>
                      {user.lastLogin.userAgent}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-500">—</p>
              )}
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Recent logins</p>
              {loginHistory.length > 0 ? (
                <ul className="mt-2 space-y-2 overflow-y-auto">
                  {loginHistory.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <span className="truncate text-xs font-medium text-slate-800">
                        {new Date(e.timestamp).toLocaleString()}
                      </span>
                      {e.userAgent && (
                        <span className="max-w-[140px] truncate text-xs text-slate-500" title={e.userAgent}>
                          {e.userAgent}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No recent logins</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
