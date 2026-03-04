"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, getToken, clearToken } from "@/lib/api";
import { parseJwtPayload, isTokenExpired } from "@/lib/auth";

interface UserMe {
  id: string;
  funtId: string;
  name: string;
  roles: string[];
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 2);
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isLoginPage = pathname === "/parent/login";

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      router.push("/parent/login");
      return;
    }
    const payload = parseJwtPayload(token);
    if (!payload || isTokenExpired(payload)) {
      router.push("/parent/login");
      return;
    }
    api<UserMe>("/api/users/me").then((r) => {
      if (r.success && r.data) setUser(r.data);
      else router.push("/parent/login");
    }).catch(() => router.push("/parent/login")).finally(() => setLoading(false));
  }, [router, isLoginPage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (isLoginPage) {
    return <>{children}</>;
  }
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  const initials = getInitials(user.name);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-px bg-slate-200" aria-hidden />
          <span className="text-[15px] font-semibold tracking-tight text-slate-800">
            FUNT <span className="text-slate-500 font-medium">LEARN – Parent</span>
          </span>
        </div>
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-3 rounded-xl py-2 pl-2 pr-3 transition hover:bg-slate-50"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-semibold text-white shadow-sm">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</p>
            </div>
            <svg className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-lg shadow-slate-200/50">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); clearToken(); router.push("/parent/login"); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="p-6 text-slate-800">{children}</main>
    </div>
  );
}
