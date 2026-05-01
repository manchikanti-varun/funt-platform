"use client";

import Link from "next/link";
import { ROLE } from "@funt-platform/constants";
import { useAdminUser } from "@/contexts/AdminUserContext";
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
];

export default function AuditHubPage() {
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);

  if (!isSuperAdmin) {
    return (
      <div className="w-full space-y-6">
        <PageHeader title="Audit hub" subtitle="Super Admin only." />
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Access is restricted to Super Admin accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Audit hub"
        subtitle="One place to access all audit and history views."
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/audit-hub" className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">
          Audit hub
        </Link>
        <Link href="/audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          System
        </Link>
        <Link href="/license-key-audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          License keys
        </Link>
        <Link href="/coupon-audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          Coupons
        </Link>
        <Link href="/audit?action=PAYMENT_UPI_UPDATED" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          Payment UPI config
        </Link>
        <Link href="/payment-qr?section=HISTORY" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          QR history
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {AUDIT_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40"
          >
            <p className="text-base font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
