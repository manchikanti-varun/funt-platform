"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Trash2, AlertTriangle } from "lucide-react";

interface Props {
  letterId: string;
  recipientName: string;
  onDeleted: () => void;
  onClose: () => void;
}

export function DeleteModal({ letterId, recipientName, onDeleted, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setBusy(true);
    setError("");
    const r = await api(`/api/letters/${letterId}`, { method: "DELETE" });
    setBusy(false);
    if (r.success) {
      onDeleted();
    } else {
      setError(r.message ?? "Failed to delete letter.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Delete Draft Letter</h3>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Are you sure you want to permanently delete the draft letter for{" "}
              <span className="font-semibold">{recipientName}</span>?
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="btn-primary inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-sm hover:bg-red-500"
          >
            <Trash2 className="h-4 w-4" />
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
