"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { api, getToken, clearToken } from "@/lib/api";
import { parseJwtPayload, isTokenExpired } from "@/lib/auth";
import { ROLE } from "@funt-platform/constants";
import {
  IconOverview,
  IconAssignment,
  IconAttendance,
  IconSettings,
  IconSearch,
  IconCourses,
  IconSkills,
  IconCertificates,
  IconUser,
} from "@/components/icons/NavIcons";

interface UserMe {
  id: string;
  funtId: string;
  name: string;
  email?: string;
  mobile: string;
  roles: string[];
  status: string;
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 2);
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", Icon: IconOverview },
  { href: "/courses", label: "Courses", Icon: IconCourses },
  { href: "/assignments", label: "Assignments", Icon: IconAssignment },
  { href: "/attendance", label: "Attendance", Icon: IconAttendance },
  { href: "/skills", label: "Skills", Icon: IconSkills },
  { href: "/certificates", label: "Certificates", Icon: IconCertificates },
];

function LMSTopbar({
  user,
  badgeCount = 0,
  onLogout,
  onMenuClick,
}: {
  user: UserMe;
  badgeCount?: number;
  onLogout: () => void;
  onMenuClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  const initials = getInitials(user.name);
  return (
    <header className="sticky top-0 z-30 flex h-[4.25rem] flex-wrap items-center justify-between gap-4 border-b border-slate-200/90 bg-white/98 px-4 shadow-lg shadow-slate-300/10 ring-1 ring-slate-100/80 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-initial">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 lg:flex-initial">
          <p className="truncate text-base font-semibold tracking-tight text-slate-800 sm:text-lg">Hi, {user.name}</p>
          <p className="hidden truncate text-xs font-medium text-slate-500 sm:block">FUNT Learn</p>
        </div>
      </div>
      <div className="hidden w-full flex-1 max-w-sm px-2 md:block">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <IconSearch className="h-[1.125rem] w-[1.125rem]" />
          </span>
          <input
            type="search"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/15"
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Settings"
        >
          <IconSettings className="h-5 w-5" />
        </Link>
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl py-2 pl-2 pr-3 transition hover:bg-slate-50"
            aria-expanded={open}
            aria-haspopup="true"
            aria-label="Profile menu"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-700 text-[11px] font-semibold text-white shadow-lg shadow-teal-900/25 ring-2 ring-white">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 md:inline-block">Profile</span>
            <svg className={`h-4 w-4 text-slate-400 transition duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-200/90 bg-white py-2 shadow-2xl shadow-slate-400/20 ring-1 ring-slate-200/60">
              <div className="border-b border-slate-100 px-4 py-3.5">
                <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{user.funtId}</p>
                <p className="mt-1.5 text-xs font-medium text-amber-600">{badgeCount} badge{badgeCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="py-1.5">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <IconUser className="h-5 w-5 shrink-0 text-slate-500" />
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setShowQr(true); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <svg className="h-5 w-5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR code
                </button>
                <div className="my-1.5 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => { setOpen(false); onLogout(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
          {showQr &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed inset-0 z-[9999] flex min-h-screen min-w-full items-center justify-center bg-slate-900/50 p-4"
                onClick={() => setShowQr(false)}
                role="dialog"
                aria-modal="true"
                aria-label="QR code"
              >
<div
                className="w-full max-w-sm shrink-0 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-400/20 ring-1 ring-slate-200/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-center text-lg font-semibold text-slate-800">FUNT ID</h3>
                  <p className="mt-1 text-center text-sm text-slate-600">Scan to share</p>
                  <p className="mt-1 text-center font-mono text-sm font-medium text-slate-800">{user.funtId}</p>
                  <div className="mt-6 flex justify-center rounded-xl bg-white p-4">
                    <QRCodeSVG
                      value={user.funtId}
                      size={220}
                      level="H"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQr(false)}
                    className="mt-6 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>
    </header>
  );
}

export function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const payload = parseJwtPayload(token);
    if (!payload || isTokenExpired(payload)) {
      router.push("/login");
      return;
    }
    if (payload.roles?.includes(ROLE.PARENT)) {
      router.push("/parent");
      return;
    }
    api<UserMe>("/api/users/me")
      .then((r) => {
        if (r.success && r.data) setUser(r.data);
        else router.push("/login");
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    api<unknown[]>("/api/achievements/me")
      .then((r) => setBadgeCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => setBadgeCount(0));
  }, [user]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const sidebar = (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200/90 bg-white shadow-xl shadow-slate-300/10 ring-1 ring-slate-100/80">
      <div className="flex shrink-0 flex-col items-center justify-center border-b border-slate-100 bg-gradient-to-b from-teal-50/40 to-white px-5 py-7 ring-1 ring-slate-100/50 ring-inset">
        {}
        <img src="/funt-logo.png" alt="FUNT Learn" className="h-12 w-auto object-contain sm:h-14" />
        <span className="mt-2.5 font-brand-learn text-lg font-semibold tracking-[0.2em] text-slate-700 sm:text-xl">Learn</span>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                active
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-900/15 ring-1 ring-teal-700/20"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:ring-1 hover:ring-slate-200/80"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-slate-50/80">
      {}
      <div className="hidden h-full shrink-0 lg:block">{sidebar}</div>
      {}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl lg:hidden">
            {sidebar}
          </div>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col min-h-0 overflow-hidden">
        <LMSTopbar
          user={user}
          badgeCount={badgeCount}
          onLogout={() => { clearToken(); router.push("/login"); }}
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-gradient-to-b from-slate-50/90 to-slate-100/60 p-4 text-slate-800 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
