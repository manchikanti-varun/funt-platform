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

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
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
    <header className="glass-nav sticky top-0 z-30 flex h-16 flex-wrap items-center justify-between gap-4 border-b border-[#e5d9b7] bg-gradient-to-r from-[#fff8e5]/95 via-white/95 to-[#fffef8]/95 px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-initial">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black/60 transition hover:bg-[#f6edd2] hover:text-funt-ink lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 lg:flex-initial">
          <p className="truncate text-base font-semibold tracking-tight text-funt-ink sm:text-lg">Hi, {user.name}</p>
          <p className="hidden truncate text-xs font-medium text-black/50 sm:block">{user.username || "FUNT Learn"}</p>
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
            className="w-full rounded-xl border border-[#e8ddbc] bg-gradient-to-r from-white to-[#fffdf5] py-2.5 pl-10 pr-4 text-sm text-funt-ink placeholder-black/40 shadow-sm ring-1 ring-[#f2e9cc] transition focus:border-funt-gold focus:outline-none focus:ring-2 focus:ring-funt-gold/25"
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div
          className="hidden items-center gap-2 rounded-xl border border-[#e5d8b3] bg-gradient-to-r from-[#fff8de] to-[#fffdf5] px-2.5 py-1.5 shadow-sm sm:flex"
          title="XP: chapters + approved assignments. Level: +1 per course certificate."
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-black/55">XP</span>
          <span className="text-sm font-bold tabular-nums text-funt-ink">{user.studentXp ?? 0}</span>
          <span className="h-4 w-px bg-black/10" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wide text-funt-gold-deep">Lv</span>
          <span className="text-sm font-bold tabular-nums text-funt-ink">{displayLevel}</span>
        </div>
        <div className="hidden items-center gap-0.5 rounded-xl border border-[#e5d8b3] bg-white p-0.5 sm:flex">
          <Link href="/shop?shelf=KITS" className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-funt-ink hover:bg-[#f8efce]">
            Kits
          </Link>
          <Link href="/shop?shelf=COMPONENTS" className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-funt-ink hover:bg-[#f8efce]">
            Components
          </Link>
        </div>
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl border border-transparent py-2 pl-2 pr-3 transition hover:border-[#e5d8b3] hover:bg-[#fff7dc] hover:shadow-sm"
            aria-expanded={open}
            aria-haspopup="true"
            aria-label="Profile menu"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e0be54] to-[#c59b1f] text-[11px] font-semibold text-black shadow-md ring-2 ring-white">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-funt-ink md:inline-block">Menu</span>
            <svg className={`h-4 w-4 text-black/40 transition duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && (
            <div className="glass-nav absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[#e7dbba] bg-gradient-to-b from-white to-[#fffdf6] py-2 shadow-2xl shadow-black/15 ring-1 ring-[#eadfbf]">
              <div className="border-b border-black/5 px-4 py-3.5">
                <p className="truncate text-sm font-semibold text-funt-ink">{user.name}</p>
                <p className="mt-1 font-mono text-xs text-black/50">{user.username}</p>
                <p className="mt-1.5 text-xs font-medium text-funt-gold-deep">
                  Lv {displayLevel} · {user.studentXp ?? 0} XP · {badgeCount} medal
                  {badgeCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="py-1.5">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-funt-ink transition hover:bg-[#fbf2d6]"
                >
                  <IconUser className="h-5 w-5 shrink-0 text-black/50" />
                  Profile details
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-funt-ink transition hover:bg-[#fbf2d6]"
                >
                  <IconSettings className="h-5 w-5 shrink-0 text-black/50" />
                  Security & activity
                </Link>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setShowQr(true); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-funt-ink transition hover:bg-[#fbf2d6]"
                >
                  <svg className="h-5 w-5 shrink-0 text-black/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR code
                </button>
                <div className="my-1.5 border-t border-black/5" />
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
                  className="w-full max-w-sm shrink-0 rounded-3xl border border-[#dcc894] bg-gradient-to-br from-white via-[#fff8e6] to-[#fff1c6] p-6 shadow-[0_24px_50px_rgba(78,60,12,0.28)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d6f14]">Student QR</p>
                  <h3 className="mt-1 text-center text-xl font-extrabold text-black">Share Username</h3>
                  <p className="mt-1 text-center text-sm text-black/65">Scan this code to share your login username.</p>
                  <p className="mx-auto mt-3 w-fit rounded-full border border-[#d9c58d] bg-[#fff6d8] px-3 py-1 text-center font-mono text-xs font-semibold tracking-wide text-black">
                    {user.username}
                  </p>
                  <div className="mt-5 rounded-2xl border border-[#d8c28a] bg-white p-4 shadow-inner">
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
                    className="mt-6 w-full rounded-2xl border border-[#d3bb79] bg-gradient-to-r from-[#e2c25d] to-[#cfa630] py-2.5 text-sm font-semibold text-black shadow-[0_8px_18px_rgba(160,120,20,0.25)] transition hover:brightness-105"
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

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    function onDragStart(e: DragEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName?.toLowerCase();
      if (tag === "img" || tag === "video" || t.closest("img, video")) {
        e.preventDefault();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const blockedInspectShortcuts =
        key === "f12" ||
        (ctrlOrMeta && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (ctrlOrMeta && key === "u") ||
        (ctrlOrMeta && key === "s");
      if (blockedInspectShortcuts) {
        e.preventDefault();
        return;
      }

      // Best-effort protection: cannot truly disable OS screenshots.
      if (key === "printscreen") {
        e.preventDefault();
        void navigator.clipboard?.writeText?.("");
      }

      // Prevent copy/cut on non-editable content in student area.
      if (ctrlOrMeta && (key === "c" || key === "x") && !isEditableTarget(e.target)) {
        e.preventDefault();
      }
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-funt-paper p-4 sm:p-6">
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
    <aside className="glass-nav flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-[#e5d9b8] bg-gradient-to-b from-[#fff9e9] via-white to-[#fffdf6] shadow-xl shadow-[#b7932a]/10">
      <div className="flex shrink-0 flex-col items-center justify-center border-b border-[#eee2c3] bg-gradient-to-b from-[#fff4cd] to-[#fff9e7] px-5 py-7">
        <img
          src="/funt-logo.png"
          alt="FUNT Learn"
          className="h-12 w-auto max-w-full object-contain sm:h-14"
        />
        <span className="mt-2.5 font-brand-learn text-lg font-semibold tracking-[0.2em] text-funt-ink sm:text-xl">Learn</span>
      </div>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#8f7318]">{section.title}</p>
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
                        ? "bg-gradient-to-r from-[#e2c35f] to-[#cfaa35] text-black shadow-md ring-1 ring-[#c19822]/45"
                        : "text-black/70 hover:bg-[#f7efd6] hover:text-funt-ink"
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
    <div className="student-premium flex h-screen min-h-screen overflow-hidden bg-[radial-gradient(1200px_600px_at_0%_-10%,rgba(212,175,55,0.18),transparent_55%),linear-gradient(180deg,#faf7ed_0%,#f7f6f2_42%,#f3f2ef_100%)]">
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
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl lg:hidden">
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
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-transparent p-4 text-funt-ink sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
