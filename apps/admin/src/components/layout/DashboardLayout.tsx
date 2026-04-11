"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { AdminUserProvider, type AdminUser } from "@/contexts/AdminUserContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    api<AdminUser>("/api/users/me")
      .then((res) => {
        if (res.success && res.data) setUser(res.data);
        else router.push("/login");
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  const sidebar = <Sidebar roles={user.roles} />;

  return (
    <AdminUserProvider user={user}>
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">{sidebar}</div>
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl lg:hidden">{sidebar}</div>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={{ name: user.name, username: user.username, roles: user.roles }} onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-auto bg-gradient-to-b from-slate-50/50 to-slate-100/30 p-4 text-slate-800 sm:p-6">{children}</main>
      </div>
    </div>
    </AdminUserProvider>
  );
}
