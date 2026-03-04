"use client";

type Variant = "success" | "error";

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

interface AlertProps {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
  role?: string;
}

export function Alert({ variant, children, className = "", role = "alert" }: AlertProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${VARIANT_CLASSES[variant]} ${className}`} role={role}>
      {children}
    </div>
  );
}
