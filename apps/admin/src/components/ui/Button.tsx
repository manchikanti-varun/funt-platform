"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "rounded-xl bg-teal-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2",
  secondary:
    "rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
  danger:
    "rounded-xl border border-red-200 bg-white px-4 py-2.5 font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2",
  ghost:
    "rounded-xl px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({ variant = "primary", icon, children, className = "", ...props }: ButtonProps) {
  return (
    <button type="button" className={`inline-flex items-center justify-center gap-2 ${VARIANT_CLASSES[variant]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  variant = "secondary",
  icon,
  "aria-label": ariaLabel,
  title,
  className = "",
  ...props
}: ButtonProps & { "aria-label": string; title?: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${variant === "primary" ? "bg-teal-600 text-white hover:bg-teal-700" : variant === "danger" ? "border border-red-200 text-red-600 hover:bg-red-50" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
