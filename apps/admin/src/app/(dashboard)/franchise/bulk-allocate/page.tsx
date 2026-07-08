"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel, PageHeader, Button, useAppDialog } from "@/components/ui";

interface FranchiseOption { id: string; franchiseCode: string; centerName: string; }
interface CourseOption { courseId: string; title: string; }
interface AllocationRow { franchiseId: string; centerName: string; courseId: string; count: number; }

export default function BulkAllocatePage() {
  const dialog = useAppDialog();
  const [franchises, setFranchises] = useState<FranchiseOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [rows, setRows] = useState<AllocationRow[]>([{ franchiseId: "", centerName: "", courseId: "", count: 10 }]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ centers: FranchiseOption[] }>("/api/franchise/admin/centers"),
      api<{ courses: CourseOption[] }>("/api/franchise/courses"),
    ]).then(([fRes, cRes]) => {
      if (fRes.success && fRes.data?.centers) setFranchises(fRes.data.centers);
      if (cRes.success && cRes.data?.courses) setCourses(cRes.data.courses);
    }).finally(() => setLoading(false));
  }, []);

  function addRow() {
    setRows([...rows, { franchiseId: "", centerName: "", courseId: "", count: 10 }]);
  }

  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: keyof AllocationRow, value: string | number) {
    const updated = [...rows];
    if (field === "franchiseId") {
      const f = franchises.find((f) => f.id === value);
      updated[i] = { ...updated[i], franchiseId: value as string, centerName: f?.centerName ?? "" };
    } else if (field === "count") {
      updated[i] = { ...updated[i], count: Number(value) || 0 };
    } else {
      updated[i] = { ...updated[i], [field]: value };
    }
    setRows(updated);
  }

  async function handleSubmit() {
    const valid = rows.filter((r) => r.franchiseId && r.courseId && r.count > 0);
    if (valid.length === 0) {
      await dialog.alert({ title: "Error", message: "Add at least one valid allocation row." });
      return;
    }

    const confirmed = await dialog.confirm({
      title: "Confirm Bulk Allocation",
      message: `Allocate keys to ${valid.length} franchise(s)? This action cannot be undone.`,
      confirmLabel: "Allocate",
    });
    if (!confirmed) return;

    setSubmitting(true);
    let successCount = 0;
    for (const row of valid) {
      const res = await api(`/api/franchise/admin/centers/${row.franchiseId}/allocate-keys`, {
        method: "POST",
        body: JSON.stringify({ courseId: row.courseId, count: row.count }),
      });
      if (res.success) successCount++;
    }
    setSubmitting(false);

    await dialog.alert({
      title: "Done",
      message: `${successCount} of ${valid.length} allocations completed successfully.`,
    });
    setRows([{ franchiseId: "", centerName: "", courseId: "", count: 10 }]);
  }

  if (loading) {
    return <AppPageShell><div className="flex justify-center py-20"><div className="spinner" /></div></AppPageShell>;
  }

  return (
    <AppPageShell>
      <PageHeader title="Bulk Key Allocation" subtitle="Allocate license keys to multiple franchises at once." />

      <FormPanel className="mt-6">
        <div className="p-6 space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-600">
                  <th className="pb-2 pr-3">Franchise</th>
                  <th className="pb-2 pr-3">Course</th>
                  <th className="pb-2 pr-3 w-24">Keys</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <select value={row.franchiseId} onChange={(e) => updateRow(i, "franchiseId", e.target.value)} className="input w-full text-sm">
                        <option value="">Select franchise...</option>
                        {franchises.map((f) => <option key={f.id} value={f.id}>{f.centerName} ({f.franchiseCode})</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select value={row.courseId} onChange={(e) => updateRow(i, "courseId", e.target.value)} className="input w-full text-sm">
                        <option value="">Select course...</option>
                        {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" value={row.count} onChange={(e) => updateRow(i, "count", e.target.value)} className="input w-full text-sm" min={1} />
                    </td>
                    <td className="py-2">
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={addRow} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">+ Add row</button>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Allocating…" : `Allocate All (${rows.filter((r) => r.franchiseId && r.courseId && r.count > 0).length} rows)`}
            </Button>
          </div>
        </div>
      </FormPanel>
    </AppPageShell>
  );
}
