import type { ButtonHTMLAttributes } from "react";

const ICON = "h-5 w-5";

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
      <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}

function LockClosedIcon() {
  return (
    <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

function LockOpenIcon() {
  return (
    <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

/**
 * Toggle LMS access block for an enrollment.
 * When access is allowed → lock icon (amber) = block.
 * When blocked → unlock icon (slate) = restore.
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
          ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-50"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
      }
      {...props}
    >
      {accessBlocked ? <LockOpenIcon /> : <LockClosedIcon />}
    </button>
  );
}
