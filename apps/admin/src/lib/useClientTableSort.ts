import { useCallback, useMemo, useState } from "react";
import type { SortDir } from "@/components/ui/SortableTh";

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return mul;
  if (b == null) return -mul;

  if (typeof a === "number" && typeof b === "number") {
    if (a < b) return -mul;
    if (a > b) return mul;
    return 0;
  }

  const aTime = typeof a === "string" || a instanceof Date ? new Date(a as string | Date).getTime() : NaN;
  const bTime = typeof b === "string" || b instanceof Date ? new Date(b as string | Date).getTime() : NaN;
  if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
    if (aTime < bTime) return -mul;
    if (aTime > bTime) return mul;
    return 0;
  }

  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();
  if (aStr < bStr) return -mul;
  if (aStr > bStr) return mul;
  return 0;
}

export function useClientTableSort<T>(
  rows: T[],
  getCellValue: (row: T, columnKey: string) => unknown,
  options?: { defaultSortKey?: string; defaultSortDir?: SortDir }
) {
  const [sortKey, setSortKey] = useState<string | null>(options?.defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(options?.defaultSortDir ?? "desc");

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) =>
      compareValues(getCellValue(a, sortKey), getCellValue(b, sortKey), sortDir)
    );
  }, [rows, sortKey, sortDir, getCellValue]);

  return { sortedRows, sortKey, sortDir, handleSort };
}
