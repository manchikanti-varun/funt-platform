"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Award, RotateCcw } from "lucide-react";

interface Props {
  letterId: string;
  onDone: () => void;
  onClose: () => void;
}

export function ExperienceModal({ letterId, onDone, onClose }: Props) {
  const [endDate, setEndDate] = useState("");
  const [duties, setDuties] = useState("");
  const [performance, setPerformance] = useState("rendered services satisfactorily");
  const [busy, setBusy] = useState(false);

  async function handleIssue() {
    if (!endDate || !duties.trim()) return;
    setBusy(true);
    await api(`/api/letters/${letterId}/experience`, {
      method: "POST",
      body: JSON.stringify({
        endDate,
        dutiesDescription: duties.trim(),
        performanceSummary: performance.trim() || undefined,
      }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
            <Award className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Issue Experience Letter</h3>
            <p className="text-xs text-slate-500">Based on the accepted offer letter ({letterId})</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Last Working Day *</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Duties Performed *</label>
            <textarea
              value={duties}
              onChange={(e) => setDuties(e.target.value)}
              rows={3}
              className="input mt-1"
              placeholder="Handling Digital and offline marketing initiatives..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Performance Remark</label>
            <input value={performance} onChange={(e) => setPerformance(e.target.value)} className="input mt-1" />
          </div>
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={handleIssue}
            disabled={busy || !endDate || !duties.trim()}
            className="btn-primary inline-flex items-center gap-2 bg-purple-600 px-5 py-2.5 text-sm hover:bg-purple-500"
          >
            {busy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
            {busy ? "Issuing..." : "Issue Letter"}
          </button>
        </div>
      </div>
    </div>
  );
}
