"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Headphones, Ticket, BarChart3 } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Live Chat", icon: Headphones, exact: true },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket },
  { href: "/dashboard/stats", label: "My Stats", icon: BarChart3 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Bottom navigation tabs (mobile) / top sub-nav (desktop) */}
      <nav className="hidden border-b border-slate-200 bg-white px-5 sm:flex sm:items-center sm:gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {/* Mobile bottom tabs */}
      <nav className="flex border-t border-slate-200 bg-white sm:hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition ${
                isActive ? "text-indigo-600" : "text-slate-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
