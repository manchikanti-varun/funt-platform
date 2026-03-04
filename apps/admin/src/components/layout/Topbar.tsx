"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearToken, api } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { ROLE } from "@funt-platform/constants";

interface TopbarProps {
  user: { name: string; funtId: string; roles: string[] };
  onMenuClick?: () => void;
}

function getPanelLabel(roles: string[]): string {
  if (roles?.includes(ROLE.SUPER_ADMIN)) return "Super Admin";
  if (roles?.includes(ROLE.TRAINER)) return "Trainer";
  return "Admin";
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
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
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Change password"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-400/20 ring-1 ring-slate-200/60"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">Change password</h3>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="cp-current" className="block text-xs font-medium text-slate-600">Current password</label>
            <input
              id="cp-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="cp-new" className="block text-xs font-medium text-slate-600">New password</label>
            <input
              id="cp-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="cp-confirm" className="block text-xs font-medium text-slate-600">Confirm new password</label>
            <input
              id="cp-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Topbar({ user, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  function handleLogout() {
    setOpen(false);
    clearToken();
    router.push("/login");
    router.refresh();
  }

  const initials = getInitials(user.name);
  const primaryRole = user.roles?.[0] ?? "Admin";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[4.25rem] items-center justify-between border-b border-slate-200/90 bg-white/98 px-4 backdrop-blur-md shadow-lg shadow-slate-300/10 ring-1 ring-slate-100/80 sm:px-6">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="h-8 w-px bg-slate-200 lg:block hidden" aria-hidden />
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              FUNT Robotics
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {getPanelLabel(user.roles)}
            </span>
          </div>
        </div>

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-3 rounded-xl py-2 pl-2 pr-3 transition hover:bg-slate-50"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-semibold text-white shadow-lg shadow-teal-900/20 ring-2 ring-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-800">
                {user.name}
              </p>
              <p className="text-[11px] font-mono font-medium text-slate-500">
                {user.funtId}
              </p>
            </div>
            <svg
              className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-200/90 bg-white py-2 shadow-2xl shadow-slate-400/20 ring-1 ring-slate-200/60">
              <div className="border-b border-slate-100 px-4 py-3.5">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.name}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">{user.funtId}</p>
                <p className="mt-1 text-[11px] capitalize text-slate-400">
                  {primaryRole.replace("_", " ")}
                </p>
              </div>
              <div className="py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowQr(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <svg
                    className="h-5 w-5 shrink-0 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5h4v4H3V5zm7 0h4v4h-4V5zm7 0h4v4h-4v-4zM3 12h4v4H3v-4zm7 0h4v4h-4v-4zm7 0h4v4h-4v-4zM3 19h4v4H3v-4zm7 0h4v4h-4v-4zm7 0h4v4h-4v-4z"
                    />
                  </svg>
                  Admin QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowChangePassword(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <svg
                    className="h-5 w-5 shrink-0 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  Change password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <svg
                    className="h-5 w-5 shrink-0 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {showQr && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Admin QR code"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-400/20 ring-1 ring-slate-200/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-center text-lg font-semibold text-slate-800">
              Admin QR
            </h3>
            <p className="mt-1 text-center text-sm text-slate-600">
              Scan to share FUNT ID
            </p>
            <p className="mt-1 text-center font-mono text-sm font-medium text-slate-800">
              {user.funtId}
            </p>
            <div className="mt-6 flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={user.funtId} size={220} level="H" />
            </div>
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="mt-6 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </>
  );
}
