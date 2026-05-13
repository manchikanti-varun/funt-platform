"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Auto-saves a form's in-memory state to `localStorage`, debounced.
 *
 * The goal is to make accidental tab closes, browser crashes, and the all
 * too common "I bumped Ctrl+R while typing into a 30-min chapter" totally
 * recoverable. The next time the user opens the same page in the same
 * browser we restore the draft as the form's initial value and surface a
 * small banner so they know what happened.
 *
 * Drafts are scoped per-browser/per-origin only — they never reach the
 * server. Successful submits should call `clearDraft()`.
 *
 * Stored shape: `{ version, savedAt, data }`. Bump `version` whenever you
 * add/remove fields that would break old drafts (the hook silently drops
 * mismatches).
 */
export interface UseAutoSavedFormOptions {
  /** Debounce in ms between the last keystroke and the LS write. Default 800. */
  debounceMs?: number;
  /** Schema version. Drafts written with a different version are discarded. Default 1. */
  version?: number;
}

export interface UseAutoSavedFormResult<T> {
  value: T;
  setValue: (updater: T | ((prev: T) => T)) => void;
  /** True iff a previously-saved draft was found and used as the initial value. */
  hasRestoredDraft: boolean;
  /** Epoch ms of the saved draft we restored, if any. */
  draftSavedAt: number | null;
  /** Discard the draft AND reset to `initialValue`. Wire to the banner's Discard button. */
  discardDraft: () => void;
  /** Remove the draft from storage but keep current in-memory value. Call after successful submit. */
  clearDraft: () => void;
}

const STORAGE_PREFIX = "funt_admin_draft:";

interface StoredDraft<T> {
  version: number;
  savedAt: number;
  data: T;
}

function readDraft<T>(key: string, version: number): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft<T>>;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (parsed.version !== version) return null;
    if (typeof parsed.savedAt !== "number" || parsed.data === undefined) return null;
    return parsed as StoredDraft<T>;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, version: number, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDraft<T> = { version, savedAt: Date.now(), data };
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // Quota exceeded / privacy mode — best-effort, swallow.
  }
}

function removeDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

export function useAutoSavedForm<T>(
  key: string,
  initialValue: T,
  options: UseAutoSavedFormOptions = {}
): UseAutoSavedFormResult<T> {
  const { debounceMs = 800, version = 1 } = options;

  const initialRef = useRef(initialValue);
  const [value, setValueState] = useState<T>(initialValue);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Restore once on mount. Subsequent renders never re-read storage so the
  // user is free to discard the draft and start over.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = readDraft<T>(key, version);
    if (draft) {
      setValueState(draft.data);
      setHasRestoredDraft(true);
      setDraftSavedAt(draft.savedAt);
    }
  }, [key, version]);

  // Debounced write. We only start saving once the value has actually
  // diverged from `initialValue` to avoid stamping a redundant empty draft
  // on mount.
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeDraft(key, version, value);
      setDraftSavedAt(Date.now());
    }, debounceMs);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [key, version, value, debounceMs]);

  const setValue = useCallback((updater: T | ((prev: T) => T)) => {
    dirtyRef.current = true;
    setValueState((prev) =>
      typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater
    );
  }, []);

  const clearDraft = useCallback(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    removeDraft(key);
    setHasRestoredDraft(false);
    setDraftSavedAt(null);
    dirtyRef.current = false;
  }, [key]);

  const discardDraft = useCallback(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    removeDraft(key);
    setValueState(initialRef.current);
    setHasRestoredDraft(false);
    setDraftSavedAt(null);
    dirtyRef.current = false;
  }, [key]);

  return useMemo(
    () => ({ value, setValue, hasRestoredDraft, draftSavedAt, discardDraft, clearDraft }),
    [value, setValue, hasRestoredDraft, draftSavedAt, discardDraft, clearDraft]
  );
}

/** Render a short, human-friendly "X minutes ago" for the banner. */
export function formatDraftAge(savedAt: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - savedAt);
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 30) return "just now";
  if (seconds < 90) return "a minute ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "a day ago" : `${days} days ago`;
}
