"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableTh } from "@/components/ui/SortableTh";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { useClientTableSort } from "@/lib/useClientTableSort";

interface AuditRow {
  id: string;
  couponId: string;
  couponCode: string;
  couponKind: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  context: string;
  createdAt: string;
}

interface AuditPayload {
  rows: AuditRow[];
  total: number;
  page: number;
  limit: number;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CouponAuditPage() {
  const { roles } = useAdminUser();
  const [data, setData] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    api<AuditPayload>(`/api/admin/coupons/audit?${params}`)
      .then((r) => {
        if (r.success && r.data) setData(r.data);
        else setError(r.message ?? "Failed to load coupon audit");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [isSuperAdmin, page, limit]);

  const getCouponCellValue = useCallback((row: AuditRow, key: string) => {
    switch (key) {
      case "code":
        return row.couponCode;
      case "kind":
        return row.couponKind;
      case "student":
        return row.studentName;
      case "context":
        return row.context;
      case "createdAt":
        return row.createdAt;
      default:
        return "";
    }
  }, []);

  const { sortedRows, sortKey, sortDir, handleSort } = useClientTableSort(
    data?.rows ?? [],
    getCouponCellValue,
    { defaultSortKey: "createdAt", defaultSortDir: "desc" }
  );

  if (!isSuperAdmin) {
    return (
      <div className="w-full space-y-6">
        <PageHeader title="Coupon audit" subtitle="Super Admin only." />
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          You do not have access to this page.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Coupon audit"
        subtitle="Each row is a coupon redemption: code, student, and context (for example enrollment after payment)."
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/audit-hub" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Audit hub</Link>
        <Link href="/audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">System</Link>
        <Link href="/license-key-audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">License keys</Link>
        <Link href="/coupon-audit" className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">Coupons</Link>
        <Link href="/payment-qr?section=HISTORY" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">QR history</Link>
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="spinner" />
        </div>
      ) : data && data.rows.length === 0 ? (
        <EmptyState title="No redemptions yet" description="When students use coupons at checkout, entries appear here." />
      ) : data ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/80">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <SortableTh label="Code" columnKey="code" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-4 py-3" />
                  <SortableTh label="Kind" columnKey="kind" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-4 py-3" />
                  <SortableTh label="Student" columnKey="student" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-4 py-3" />
                  <SortableTh label="Context" columnKey="context" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-4 py-3" />
                  <SortableTh label="When" columnKey="createdAt" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{row.couponCode}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.couponKind}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="max-w-[14rem]">
                        <div className="truncate font-medium" title={row.studentName}>
                          {row.studentName}
                        </div>
                        <div className="truncate text-xs text-slate-500" title={row.studentUsername}>
                          @{row.studentUsername}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[20rem] break-all px-4 py-3 font-mono text-xs text-slate-600">{row.context || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <PageSizeSelect
                value={limit}
                onChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
              <span className="text-slate-600">
                Page {data.page} of {totalPages} ({data.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
