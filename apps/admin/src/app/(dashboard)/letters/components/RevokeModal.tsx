"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";

interface Props {
  letterId: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function RevokeModal({ letterId, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRevoke() {
    if (!reason.trim()) return;
    setBusy(true);
    await onConfirm(reason.trim());
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Revoke Letter</h3>
            <p className="text-xs text-slate-500">{letterId}</p>
          </div>
        </div>

        <label className="text-xs font-medium text-slate-600">Reason for revocation *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Explain why this letter is being revoked..."
          className="input mt-1"
          autoFocus
        />

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={handleRevoke}
            disabled={!reason.trim() || busy}
            className="btn-primary bg-red-600 px-4 py-2 text-sm hover:bg-red-500 inline-flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            {busy ? "Revoking..." : "Revoke Letter"}
          </button>
        </div>
      </div>
    </div>
  );
}
