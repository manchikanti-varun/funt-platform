"use client";

export const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100] as const;

type PageSizeSelectProps = {
  value: number;
  onChange: (limit: number) => void;
  label?: string;
  className?: string;
};

export function PageSizeSelect({ value, onChange, label = "Rows per page", className = "" }: PageSizeSelectProps) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-slate-600 ${className}`.trim()}>
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || PAGE_SIZE_OPTIONS[0])}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        aria-label={label}
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
