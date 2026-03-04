"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE } from "@funt-platform/constants";

const PANEL_LABELS: Record<string, string> = {
  [ROLE.SUPER_ADMIN]: "Super Admin",
  [ROLE.TRAINER]: "Trainer",
};
const DEFAULT_PANEL_LABEL = "Admin";

function getPanelLabel(roles: string[]): string {
  if (roles?.includes(ROLE.SUPER_ADMIN)) return PANEL_LABELS[ROLE.SUPER_ADMIN];
  if (roles?.includes(ROLE.TRAINER)) return PANEL_LABELS[ROLE.TRAINER];
  return DEFAULT_PANEL_LABEL;
}

const NAV_LINK_BASE =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition";

function SidebarNavLink({
  href,
  children,
  isActive,
}: {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        isActive
          ? `${NAV_LINK_BASE} bg-teal-600 text-white shadow-lg shadow-teal-900/15 ring-1 ring-teal-700/20`
          : `${NAV_LINK_BASE} text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:ring-1 hover:ring-slate-200/80`
      }
    >
      {children}
    </Link>
  );
}

const SECTION_LABEL_CLASS = "pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400";

interface SidebarProps {
  roles: string[];
}

export function Sidebar({ roles }: SidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);
  const isAdmin = roles.includes(ROLE.ADMIN) || isSuperAdmin;
  const isTrainer = roles.includes(ROLE.TRAINER);
  const showContentAndBatches = isAdmin || isTrainer;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200/90 bg-white shadow-xl shadow-slate-300/10 ring-1 ring-slate-100/80">
      <div className="flex shrink-0 flex-col items-center justify-center border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 py-7 ring-1 ring-slate-100/50 ring-inset">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/funt-logo.png"
          alt="FUNT"
          className="h-12 w-auto object-contain sm:h-14"
        />
        <span className="mt-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 sm:text-xs">
          {getPanelLabel(roles)}
        </span>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
        <SidebarNavLink href="/dashboard" isActive={pathname === "/dashboard"}>
          Dashboard
        </SidebarNavLink>
        {isAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>People</p>
            <SidebarNavLink href="/admin-management" isActive={pathname.startsWith("/admin-management")}>
              Admins &amp; Requests
            </SidebarNavLink>
          </>
        )}
        {showContentAndBatches && (
          <>
            <p className={SECTION_LABEL_CLASS}>Content</p>
            <SidebarNavLink href="/global-modules" isActive={pathname.startsWith("/global-modules")}>
              Modules
            </SidebarNavLink>
            <SidebarNavLink href="/global-assignments" isActive={pathname.startsWith("/global-assignments")}>
              Assignments
            </SidebarNavLink>
            <SidebarNavLink href="/courses" isActive={pathname.startsWith("/courses")}>
              Courses
            </SidebarNavLink>
            <SidebarNavLink href="/batches" isActive={pathname.startsWith("/batches")}>
              Batches
            </SidebarNavLink>
          </>
        )}
        {isAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>Operations</p>
            <SidebarNavLink
              href="/attendance"
              isActive={pathname === "/attendance" || (pathname.startsWith("/batches") && pathname.includes("/attendance"))}
            >
              Attendance
            </SidebarNavLink>
          </>
        )}
        {isSuperAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>Governance</p>
            <SidebarNavLink href="/audit" isActive={pathname.startsWith("/audit")}>
              Audit
            </SidebarNavLink>
            <SidebarNavLink href="/analytics" isActive={pathname.startsWith("/analytics")}>
              Analytics
            </SidebarNavLink>
          </>
        )}
      </nav>
    </aside>
  );
}
