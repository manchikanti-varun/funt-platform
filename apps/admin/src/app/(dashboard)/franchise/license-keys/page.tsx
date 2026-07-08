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
                  <p className="mt-2 text-xs text-red-500 font-medium"><svg className="inline h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> No keys remaining</p>
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
              {proofFileName && <span className="text-sm text-emerald-600 font-medium"><svg className="inline h-4 w-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>{proofFileName}</span>}
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
          <a href="tel:+916305930640" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            Call Us
          </a>
          <a href="https://wa.me/916305930640?text=Hi%2C%20I%20want%20to%20purchase%20license%20keys" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
            WhatsApp
          </a>
          <a href="mailto:info@funt.in?subject=License%20Key%20Purchase" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Email
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
