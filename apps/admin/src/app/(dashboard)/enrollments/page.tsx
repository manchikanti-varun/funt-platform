"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface BatchOption {
  id: string;
  name: string;
}

export default function EnrollmentsPage() {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<BatchOption[]>("/api/batches").then((r) => {
      if (r.success && Array.isArray(r.data)) setBatches(r.data);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const res = await api("/api/enrollments", {
      method: "POST",
      body: JSON.stringify({ studentId, batchId }),
    });
    setLoading(false);
    if (res.success) setMessage({ type: "success", text: "Enrollment created." });
    else setMessage({ type: "error", text: res.message ?? "Failed." });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Enrollments</h1>
      <p className="text-slate-500 text-sm">Enroll a student into a batch. Only Admin and Super Admin can create enrollments.</p>
      <form onSubmit={submit} className="card max-w-md space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Student FUNT ID</label>
          <input required value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input font-mono" placeholder="e.g. FS-26-00001" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Batch</label>
          <select required value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input">
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {message && <p className={message.type === "success" ? "text-emerald-400 text-sm" : "text-red-400 text-sm"}>{message.text}</p>}
        <button type="submit" disabled={loading} className="btn-primary">Create Enrollment</button>
      </form>
    </div>
  );
}
