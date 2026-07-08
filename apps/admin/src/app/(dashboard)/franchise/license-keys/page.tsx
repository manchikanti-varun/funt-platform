"use client";

import { useEffect, useState, useRef } from "react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pools, setPools] = useState<KeyPool[]>([]);
  const [requests, setRequests] = useState<KeyRequest[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courseId, setCourseId] = useState("");
  const [count, setCount] = useState("10");
  const [note, setNote] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [proofFileName, setProofFileName] = useState("");

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, WebP, or PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum 10 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    const presignRes = await api<{ uploadUrl: string; publicUrl: string }>(
      "/api/franchise/upload-proof",
      { method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type }) }
    );
    if (!presignRes.success || !presignRes.data) {
      setError(presignRes.message ?? "Failed to get upload URL. Paste a URL instead.");
      setUploading(false);
      return;
    }
    try {
      const resp = await fetch(presignRes.data.uploadUrl, {
        method: "PUT", body: file, headers: { "Content-Type": file.type },
      });
      if (!resp.ok) throw new Error("Upload failed");
      setPaymentProofUrl(presignRes.data.publicUrl);
      setProofFileName(file.name);
    } catch {
      setError("Upload failed. You can paste a URL manually.");
    }
    setUploading(false);
  }

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
      await dialog.alert({ title: "Request Submitted", message: "Your key purchase request has been sent for approval." });
      setCourseId(""); setCount("10"); setNote(""); setPaymentProofUrl(""); setProofFileName("");
      loadData();
    } else {
      setError(res.message ?? "Failed to submit request");
    }
  }

  return (
    <AppPageShell>
      <PageHeader title="License Keys" subtitle="View key balance, request more keys, or contact us directly." />

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
                    <p className={`text-2xl font-bold ${p.available > 0 ? "text-indigo-700" : "text-red-600"}`}>{p.available}</p>
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
                {p.available === 0 && (
                  <p className="mt-2 text-xs text-red-500 font-medium">⚠ No keys remaining</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request More Keys Form */}
      <FormPanel className="mt-6">
        <form onSubmit={handleRequest} className="p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Request More Keys</h3>
          <p className="text-xs text-slate-500">Upload payment proof. Admin will review and allocate keys.</p>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          {/* Payment Proof Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Payment Proof</label>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">Upload screenshot or receipt (JPG, PNG, PDF — max 10 MB)</p>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileUpload} className="hidden" />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {uploading ? "Uploading…" : "Upload File"}
              </button>
              {proofFileName && <span className="text-sm text-emerald-600 font-medium">✓ {proofFileName}</span>}
            </div>
            {!proofFileName && (
              <div className="mt-2">
                <p className="text-xs text-slate-400 mb-1">Or paste a URL:</p>
                <input type="url" value={paymentProofUrl} onChange={(e) => setPaymentProofUrl(e.target.value)} className="input w-full" placeholder="https://..." />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1 w-full" placeholder="e.g., Paid ₹50,000 via NEFT ref ABC123" />
          </div>

          <Button type="submit" variant="primary" disabled={submitting || uploading}>
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </form>
      </FormPanel>

      {/* Contact Us */}
      <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-blue-800">Need help or want to purchase keys directly?</h3>
        <p className="mt-1 text-sm text-blue-700">Contact FUNT Robotics for bulk purchases, custom pricing, or questions.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href="tel:+919XXXXXXXXX" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
            📞 Call Us
          </a>
          <a href="https://wa.me/919XXXXXXXXX?text=Hi%2C%20I%20want%20to%20purchase%20license%20keys" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition">
            💬 WhatsApp
          </a>
          <a href="mailto:support@funtrobotics.in?subject=License%20Key%20Purchase" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition">
            ✉️ Email
          </a>
        </div>
      </div>

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
                        r.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                      }`}>{r.status}</span>
                      {r.status === "REJECTED" && r.rejectionReason && (
                        <p className="mt-1 text-xs text-red-500">{r.rejectionReason}</p>
                      )}
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
