"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { CalendarPlus, RotateCcw } from "lucide-react";

interface Props {
  letterId: string;
  onDone: () => void;
  onClose: () => void;
}

export function ExtendModal({ letterId, onDone, onClose }: Props) {
  const [months, setMonths] = useState("3");
  const [stipend, setStipend] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleExtend() {
    setBusy(true);
    await api(`/api/letters/${letterId}/extend`, {
      method: "POST",
      body: JSON.stringify({
        extensionMonths: parseInt(months),
        stipend: stipend.trim() || undefined,
      }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
            <CalendarPlus className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Extend Internship</h3>
            <p className="text-xs text-slate-500">Updates the end date on the existing letter.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Extend by</label>
            <select value={months} onChange={(e) => setMonths(e.target.value)} className="input mt-1">
              <option value="1">1 Month</option>
              <option value="2">2 Months</option>
              <option value="3">3 Months</option>
              <option value="4">4 Months</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">New Stipend (leave empty to keep same)</label>
            <input
              value={stipend}
              onChange={(e) => setStipend(e.target.value)}
              className="input mt-1"
              placeholder="e.g. 8,000 (Eight Thousand Only)"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={handleExtend}
            disabled={busy}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            {busy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            {busy ? "Extending..." : "Extend"}
          </button>
        </div>
      </div>
    </div>
  );
}
