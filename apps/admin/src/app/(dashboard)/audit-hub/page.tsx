"use client";

import Link from "next/link";
import { ROLE } from "@funt-platform/constants";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";

const AUDIT_ITEMS = [
  {
    href: "/audit",
    title: "System audit log",
    description: "All critical actions across admin workflows.",
  },
  {
    href: "/license-key-audit",
    title: "License key audit",
    description: "Generated and redeemed key history by batch and user.",
  },
  {
    href: "/coupon-audit",
    title: "Coupon audit",
    description: "Coupon redemption history with student context.",
  },
  {
    href: "/audit?action=PAYMENT_UPI_UPDATED",
    title: "Payment UPI config audit",
    description: "Track who changed the active receiving UPI configuration.",
  },
  {
    href: "/payment-qr?section=HISTORY",
    title: "QR generation history",
    description: "Track QR generation by admin and timestamp.",
  },
  {
    href: "/audit?action=CONTENT_PROTECTION_DEVTOOLS_DETECTED",
    title: "Content protection — DevTools",
    description: "Students who triggered DevTools detection during a session.",
  },
  {
    href: "/audit?action=CONTENT_PROTECTION_SCREEN_SHARE_DETECTED",
    title: "Content protection — Screen share",
    description: "Screen share / display capture events from student sessions.",
  },
  {
    href: "/audit?action=CONTENT_PROTECTION_COPY_BLOCKED",
    title: "Content protection — Copy attempts",
    description: "Copy/cut events blocked in the student LMS.",
  },
];

export default function AuditHubPage() {
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);

  if (!isSuperAdmin) {
    return (
      <AppPageShell>
        <PageHeader title="Audit hub" subtitle="Super Admin only." />
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Access is restricted to Super Admin accounts.
        </p>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Audit hub"
        subtitle="One place to access all audit and history views."
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/audit-hub" className="nav-pills nav-pills--active">
          Audit hub
        </Link>
        <Link href="/audit" className="nav-pills">
          System
        </Link>
        <Link href="/license-key-audit" className="nav-pills">
          License keys
        </Link>
        <Link href="/coupon-audit" className="nav-pills">
          Coupons
        </Link>
        <Link href="/audit?action=PAYMENT_UPI_UPDATED" className="nav-pills">
          Payment UPI config
        </Link>
        <Link href="/payment-qr?section=HISTORY" className="nav-pills">
          QR history
        </Link>
        <Link href="/audit?action=CONTENT_PROTECTION_DEVTOOLS_DETECTED" className="nav-pills">
          DevTools
        </Link>
        <Link href="/audit?action=CONTENT_PROTECTION_COPY_BLOCKED" className="nav-pills">
          Copy attempts
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {AUDIT_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <p className="text-base font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </AppPageShell>
  );
}
