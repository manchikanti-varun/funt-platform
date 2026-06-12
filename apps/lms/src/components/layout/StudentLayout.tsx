"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { api, clearToken } from "@/lib/api";
import { STUDENT_ME_REFRESH_EVENT } from "@/lib/studentMeEvents";
import { ROLE } from "@funt-platform/constants";
import {
  IconOverview,
  IconAssignment,
  IconAttendance,
  IconSettings,
  IconSearch,
  IconCourses,
  IconSkills,
  IconProgress,
  IconCertificates,
  IconUser,
  IconShop,
  IconKey,
  IconFaq,
} from "@/components/icons/NavIcons";
import { StateScreen } from "@/components/ui/StateScreen";
import { ProtectionProvider } from "@/components/security/ProtectionContext";
import { ContentProtectionProvider } from "@/components/security/ContentProtectionProvider";

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
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 2);
}

const NAV_SECTIONS: Array<{
  title: string;
  items: Array<{ href: string; label: string; Icon: typeof IconOverview }>;
}> = [
  {
    title: "Learn",
    items: [
      { href: "/dashboard", label: "Overview", Icon: IconOverview },
      { href: "/courses", label: "Courses", Icon: IconCourses },
      { href: "/assignments", label: "Assignments", Icon: IconAssignment },
      { href: "/attendance", label: "Attendance", Icon: IconAttendance },
      { href: "/enroll-license", label: "License key", Icon: IconKey },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/progress", label: "Progress", Icon: IconProgress },
      { href: "/skills", label: "Skills", Icon: IconSkills },
      { href: "/achievements", label: "Achievements", Icon: IconCertificates },
      { href: "/certificates", label: "Certificates", Icon: IconCertificates },
      { href: "/shop", label: "Shop", Icon: IconShop },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/invoices", label: "Invoices", Icon: IconCertificates },
      { href: "/account", label: "Profile details", Icon: IconUser },
      { href: "/faq", label: "FAQ & Help", Icon: IconFaq },
    ],
  },
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
  const displayLevel = user.studentLevel ?? ((user.studentXp ?? 0) > 0 ? Math.floor((user.studentXp ?? 0) / 100) : 0);
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
    <header className="glass-nav sticky top-0 z-30 flex h-16 flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-initial">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 lg:flex-initial">
          <p className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Hi, {user.name}</p>
          <p className="hidden truncate text-xs font-medium text-slate-500 sm:block">{user.username || "FUNT Learn"}</p>
        </div>
      </div>
      <div className="hidden w-full max-w-sm flex-1 px-2 md:block">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <IconSearch className="h-[1.125rem] w-[1.125rem]" />
          </span>
          <input
            type="search"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100/80 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div
          className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 shadow-sm sm:flex"
          title="XP: chapters + approved assignments. Level: +1 per course certificate."
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">XP</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">{user.studentXp ?? 0}</span>
          <span className="h-4 w-px bg-slate-200" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Lv</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">{displayLevel}</span>
        </div>
        <div className="hidden items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 sm:flex">
          <Link href="/shop?shelf=KITS" className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50">
            Kits
          </Link>
          <Link href="/shop?shelf=COMPONENTS" className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50">
            Components
          </Link>
        </div>
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl border border-transparent py-2 pl-2 pr-3 transition hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm"
            aria-expanded={open}
            aria-haspopup="true"
            aria-label="Profile menu"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-[11px] font-semibold text-white shadow-md ring-2 ring-white">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-slate-800 md:inline-block">Menu</span>
            <svg className={`h-4 w-4 text-slate-400 transition duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl shadow-slate-300/25 ring-1 ring-slate-100/90">
              <div className="border-b border-slate-100 px-4 py-3.5">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{user.username}</p>
                <p className="mt-1.5 text-xs font-medium text-indigo-600">
                  Lv {displayLevel} · {user.studentXp ?? 0} XP · {badgeCount} medal
                  {badgeCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="py-1.5">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-indigo-50"
                >
                  <IconUser className="h-5 w-5 shrink-0 text-slate-400" />
                  Profile details
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-indigo-50"
                >
                  <IconSettings className="h-5 w-5 shrink-0 text-slate-400" />
                  Security & activity
                </Link>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setShowQr(true); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-indigo-50"
                >
                  <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
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
                className="fixed inset-0 z-[9999] flex min-h-screen min-w-full items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
                onClick={() => setShowQr(false)}
                role="dialog"
                aria-modal="true"
                aria-label="QR code"
              >
                <div
                  className="w-full max-w-sm shrink-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/25"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Student QR</p>
                  <h3 className="mt-1 text-center text-xl font-extrabold text-slate-900">Share Username</h3>
                  <p className="mt-1 text-center text-sm text-slate-600">Scan this code to share your login username.</p>
                  <p className="mx-auto mt-3 w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-center font-mono text-xs font-semibold tracking-wide text-slate-800">
                    {user.username}
                  </p>
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
                    <div className="flex justify-center rounded-xl bg-white p-2">
                      <QRCodeSVG
                        value={user.username}
                        size={220}
                        level="H"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQr(false)}
                    className="mt-6 w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500"
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

  const refreshUser = useCallback(async () => {
    const r = await api<UserMe>("/api/users/me");
    if (!r.success || !r.data) {
      router.push("/login");
      return;
    }
    if (r.data.roles?.includes(ROLE.PARENT)) {
      router.push("/parent");
      return;
    }
    setUser(r.data);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    refreshUser()
      .catch(() => router.push("/login"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshUser, pathname, router]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void refreshUser().catch(() => {});
    }
    function onMeRefresh() {
      void refreshUser().catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(STUDENT_ME_REFRESH_EVENT, onMeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(STUDENT_ME_REFRESH_EVENT, onMeRefresh);
    };
  }, [refreshUser]);

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
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <StateScreen
          tone="loading"
          title="Checking your account"
          description="Verifying your session and loading your personalized dashboard..."
        />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const sidebar = (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200/90 bg-white shadow-xl shadow-slate-300/10 ring-1 ring-slate-100/80">
      <div className="flex shrink-0 flex-col items-center justify-center border-b border-slate-100/90 bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 px-5 py-7 ring-1 ring-slate-100/50 ring-inset">
        <img
          src="/funt-logo.png"
          alt="FUNT Learn"
          className="h-12 w-auto max-w-full object-contain sm:h-14"
        />
        <span className="mt-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 sm:text-xs">Learn</span>
      </div>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="label-overline px-3 pb-1 pt-2">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                      active
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 ring-1 ring-indigo-700/20"
                        : "text-slate-600 hover:bg-indigo-50/70 hover:text-slate-900 hover:ring-1 hover:ring-indigo-200/80"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <ProtectionProvider>
      <ContentProtectionProvider>
        <div className="flex h-screen min-h-screen overflow-hidden bg-slate-50">
          {}
          <div className="hidden h-full shrink-0 lg:block">{sidebar}</div>
          {}
          {sidebarOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/40 lg:hidden"
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
            <main id="lms-main-content" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-gradient-to-b from-transparent via-indigo-50/20 to-slate-100/60 p-4 text-slate-800 sm:p-6 md:p-8">{children}</main>
          </div>
        </div>
      </ContentProtectionProvider>
    </ProtectionProvider>
  );
}
