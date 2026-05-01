"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

interface AuditRow {
  id: string;
  keyMasked: string;
  courseId: string;
  courseTitle: string | null;
  batchId: string | null;
  batchName: string | null;
  batchCode: string | null;
  createdByUserId: string;
  createdByName: string;
  createdByUsername: string;
  createdAt: string;
  usedByStudentId: string | null;
  usedByName: string | null;
  usedByUsername: string | null;
  usedAt: string | null;
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

function courseCell(row: AuditRow): string {
  const t = row.courseTitle?.trim();
  if (t) return t;
  return "Course name unavailable";
}

function batchCell(row: AuditRow): string {
  const name = row.batchName?.trim();
  const code = row.batchCode?.trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return "—";
}

export default function LicenseKeyAuditPage() {
  const { roles } = useAdminUser();
  const [data, setData] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [usedOnly, setUsedOnly] = useState(false);
  const limit = 25;
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
    if (usedOnly) params.set("usedOnly", "true");
    api<AuditPayload>(`/api/admin/license-keys/audit?${params}`)
      .then((r) => {
        if (r.success && r.data) setData(r.data);
        else setError(r.message ?? "Failed to load license key audit");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [isSuperAdmin, page, usedOnly]);

  if (!isSuperAdmin) {
    return (
      <div className="w-full space-y-6">
        <PageHeader title="License key audit" subtitle="Super Admin only." />
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
        title="License key audit"
        subtitle="Who generated each key, which cohort and course it belongs to, and whether a student has redeemed it."
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/audit-hub" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Audit hub</Link>
        <Link href="/audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">System</Link>
        <Link href="/license-key-audit" className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">License keys</Link>
        <Link href="/coupon-audit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Coupons</Link>
        <Link href="/payment-qr?section=HISTORY" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">QR history</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={usedOnly}
            onChange={(e) => {
              setUsedOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Redeemed only
        </label>
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        </div>
      ) : data && data.rows.length === 0 ? (
        <EmptyState title="No license keys yet" description="Generate keys from a batch or verify a course payment to create records." />
      ) : data ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/80">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Key (masked)</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Course</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Batch</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Generated by</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Created</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Redeemed by</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Redeemed at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.keyMasked}</td>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="max-w-[16rem] font-medium leading-snug">{courseCell(row)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="max-w-[14rem] leading-snug">{batchCell(row)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="max-w-[12rem]">
                        <div className="truncate font-medium" title={row.createdByName}>
                          {row.createdByName}
                        </div>
                        <div className="truncate text-xs text-slate-500" title={row.createdByUsername}>
                          @{row.createdByUsername}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(row.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.usedByStudentId ? (
                        <div className="max-w-[12rem]">
                          <div className="truncate font-medium" title={row.usedByName ?? ""}>
                            {row.usedByName?.trim() || "Student"}
                          </div>
                          {row.usedByUsername?.trim() ? (
                            <div className="truncate text-xs text-slate-500" title={row.usedByUsername}>
                              @{row.usedByUsername}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(row.usedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>
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
