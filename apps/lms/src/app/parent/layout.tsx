"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearParentSession } from "@/lib/parentSelection";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/parent/login";
  const isDashboardPage = pathname.startsWith("/parent/dashboard");
  const isProfilesPage = pathname === "/parent/profiles" || pathname === "/parent";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="student-premium flex min-h-screen flex-col bg-[radial-gradient(1200px_600px_at_0%_-10%,rgba(212,175,55,0.18),transparent_55%),linear-gradient(180deg,#faf7ed_0%,#f7f6f2_42%,#f3f2ef_100%)]">
      <div className="flex min-w-0 flex-1 flex-col min-h-0">
        <header className="glass-nav sticky top-0 z-30 flex h-16 flex-wrap items-center justify-between gap-4 border-b border-[#e5d9b7] bg-gradient-to-r from-[#fff8e5]/95 via-white/95 to-[#fffef8]/95 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-initial">
            <button
              type="button"
              onClick={() => router.push("/parent/profiles")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black/60 transition hover:bg-[#f6edd2] hover:text-funt-ink lg:hidden"
              aria-label="Choose profile"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <img
                src="/funt-logo.png"
                alt="FUNT Learn"
                className="block h-14 w-auto max-w-full shrink-0 object-contain sm:h-16"
                loading="eager"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight text-funt-ink sm:text-lg">
                  {isDashboardPage ? "Parent Dashboard" : "Parent"}
                </p>
                <p className="truncate text-xs font-medium text-black/50">
                  {isDashboardPage ? "Monitor your child's progress" : "Choose a linked student"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/parent/profiles"
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                isProfilesPage
                  ? "bg-gradient-to-r from-[#e2c35f] to-[#cfaa35] text-black shadow-md ring-1 ring-[#c19822]/45"
                  : "border border-[#e5d8b3] bg-white text-funt-ink hover:bg-[#f8efce]"
              }`}
            >
              Profiles
            </Link>
            <Link
              href="/parent/dashboard"
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                isDashboardPage
                  ? "bg-gradient-to-r from-[#e2c35f] to-[#cfaa35] text-black shadow-md ring-1 ring-[#c19822]/45"
                  : "border border-[#e5d8b3] bg-white text-funt-ink hover:bg-[#f8efce]"
              }`}
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                clearParentSession();
                router.push("/login");
              }}
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white p-2 text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              aria-label="Exit"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H9" />
              </svg>
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-scroll overflow-x-hidden bg-transparent p-4 text-funt-ink sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
