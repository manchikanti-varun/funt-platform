"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface BatchOption {
  id: string;
  name: string;
}

export default function EnrollmentsPage() {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<BatchOption[]>("/api/batches").then((r) => {
      if (r.success && Array.isArray(r.data)) setBatches(r.data);
      else setBatchesError(r.message ?? "Could not load batches");
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId.trim() || !batchId.trim()) {
      setMessage({ type: "error", text: "Both student and batch are required." });
      return;
    }
    setMessage(null);
    setLoading(true);
    const res = await api("/api/enrollments", {
      method: "POST",
      body: JSON.stringify({ studentId: studentId.trim(), batchId }),
    });
    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: "Enrolled." });
      setStudentId("");
      setBatchId("");
    } else {
      setMessage({ type: "error", text: res.message ?? "Could not enroll." });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Enrollments</h1>
      <form onSubmit={submit} className="card max-w-md space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Student</label>
          <input
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="input"
            placeholder="Username or ID"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Batch</label>
          {batchesError ? (
            <p className="text-sm text-red-600">{batchesError}</p>
          ) : (
            <select required value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input">
              <option value="">Select batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {message ? (
          <div className={message.type === "success" ? "alert--success" : "alert--error"}>
            {message.text}
          </div>
        ) : null}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving…" : "Enroll"}
        </button>
      </form>
    </div>
  );
}
