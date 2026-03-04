"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface LoginEntry {
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

interface UserMe {
  id: string;
  funtId: string;
  name: string;
  email?: string;
  mobile: string;
  roles: string[];
  status: string;
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
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
          className="w-fit rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
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
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Account</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-800">Profile & settings</h1>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Profile card */}
        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-teal-600">Identity</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-800">Profile</h2>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-700 text-lg font-semibold text-white shadow-sm ring-2 ring-slate-100">
              {initials}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="truncate text-lg font-semibold text-slate-800">{user.name}</p>
              <p className="mt-0.5 font-mono text-sm text-slate-500">{user.funtId}</p>
              <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {user.status}
              </span>
            </div>
          </div>
        </section>

        {/* Badges card */}
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

        {/* Contact & account */}
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

        {/* Change password */}
        <ChangePasswordSection />

        {/* Last login + Login history combined - spans full width on second row */}
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
