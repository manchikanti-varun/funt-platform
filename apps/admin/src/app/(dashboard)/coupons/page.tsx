"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
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
  batchId?: string;
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

/** Must match backend COUPON_ALL_COURSES_ID — all courses in the selected batch. */
const ALL_COURSES_VALUE = "*";

/** Must match backend COUPON_ALL_BATCHES_ID. */
const ALL_BATCHES_VALUE = "*";

function batchCourseList(batch: BatchOpt | null): Array<{ courseId: string; title: string }> {
  if (!batch) return [];
  const snapshots = Array.isArray(batch.courseSnapshots)
    ? batch.courseSnapshots
    : batch.courseSnapshot
      ? [batch.courseSnapshot]
      : [];
  const dedup = new Map<string, string>();
  for (const snap of snapshots) {
    const cid = String(snap?.courseId ?? "").trim();
    if (!cid) continue;
    const title = String(snap?.title ?? cid).trim() || cid;
    if (!dedup.has(cid)) dedup.set(cid, title);
  }
  return Array.from(dedup.entries()).map(([courseId, title]) => ({ courseId, title }));
}

function kindLabel(k: CouponRow["kind"]) {
  return k === "SHOP" ? "Shop cart" : "Course checkout";
}

function scopeLabel(r: CouponRow, batchNameById: Map<string, string>): string {
  if (r.kind === "COURSE") {
    const audience = r.audience === "BATCH_STUDENTS" ? "Batch students" : "All students";
    const batchKey = r.batchId ?? "";
    const batch =
      batchKey === ALL_BATCHES_VALUE || batchKey.toUpperCase() === "ALL"
        ? "All batches"
        : batchNameById.get(batchKey) ?? batchKey;
    const course =
      r.courseId === ALL_COURSES_VALUE || r.courseId.toUpperCase() === "ALL"
        ? "All courses in batch"
        : r.courseId;
    return `Batch: ${batch} · Course: ${course} · ${audience}`;
  }
  return r.shopScope === "FIRST_ORDER" ? "Shop: first order only" : "Shop: all orders";
}

export default function AdminCouponsPage() {
  const { roles } = useAdminUser();
  const canCreateCoupons = roles.includes(ROLE.SUPER_ADMIN);
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [batches, setBatches] = useState<BatchOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CouponRow | null>(null);

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"SHOP" | "COURSE">("SHOP");
  const [shopScope, setShopScope] = useState<"ALL_ORDERS" | "FIRST_ORDER">("ALL_ORDERS");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseAudience, setCourseAudience] = useState<"ALL_STUDENTS" | "BATCH_STUDENTS">("ALL_STUDENTS");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const batchNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of batches) {
      m.set(b.id, b.name);
      if (b.batchId) m.set(b.batchId, b.name);
    }
    return m;
  }, [batches]);

  const isAllBatches = selectedBatchId === ALL_BATCHES_VALUE;
  const selectedBatch = useMemo(
    () => (isAllBatches ? null : batches.find((b) => b.id === selectedBatchId || b.batchId === selectedBatchId) ?? null),
    [batches, selectedBatchId, isAllBatches]
  );

  const selectedBatchCourseOptions = useMemo(() => {
    if (isAllBatches) {
      const dedup = new Map<string, string>();
      for (const b of batches) {
        for (const c of batchCourseList(b)) {
          if (!dedup.has(c.courseId)) dedup.set(c.courseId, c.title);
        }
      }
      return Array.from(dedup.entries()).map(([cid, title]) => ({ courseId: cid, title }));
    }
    return batchCourseList(selectedBatch);
  }, [batches, selectedBatch, isAllBatches]);

  const canPickAllCoursesInBatch = Boolean(selectedBatchId);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api<CouponRow[]>("/api/admin/coupons"), api<BatchOpt[]>("/api/batches")])
      .then(([cRes, batchRes]) => {
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
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (kind !== "COURSE") return;
    if (courseId === ALL_COURSES_VALUE && !canPickAllCoursesInBatch) {
      setCourseId("");
      return;
    }
    if (courseId === ALL_COURSES_VALUE) return;
    if (!selectedBatchId) {
      setCourseId("");
      return;
    }
    const valid = selectedBatchCourseOptions.some((c) => c.courseId === courseId);
    if (!valid) setCourseId("");
  }, [kind, selectedBatchId, selectedBatchCourseOptions, courseId, canPickAllCoursesInBatch]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const percent = Math.floor(Number(discountPercent));
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      setMsg("Discount percent must be between 1 and 100.");
      return;
    }
    if (kind === "COURSE" && !selectedBatchId) {
      setMsg("Select a batch or All batches.");
      return;
    }
    if (kind === "COURSE" && !courseId.trim()) {
      setMsg("Select a course or All courses.");
      return;
    }
    const res = await api("/api/admin/coupons", {
      method: "POST",
      body: JSON.stringify({
        code,
        kind,
        shopScope: kind === "SHOP" ? shopScope : undefined,
        batchId: kind === "COURSE" ? selectedBatchId : undefined,
        courseId: kind === "COURSE" ? courseId.trim() : undefined,
        audience: kind === "COURSE" ? courseAudience : undefined,
        discountType: "PERCENT",
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

  function deleteCouponRow(row: CouponRow) {
    setDeleteTarget(row);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setActingId(target.id);
    setMsg(null);
    const res = await api(`/api/admin/coupons/${encodeURIComponent(target.id)}`, { method: "DELETE" });
    setActingId(null);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r.id !== target.id));
      setMsg(`Coupon "${target.code}" deleted.`);
    } else {
      setMsg(res.message ?? "Failed to delete.");
    }
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
        subtitle="SHOP cart coupons and COURSE coupons scoped by batch and course. All courses applies to every course in the chosen batch."
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
                    required
                  >
                    <option value="">Select batch</option>
                    <option value={ALL_BATCHES_VALUE}>All batches</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.batchId || b.id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Course</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    required
                    disabled={!selectedBatchId}
                  >
                    <option value="">
                      {!selectedBatchId
                        ? "Select batch first"
                        : isAllBatches
                          ? "Select course"
                          : "Select course"}
                    </option>
                    {canPickAllCoursesInBatch && (
                      <option value={ALL_COURSES_VALUE}>All courses</option>
                    )}
                    {selectedBatchCourseOptions.map((c) => (
                      <option key={c.courseId} value={c.courseId}>
                        {c.title} ({c.courseId})
                      </option>
                    ))}
                  </select>
                  {canPickAllCoursesInBatch && selectedBatchCourseOptions.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      This batch has no courses. Pick another batch or update batch courses.
                    </p>
                  )}
                  {isAllBatches && (
                    <p className="mt-1 text-xs text-slate-500">
                      With All batches, pick a specific course or All courses (applies across all batches).
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
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
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
              <th className="px-4 py-3 font-semibold text-slate-700 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{r.code}</td>
                <td className="px-4 py-3 text-slate-600">{kindLabel(r.kind)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{scopeLabel(r, batchNameById)}</td>
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
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => deleteCouponRow(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No coupons yet.</p>}
      </DataPanel>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete coupon</h3>
                <p className="mt-0.5 text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Delete coupon <span className="font-mono font-bold text-slate-900">{deleteTarget.code}</span>?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
