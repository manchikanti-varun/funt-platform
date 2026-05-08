"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { AdminUserProvider, type AdminUser } from "@/contexts/AdminUserContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { StateScreen } from "@/components/ui/StateScreen";

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
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <StateScreen
          tone="loading"
          title="Checking your session"
          description="Verifying access and loading your admin console..."
        />
      </div>
    );
  }

  const sidebar = <Sidebar roles={user.roles} />;

  return (
    <AdminUserProvider user={user}>
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
        <main className="flex min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-transparent via-indigo-50/20 to-slate-100/60 p-4 text-slate-800 overscroll-contain sm:p-6">{children}</main>
      </div>
    </div>
    </AdminUserProvider>
  );
}
