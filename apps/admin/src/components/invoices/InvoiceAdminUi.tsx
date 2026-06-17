"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const COMMERCE_LINKS: Array<{ href: string; label: string; match?: (p: string) => boolean }> = [
  { href: "/payments", label: "Payment approvals" },
  { href: "/invoices", label: "Invoices", match: (p) => p.startsWith("/invoices") },
  { href: "/finance", label: "Finance dashboard" },
  { href: "/payment-qr", label: "UPI QR center" },
  { href: "/coupons", label: "Coupons" },
  { href: "/shop", label: "Shop" },
];

const INVOICE_TABS = [
  { href: "/invoices", label: "All invoices", match: (p: string) => p === "/invoices" || /^\/invoices\/[a-f0-9]{24}$/i.test(p) },
  { href: "/invoices/settings", label: "Settings", match: (p: string) => p === "/invoices/settings" },
  { href: "/invoices/sample", label: "Preview", match: (p: string) => p === "/invoices/sample" },
] as const;

function navPillClass(active: boolean) {
  return active
    ? "rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
    : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200";
}

export function PaymentsCommerceNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Payments and commerce">
      {COMMERCE_LINKS.map(({ href, label, match }) => {
        const active = match ? match(pathname) : pathname === href;
        return (
          <Link key={href} href={href} className={navPillClass(active)}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function InvoiceSubNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm ring-1 ring-slate-100/80"
      aria-label="Invoice sections"
    >
      {INVOICE_TABS.map(({ href, label, match }) => (
        <Link key={href} href={href} className={navPillClass(match(pathname))}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`.trim()}>
      <div
        className="spinner"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-teal-500">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function InvoicePageActions() {
  return (
    <>
      <Link href="/invoices/settings" className="btn-secondary inline-flex items-center gap-2 text-sm">
        <GearIcon className="h-4 w-4" />
        Settings
      </Link>
      <Link href="/invoices/sample" className="btn-primary inline-flex items-center gap-2 text-sm">
        <DocIcon className="h-4 w-4" />
        Preview template
      </Link>
    </>
  );
}

export function InvoicePreviewFrame({
  children,
  badge,
}: {
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="print:hidden">
      {badge ? (
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{badge}</p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 shadow-inner sm:p-8">
        <div className="mx-auto max-w-[210mm] shadow-2xl shadow-slate-300/40 ring-1 ring-slate-200/80">{children}</div>
      </div>
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="page-section">
      <div className="page-section-head !mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 transition hover:border-slate-300/80">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
            checked ? "bg-teal-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-1 rounded-full bg-white shadow transition ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {checked && children ? (
        <div className="mt-4 border-t border-slate-200/80 pt-4 space-y-3">{children}</div>
      ) : null}
    </div>
  );
}

export function LineTypePills({
  value,
  onChange,
}: {
  value: "SERVICE" | "GOODS";
  onChange: (v: "SERVICE" | "GOODS") => void;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Line type">
      {(
        [
          { id: "SERVICE" as const, title: "Course / service", sub: "SAC code" },
          { id: "GOODS" as const, title: "Kit / goods", sub: "HSN code" },
        ] as const
      ).map(({ id, title, sub }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
            value === id
              ? "border-teal-300 bg-teal-50 font-semibold text-teal-900 ring-2 ring-teal-200/80"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span className="block font-semibold">{title}</span>
          <span className="text-xs opacity-80">{sub}</span>
        </button>
      ))}
    </div>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-semibold text-slate-700">{children}</label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
