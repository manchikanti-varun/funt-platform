"use client";

type SortDir = "asc" | "desc";

interface SortableThProps {
  label: string;
  columnKey: string;
  currentSortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "right";
  className?: string;
}

export function SortableTh({
  label,
  columnKey,
  currentSortKey,
  sortDir,
  onSort,
  align = "left",
  className = "",
}: SortableThProps) {
  const isActive = currentSortKey === columnKey;
  const handleClick = () => onSort(columnKey);

  return (
    <th
      className={`px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-600 ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 rounded"
      >
        <span>{label}</span>
        <span className="inline-flex flex-col text-slate-400">
          <svg
            className={`h-3.5 w-3.5 -mb-0.5 ${isActive && sortDir === "asc" ? "text-teal-600" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden
          >
            <path d="M14 5l-4-4-4 4h8z" />
          </svg>
          <svg
            className={`h-3.5 w-3.5 -mt-0.5 ${isActive && sortDir === "desc" ? "text-teal-600" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden
          >
            <path d="M6 15l4 4 4-4H6z" />
          </svg>
        </span>
      </button>
    </th>
  );
}

export type { SortDir };
