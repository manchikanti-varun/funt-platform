import type { ButtonHTMLAttributes } from "react";
import { Archive, ArchiveRestore, Lock, LockOpen, Trash2 } from "lucide-react";

const ICON = "h-4.5 w-4.5";

/** Trash — use for delete / remove row actions (destructive). */
export function DeleteIconButton({
  title = "Remove",
  "aria-label": ariaLabel,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-50 ${className}`}
      {...props}
    >
      <Trash2 className={ICON} aria-hidden />
    </button>
  );
}

/**
 * Toggle LMS access block for an enrollment.
 * Icon reflects current state:
 * - lock = blocked
 * - unlock = allowed
 */
export function AccessToggleIconButton({
  accessBlocked,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { accessBlocked: boolean }) {
  const title = accessBlocked ? "Restore access" : "Block access";
  return (
    <button
      type="button"
      title={title}
      aria-label={accessBlocked ? "Restore LMS access" : "Block LMS access"}
      className={
        accessBlocked
          ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
      }
      {...props}
    >
      {accessBlocked ? <Lock className={ICON} aria-hidden /> : <LockOpen className={ICON} aria-hidden />}
    </button>
  );
}

/** Archive — soft-archive an entity (move to archived list). */
export function ArchiveIconButton({
  title = "Archive",
  "aria-label": ariaLabel,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 hover:text-amber-800 disabled:opacity-50 ${className}`}
      {...props}
    >
      <Archive className={ICON} aria-hidden />
    </button>
  );
}

/** Unarchive — restore an archived entity to active. */
export function UnarchiveIconButton({
  title = "Unarchive",
  "aria-label": ariaLabel,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-50 ${className}`}
      {...props}
    >
      <ArchiveRestore className={ICON} aria-hidden />
    </button>
  );
}
