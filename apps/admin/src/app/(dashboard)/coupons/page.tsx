"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, FormPanel } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ROLE } from "@funt-platform/constants";

interface CouponRow {
  id: string;
  code: string;
  kind: "COURSE" | "SHOP";
  courseId: string;
  shopScope?: "ALL_ORDERS" | "FIRST_ORDER";
  discountType: "PERCENT";
  discountValue: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  perStudentLimit: number;
  validUntil?: string;
  active: boolean;
  notes: string;
  audience?: "ALL_STUDENTS" | "BATCH_STUDENTS";
}

interface BatchCourseSnapshot {
  courseId?: string;
  title?: string;
}

interface BatchOpt {
  id: string;
  batchId: string;
  name: string;
  courseSnapshots?: BatchCourseSnapshot[];
  courseSnapshot?: BatchCourseSnapshot | null;
}

interface CourseOpt {
  id?: string;
  courseId?: string;
  title?: string;
}

function kindLabel(k: CouponRow["kind"]) {
  return k === "SHOP" ? "Shop cart" : "Course checkout";
}

function scopeLabel(r: CouponRow): string {
  if (r.kind === "COURSE") {
    const audience = r.audience === "BATCH_STUDENTS" ? "Batch students" : "All students";
    return `Course: ${r.courseId} · ${audience}`;
  }
  return r.shopScope === "FIRST_ORDER" ? "Shop: first order only" : "Shop: all orders";
}

