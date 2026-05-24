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
          ? `${NAV_LINK_BASE} bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 ring-1 ring-indigo-700/20`
          : `${NAV_LINK_BASE} text-slate-600 hover:bg-indigo-50/70 hover:text-slate-900 hover:ring-1 hover:ring-indigo-200/80`
      }
    >
      {children}
    </Link>
  );
}

const SECTION_LABEL_CLASS = "label-overline pt-4 pb-1";

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
      <div className="flex shrink-0 flex-col items-center justify-center border-b border-slate-100/90 bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 px-5 py-7 ring-1 ring-slate-100/50 ring-inset">
        <img
          src="/funt-logo.png"
          alt="FUNT Robotics"
          className="h-12 w-auto max-w-full object-contain sm:h-14"
        />
        <span className="mt-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 sm:text-xs">
          {getPanelLabel(roles)}
        </span>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
        <SidebarNavLink href="/dashboard" isActive={pathname === "/dashboard"}>
          Home
        </SidebarNavLink>
        {isAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>Team</p>
            <SidebarNavLink href="/team-management" isActive={pathname.startsWith("/team-management") || pathname.startsWith("/admin-management")}>
              Team management
            </SidebarNavLink>
            <SidebarNavLink href="/people-insights" isActive={pathname.startsWith("/people-insights")}>
              People insights
            </SidebarNavLink>
            <SidebarNavLink href="/badges" isActive={pathname.startsWith("/badges")}>
              Badges
            </SidebarNavLink>
          </>
        )}
        {showContentAndBatches && (
          <>
            <p className={SECTION_LABEL_CLASS}>Content</p>
            <SidebarNavLink href="/global-modules" isActive={pathname.startsWith("/global-modules")}>
              Chapters
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
            <p className={SECTION_LABEL_CLASS}>Payments & Commerce</p>
            <SidebarNavLink href="/payments" isActive={pathname.startsWith("/payments")}>
              Payment approvals
            </SidebarNavLink>
            <SidebarNavLink href="/invoices" isActive={pathname.startsWith("/invoices")}>
              Invoices
            </SidebarNavLink>
            <SidebarNavLink href="/finance" isActive={pathname.startsWith("/finance")}>
              Finance dashboard
            </SidebarNavLink>
            <SidebarNavLink href="/payment-qr" isActive={pathname.startsWith("/payment-qr")}>
              UPI QR center
            </SidebarNavLink>
            <SidebarNavLink href="/shop" isActive={pathname.startsWith("/shop")}>
              Shop
            </SidebarNavLink>
            {isSuperAdmin && (
              <SidebarNavLink href="/coupons" isActive={pathname.startsWith("/coupons")}>
                Coupons
              </SidebarNavLink>
            )}
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
            <p className={SECTION_LABEL_CLASS}>System</p>
            <SidebarNavLink href="/analytics" isActive={pathname.startsWith("/analytics")}>
              Analytics
            </SidebarNavLink>
            <SidebarNavLink href="/audit-hub" isActive={pathname.startsWith("/audit-hub")}>
              Audit hub
            </SidebarNavLink>
          </>
        )}
      </nav>
    </aside>
  );
}
