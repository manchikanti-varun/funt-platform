"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, ensureCsrfToken } from "@/lib/api";
import { AdminUserProvider, type AdminUser } from "@/contexts/AdminUserContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AppDialogProvider } from "@/components/ui/AppDialogProvider";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(() => {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const cached = sessionStorage.getItem("_admin_user");
      if (cached) return JSON.parse(cached) as AdminUser;
    } catch { /* ignore */ }
    return null;
  });
  const [loading, setLoading] = useState(!user);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    ensureCsrfToken();
    api<AdminUser>("/api/users/me")
      .then((res) => {
        if (res.success && res.data) {
          setUser(res.data);
          try { sessionStorage.setItem("_admin_user", JSON.stringify(res.data)); } catch { /* quota */ }
        } else {
          sessionStorage.removeItem("_admin_user");
          router.push("/login");
        }
      })
      .catch(() => { sessionStorage.removeItem("_admin_user"); router.push("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen min-h-screen overflow-hidden bg-slate-50">
        <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex h-16 items-center justify-center border-b border-slate-100">
            <div className="h-8 w-32 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="flex-1 px-3 py-4 space-y-2">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-9 rounded-lg bg-slate-100 animate-pulse" />)}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-slate-100 bg-white px-4">
            <div className="h-5 w-36 rounded bg-slate-100 animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse" />
          </header>
          <main className="flex flex-1 items-center justify-center"><div className="spinner" /></main>
        </div>
      </div>
    );
  }

  const sidebar = <Sidebar roles={user.roles} />;

  return (
    <AdminUserProvider user={user}>
    <AppDialogProvider>
    <div className="flex h-screen min-h-screen overflow-hidden bg-slate-50">
      <div className="hidden h-full shrink-0 lg:block">{sidebar}</div>
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl lg:hidden">{sidebar}</div>
        </>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar user={{ name: user.name, username: user.username, roles: user.roles }} onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-transparent via-indigo-50/20 to-slate-100/60 p-4 text-slate-800 overscroll-contain sm:p-6">
          {children}
        </main>
      </div>
    </div>
    </AppDialogProvider>
    </AdminUserProvider>
  );
}
