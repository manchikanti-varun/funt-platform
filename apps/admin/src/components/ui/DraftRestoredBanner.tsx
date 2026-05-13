"use client";

import { ArchiveRestore } from "lucide-react";
import { formatDraftAge } from "@/lib/useAutoSavedForm";

interface Props {
  /** Epoch ms from `useAutoSavedForm.draftSavedAt`. */
  savedAt: number;
  /** Called when the user clicks "Discard draft". */
  onDiscard: () => void;
}

/**
 * Banner shown at the top of a create form when an unsaved draft from a
 * previous session has been restored. Tells the user what happened and lets
 * them throw the draft away with one click.
 */
export function DraftRestoredBanner({ savedAt, onDiscard }: Props) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
      <div className="flex items-start gap-2.5">
        <ArchiveRestore className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div>
          <p className="font-semibold">Restored your unsaved draft.</p>
          <p className="mt-0.5 text-amber-800">
            We auto-saved this form locally {formatDraftAge(savedAt)}. Continue editing, or discard
            to start over.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDiscard}
        className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
      >
        Discard draft
      </button>
    </div>
  );
}