export default function AdminCouponsPage() {
  const { roles } = useAdminUser();
  const canCreateCoupons = roles.includes(ROLE.SUPER_ADMIN);
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [batches, setBatches] = useState<BatchOpt[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"SHOP" | "COURSE">("SHOP");
  const [shopScope, setShopScope] = useState<"ALL_ORDERS" | "FIRST_ORDER">("ALL_ORDERS");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseAudience, setCourseAudience] = useState<"ALL_STUDENTS" | "BATCH_STUDENTS">("ALL_STUDENTS");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId || b.batchId === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  const selectedBatchCourseOptions = useMemo(() => {
    if (courseAudience === "ALL_STUDENTS") {
      const dedup = new Map<string, string>();
      for (const c of courses) {
        const cid = String(c.courseId ?? c.id ?? "").trim();
        if (!cid) continue;
        const title = String(c.title ?? cid).trim() || cid;
        if (!dedup.has(cid)) dedup.set(cid, title);
      }
      return Array.from(dedup.entries()).map(([cid, title]) => ({ courseId: cid, title }));
    }
    if (!selectedBatch) return [];
    const snapshots = Array.isArray(selectedBatch.courseSnapshots)
      ? selectedBatch.courseSnapshots
      : selectedBatch.courseSnapshot
        ? [selectedBatch.courseSnapshot]
        : [];
    const dedup = new Map<string, string>();
    for (const snap of snapshots) {
      const cid = String(snap?.courseId ?? "").trim();
      if (!cid) continue;
      const title = String(snap?.title ?? cid).trim() || cid;
      if (!dedup.has(cid)) dedup.set(cid, title);
    }
    return Array.from(dedup.entries()).map(([cid, title]) => ({ courseId: cid, title }));
  }, [selectedBatch, courseAudience, courses]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<CouponRow[]>("/api/admin/coupons"),
      api<BatchOpt[]>("/api/batches"),
      api<CourseOpt[]>("/api/courses"),
    ])
      .then(([cRes, batchRes, courseRes]) => {
        if (cRes.success && Array.isArray(cRes.data)) {
          setRows(cRes.data.filter((r) => r.kind === "SHOP" || r.kind === "COURSE"));
        } else {
          setRows([]);
        }

        if (batchRes.success && Array.isArray(batchRes.data)) {
          setBatches(batchRes.data);
        } else {
          setBatches([]);
        }
        if (courseRes.success && Array.isArray(courseRes.data)) {
          setCourses(courseRes.data);
        } else {
          setCourses([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (kind !== "COURSE") return;
    if (!selectedBatch) return;
    const valid = selectedBatchCourseOptions.some((c) => c.courseId === courseId);
    if (!valid) setCourseId("");
  }, [kind, selectedBatch, selectedBatchCourseOptions, courseId]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const percent = Math.floor(Number(discountPercent));
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      setMsg("Discount percent must be between 1 and 100.");
      return;
    }
    if (kind === "COURSE" && !selectedBatchId) {
      setMsg("Pick a batch first.");
      return;
    }
    if (kind === "COURSE" && !courseId.trim()) {
      setMsg("Pick a course from the selected batch.");
      return;
    }
    const res = await api("/api/admin/coupons", {
      method: "POST",
      body: JSON.stringify({
        code,
        kind,
        shopScope: kind === "SHOP" ? shopScope : undefined,
        courseId: kind === "COURSE" ? courseId.trim() : undefined,
        audience: kind === "COURSE" ? courseAudience : undefined,
        discountValue: percent,
        validUntil: validUntil.trim() ? new Date(validUntil).toISOString() : undefined,
        notes: notes.trim() || undefined,
      }),
    });
    if (res.success) {
      setMsg("Coupon created.");
      setCode("");
      setNotes("");
      setSelectedBatchId("");
      setCourseId("");
      setCourseAudience("ALL_STUDENTS");
      load();
    } else {
      setMsg(res.message ?? "Failed");
    }
  }

  async function toggleActive(row: CouponRow) {
    setActingId(row.id);
    setMsg(null);
    const res = await api(`/api/admin/coupons/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !row.active }),
    });
    setActingId(null);
    if (res.success) load();
    else setMsg(res.message ?? "Failed");
  }

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600" />
      </div>
    );
  }

  return (
    <AppPageShell className="w-full gap-8">
      <RequireRoles roles={[ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <PageHeader
        title="Coupons"
        subtitle="Simple model: SHOP cart coupons and COURSE coupons. Admin sets code + percent, validity, and active state."
      />

      {msg && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{msg}</div>}

      {canCreateCoupons ? (
        <FormPanel className="space-y-4 p-6">
          <form onSubmit={createCoupon} className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Create coupon</h2>
            <p className="text-sm text-slate-600">One user can use a coupon only once. Discount is always percentage based.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Code</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Coupon type</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={kind}
                onChange={(e) => {
                  const next = e.target.value as "SHOP" | "COURSE";
                  setKind(next);
                  if (next !== "COURSE") {
                    setSelectedBatchId("");
                    setCourseId("");
                  }
                }}
              >
                <option value="SHOP">Shop cart</option>
                <option value="COURSE">Course checkout</option>
              </select>
            </label>
          </div>
          {kind === "SHOP" ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Eligibility</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={shopScope}
                onChange={(e) => setShopScope(e.target.value as "ALL_ORDERS" | "FIRST_ORDER")}
              >
                <option value="ALL_ORDERS">All orders (if active)</option>
                <option value="FIRST_ORDER">First order only</option>
              </select>
            </label>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">Eligibility</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={courseAudience}
                  onChange={(e) => setCourseAudience(e.target.value as "ALL_STUDENTS" | "BATCH_STUDENTS")}
                >
                  <option value="ALL_STUDENTS">All students</option>
                  <option value="BATCH_STUDENTS">Only selected batch students</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Batch</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={selectedBatchId}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value);
                    setCourseId("");
                  }}
                  required={courseAudience === "BATCH_STUDENTS"}
                  disabled={courseAudience === "ALL_STUDENTS"}
                >
                  <option value="">{courseAudience === "ALL_STUDENTS" ? "Batch not required for all students" : "Select batch"}</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.batchId || b.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Course (from batch)</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                  disabled={courseAudience === "BATCH_STUDENTS" && !selectedBatchId}
                >
                  <option value="">
                    {courseAudience === "BATCH_STUDENTS"
                      ? selectedBatchId
                        ? "Select course"
                        : "Select batch first"
                      : "Select course"}
                  </option>
                  {selectedBatchCourseOptions.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.title} ({c.courseId})
                    </option>
                  ))}
                </select>
                {courseAudience === "BATCH_STUDENTS" && selectedBatchId && selectedBatchCourseOptions.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    This batch has no course snapshots. Pick another batch or update batch courses.
                  </p>
                )}
              </label>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Discount percent</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                min={1}
                max={100}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Valid until (optional)</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Internal notes</span>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
            <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
              Create coupon
            </button>
          </form>
        </FormPanel>
      ) : (
        <FormPanel className="p-6">
          <p className="text-sm font-medium text-amber-800">Only Super Admin can create coupons.</p>
        </FormPanel>
      )}

      <DataPanel>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Existing coupons</h3>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-700">Code</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Scope</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Discount</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Uses</th>
              <th className="px-4 py-3 font-semibold text-slate-700 w-28">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{r.code}</td>
                <td className="px-4 py-3 text-slate-600">{kindLabel(r.kind)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{scopeLabel(r)}</td>
                <td className="px-4 py-3 text-slate-700">{r.discountValue}%</td>
                <td className="px-4 py-3 text-slate-600">{r.redemptionCount}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => toggleActive(r)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${r.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                  >
                    {r.active ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No coupons yet.</p>}
      </DataPanel>
    </AppPageShell>
  );
}
