"use client";

interface StateScreenProps {
  variant: "loading" | "error";
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function StateScreen({ variant, icon, title, description, action }: StateScreenProps) {
  const isError = variant === "error";

  return (
    <div className="flex min-h-[55vh] w-full items-center justify-center">
      <div className={`relative w-full max-w-xl overflow-hidden rounded-3xl border bg-white p-10 text-center shadow-xl ring-1 ring-slate-100/90 ${isError ? "border-red-100" : "border-slate-200"}`}>
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-indigo-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-6 h-24 w-24 rounded-full bg-violet-200/25 blur-2xl" />

        {/* Icon */}
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${isError ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-700"}`}>
          {icon ?? (
            isError ? (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            ) : (
              <div className="spinner--sm" />
            )
          )}
        </div>

        {/* Text */}
        {title && <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900">{title}</h2>}
        {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
