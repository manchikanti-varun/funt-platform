"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE } from "@funt-platform/constants";

const PANEL_LABELS: Record<string, string> = {
  [ROLE.SUPER_ADMIN]: "Super Admin",
  [ROLE.TRAINER]: "Trainer",
  [ROLE.FRANCHISE_ADMIN]: "Franchise",
};
const DEFAULT_PANEL_LABEL = "Admin";

function getPanelLabel(roles: string[]): string {
  if (roles?.includes(ROLE.SUPER_ADMIN)) return PANEL_LABELS[ROLE.SUPER_ADMIN];
  if (roles?.includes(ROLE.FRANCHISE_ADMIN)) return PANEL_LABELS[ROLE.FRANCHISE_ADMIN];
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
  const isSubAdmin = roles.includes(ROLE.SUB_ADMIN);
  const isTrainer = roles.includes(ROLE.TRAINER);
  const isFranchiseAdmin = roles.includes(ROLE.FRANCHISE_ADMIN);
  const showContentAndBatches = isAdmin || isSubAdmin || isTrainer;

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
        {showContentAndBatches && (
          <>
            <p className={SECTION_LABEL_CLASS}>Academic</p>
            {!isSubAdmin && (
              <SidebarNavLink href="/courses" isActive={pathname.startsWith("/courses")}>
                Courses
              </SidebarNavLink>
            )}
            <SidebarNavLink href="/batches" isActive={pathname.startsWith("/batches")}>
              Batches
            </SidebarNavLink>
            {!isSubAdmin && (
              <>
                <SidebarNavLink href="/global-modules" isActive={pathname.startsWith("/global-modules")}>
                  Chapters
                </SidebarNavLink>
                <SidebarNavLink href="/global-assignments" isActive={pathname.startsWith("/global-assignments")}>
                  Assignments
                </SidebarNavLink>
                <SidebarNavLink href="/quizzes" isActive={pathname.startsWith("/quizzes")}>
                  Quizzes
                </SidebarNavLink>
              </>
            )}
            <SidebarNavLink href="/assignments" isActive={pathname.startsWith("/assignments")}>
              Assignment reviews
            </SidebarNavLink>
            <SidebarNavLink
              href="/attendance"
              isActive={pathname === "/attendance" || (pathname.startsWith("/batches") && pathname.includes("/attendance"))}
            >
              Attendance
            </SidebarNavLink>
            {(isAdmin || isSubAdmin) && (
              <SidebarNavLink href="/certificates" isActive={pathname.startsWith("/certificates") || (pathname.startsWith("/batches") && pathname.includes("/certificates"))}>
                Certificates
              </SidebarNavLink>
            )}
          </>
        )}
        {/* Sub Admin: limited people section */}
        {isSubAdmin && !isAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>People</p>
            <SidebarNavLink href="/people-insights" isActive={pathname.startsWith("/people-insights")}>
              People insights
            </SidebarNavLink>
            <SidebarNavLink href="/profile-search" isActive={pathname.startsWith("/profile-search")}>
              Profile search
            </SidebarNavLink>
            <SidebarNavLink href="/team-management" isActive={pathname.startsWith("/team-management") || pathname.startsWith("/admin-management")}>
              Team management
            </SidebarNavLink>
          </>
        )}
        {isAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>People</p>
            <SidebarNavLink href="/team-management" isActive={pathname.startsWith("/team-management") || pathname.startsWith("/admin-management")}>
              Team management
            </SidebarNavLink>
            <SidebarNavLink href="/people-insights" isActive={pathname.startsWith("/people-insights")}>
              People insights
            </SidebarNavLink>
            <SidebarNavLink href="/profile-search" isActive={pathname.startsWith("/profile-search")}>
              Profile search
            </SidebarNavLink>
            <SidebarNavLink href="/badges" isActive={pathname.startsWith("/badges")}>
              Badges
            </SidebarNavLink>
            <SidebarNavLink href="/leaves" isActive={pathname.startsWith("/leaves")}>
              Leave management
            </SidebarNavLink>
          </>
        )}
        {/* Trainers get access to their own leaves and support desk (assigned tickets) */}
        {isTrainer && !isAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>People</p>
            <SidebarNavLink href="/leaves/my" isActive={pathname.startsWith("/leaves/my")}>
              My leaves
            </SidebarNavLink>
          </>
        )}
        {(isAdmin || isSubAdmin) && (
          <>
            <p className={SECTION_LABEL_CLASS}>Commerce</p>
            <SidebarNavLink href="/payments" isActive={pathname.startsWith("/payments")}>
              Payment approvals
            </SidebarNavLink>
            <SidebarNavLink href="/invoices" isActive={pathname.startsWith("/invoices")}>
              Invoices
            </SidebarNavLink>
            {isAdmin && (
              <SidebarNavLink href="/finance" isActive={pathname.startsWith("/finance")}>
                Finance dashboard
              </SidebarNavLink>
            )}
            {isSuperAdmin && (
              <SidebarNavLink href="/coupons" isActive={pathname.startsWith("/coupons")}>
                Coupons
              </SidebarNavLink>
            )}
            <SidebarNavLink href="/shop" isActive={pathname.startsWith("/shop")}>
              Shop
            </SidebarNavLink>
            {isSuperAdmin && (
              <SidebarNavLink href="/license-keys" isActive={pathname.startsWith("/license-keys")}>
                License keys
              </SidebarNavLink>
            )}
            <SidebarNavLink href="/payment-qr" isActive={pathname.startsWith("/payment-qr")}>
              UPI QR center
            </SidebarNavLink>
            <SidebarNavLink href="/payment-promises" isActive={pathname.startsWith("/payment-promises")}>
              Payment promises
            </SidebarNavLink>
            {isSuperAdmin && (
              <SidebarNavLink href="/letters" isActive={pathname.startsWith("/letters")}>
                Letters
              </SidebarNavLink>
            )}
          </>
        )}
        {(isAdmin || isSubAdmin || (isTrainer && !isAdmin)) && (
          <>
            <p className={SECTION_LABEL_CLASS}>Support</p>
            <SidebarNavLink href="/support" isActive={pathname === "/support" || (pathname.startsWith("/support") && !pathname.startsWith("/support-live"))}>
              Support desk
            </SidebarNavLink>
            {(isAdmin || isSubAdmin) && (
              <SidebarNavLink href="/enrollment-requests" isActive={pathname.startsWith("/enrollment-requests")}>
                Enrollment requests
              </SidebarNavLink>
            )}
          </>
        )}
        {!isFranchiseAdmin && (
          <SidebarNavLink href="/knowledge-center" isActive={pathname.startsWith("/knowledge-center")}>
            Knowledge Center
          </SidebarNavLink>
        )}
        {isAdmin && !isSubAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>System</p>
            {isSuperAdmin && (
              <>
                <SidebarNavLink href="/analytics" isActive={pathname.startsWith("/analytics")}>
                  Analytics
                </SidebarNavLink>
                <SidebarNavLink href="/audit-hub" isActive={pathname.startsWith("/audit-hub")}>
                  Audit hub
                </SidebarNavLink>
              </>
            )}
            <SidebarNavLink href="/import-export" isActive={pathname.startsWith("/import-export")}>
              Import / Export
            </SidebarNavLink>
            {isSuperAdmin && (
              <SidebarNavLink href="/config/content-protection" isActive={pathname.startsWith("/config")}>
                Content protection
              </SidebarNavLink>
            )}
          </>
        )}
        {isSuperAdmin && (
          <>
            <p className={SECTION_LABEL_CLASS}>Franchise</p>
            <SidebarNavLink href="/franchise/centers" isActive={pathname.startsWith("/franchise/centers")}>
              Franchise centers
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/key-requests" isActive={pathname.startsWith("/franchise/key-requests")}>
              Key requests
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/bulk-allocate" isActive={pathname.startsWith("/franchise/bulk-allocate")}>
              Bulk allocate keys
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/payouts" isActive={pathname.startsWith("/franchise/payouts")}>
              Payouts
            </SidebarNavLink>
          </>
        )}
        {isFranchiseAdmin && (
          <>
            <SidebarNavLink href="/franchise/dashboard" isActive={pathname === "/franchise/dashboard"}>
              Dashboard
            </SidebarNavLink>
            <p className={SECTION_LABEL_CLASS}>Operations</p>
            <SidebarNavLink href="/franchise/my-batches" isActive={pathname.startsWith("/franchise/my-batches")}>
              My Batches
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/my-students" isActive={pathname.startsWith("/franchise/my-students")}>
              My Students
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/trainers" isActive={pathname.startsWith("/franchise/trainers")}>
              My Trainers
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/courses" isActive={pathname.startsWith("/franchise/courses")}>
              Course Library
            </SidebarNavLink>
            <p className={SECTION_LABEL_CLASS}>Commerce</p>
            <SidebarNavLink href="/franchise/license-keys" isActive={pathname.startsWith("/franchise/license-keys")}>
              License Keys
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/payments" isActive={pathname.startsWith("/franchise/payments")}>
              Payments
            </SidebarNavLink>
            <SidebarNavLink href="/franchise/earnings" isActive={pathname.startsWith("/franchise/earnings")}>
              Earnings
            </SidebarNavLink>
          </>
        )}
      </nav>
    </aside>
  );
}
