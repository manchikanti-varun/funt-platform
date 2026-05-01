"use client";

export function PageSection({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`page-section ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <div className="page-section-head">
          <div>
            {title ? <h2 className="text-lg font-semibold text-funt-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-black">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
