"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, FormPanel, PageHeader, Button, useAppDialog } from "@/components/ui";

interface KeyPool {
  courseId: string;
  courseTitle: string;
  totalAllocated: number;
  totalUsed: number;
  available: number;
}

interface KeyRequest {
  id: string;
  courseId: string;
  courseTitle: string;
  requestedCount: number;
  allocatedCount: number;
  status: string;
  note: string;
  rejectionReason: string;
  createdAt: string;
  processedAt: string | null;
}

interface CourseOption { courseId: string; title: string }

export default function FranchiseLicenseKeysPage() {
  const dialog = useAppDialog();
  const [pools, setPools] = useState<KeyPool[]>([]);
  const [requests, setRequests] = useState<KeyRequest[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request form
  const [courseId, setCourseId] = useState("");
  const [count, setCount] = useState("10");
  const [note, setNote] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");

  async function loadData() {
    setLoading(true);
    const [poolRes, reqRes, courseRes] = await Promise.all([
      api<{ pools: KeyPool[] }>("/api/franchise/key-pool"),
      api<{ requests: KeyRequest[] }>("/api/franchise/key-requests"),
      api<{ courses: CourseOption[] }>("/api/franchise/courses"),
    ]);
    if (poolRes.success && poolRes.data?.pools) setPools(poolRes.data.pools);
    if (reqRes.success && reqRes.data?.requests) setRequests(reqRes.data.requests);
    if (courseRes.success && courseRes.data?.courses) setCourses(courseRes.data.courses);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!courseId) { setError("Select a course"); return; }
    if (!count || Number(count) < 1) { setError("Enter a valid count"); return; }

    setSubmitting(true);
    const res = await api("/api/franchise/key-requests", {
      method: "POST",
      body: JSON.stringify({
        courseId,
        requestedCount: Number(count),
        paymentProofUrl: paymentProofUrl.trim() || undefined,
        note: note.trim() || undefined,
      }),
    });
    setSubmitting(false);

    if (res.success) {
      await dialog.alert({ title: "Request Submitted", message: "Your key purchase request has been sent to the parent admin for approval." });
      setCourseId(""); setCount("10"); setNote(""); setPaymentProofUrl("");
      loadData();
    } else {
      setError(res.message ?? "Failed to submit request");
    }
  }

  return (
    <AppPageShell>
      <PageHeader title="License Keys" subtitle="View your key balance and request more keys from parent." />

      {/* Key Pool Status */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Your Key Balance</h3>
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner" /></div>
        ) : pools.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No keys allocated yet. Request keys below.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pools.map((p) => (
              <div key={p.courseId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">{p.courseTitle}</p>
                <div className="mt-3 flex items-baseline gap-4">
                  <div>
                    <p className="text-2xl font-bold text-indigo-700">{p.available}</p>
                    <p className="text-xs text-slate-500">Available</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-600">{p.totalUsed}</p>
                    <p className="text-xs text-slate-500">Used</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-400">{p.totalAllocated}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request More Keys */}
      <FormPanel className="mt-6">
        <form onSubmit={handleRequest} className="p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Request More Keys</h3>
          <p className="text-xs text-slate-500">Submit a request to buy more keys. Attach payment proof and the admin will approve.</p>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Course *</label>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input mt-1 w-full">
                <option value="">Select course...</option>
                {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Number of Keys *</label>
              <input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="input mt-1 w-full" min={1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Payment Proof URL</label>
              <input type="url" value={paymentProofUrl} onChange={(e) => setPaymentProofUrl(e.target.value)} className="input mt-1 w-full" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1 w-full" placeholder="e.g., Paid ₹50,000 via NEFT ref ABC123" />
          </div>

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </form>
      </FormPanel>

      {/* Request History */}
      <DataPanel className="mt-6">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-sm font-semibold text-slate-700">Request History</p>
        </div>
        {requests.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Course</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Requested</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Allocated</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-sm text-slate-800">{r.courseTitle}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{r.requestedCount}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{r.allocatedCount || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                        r.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
