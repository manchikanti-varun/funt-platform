"use client";

/**
 * ContentProtectionProvider
 *
 * Mounts all content-protection behaviours based on the effective policy
 * fetched from the backend. This replaces the hard-coded event listeners
 * previously inline in StudentLayout.tsx.
 *
 * Protections active here:
 *   - Right-click / context menu blocking
 *   - Drag-start blocking for images and videos
 *   - Keyboard shortcut blocking (DevTools, Copy, Print, Save, etc.)
 *   - Text selection disabling (CSS + selectstart)
 *   - PrintScreen deterrence (clears clipboard)
 *   - Ctrl+P / print blocking
 *
 * Visual components (watermark, devtools banner, screen-share banner)
 * are mounted as siblings so they can independently manage their own
 * state without re-rendering this component's effect tree.
 */

import { useEffect, useRef } from "react";
import { useProtection } from "./ProtectionContext";
import { WatermarkOverlay } from "./WatermarkOverlay";
import { DevToolsDetector } from "./DevToolsDetector";
import { ScreenShareDetector } from "./ScreenShareDetector";

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function ContentProtectionProvider({ children }: { children: React.ReactNode }) {
  const { policy, logEvent, ready } = useProtection();

  // Ref so event handlers always close over the latest policy
  // without needing to re-register listeners on every policy change.
  const policyRef = useRef(policy);
  const logRef = useRef(logEvent);
  useEffect(() => { policyRef.current = policy; }, [policy]);
  useEffect(() => { logRef.current = logEvent; }, [logEvent]);

  // ── Apply / remove user-select: none on <body> ──────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (policy.disableTextSelection) {
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
    } else {
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    }
    return () => {
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, [ready, policy.disableTextSelection]);

  // ── Block print (Ctrl+P / Cmd+P) via CSS ────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let styleEl: HTMLStyleElement | null = null;
    if (policy.screenshotProtection || policy.disableKeyboardShortcuts) {
      styleEl = document.createElement("style");
      styleEl.id = "funt-print-block";
      styleEl.textContent = "@media print { body { display: none !important; } }";
      document.head.appendChild(styleEl);
    }
    return () => {
      styleEl?.remove();
    };
  }, [ready, policy.screenshotProtection, policy.disableKeyboardShortcuts]);

  // ── Event listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;

    // contextmenu
    function onContextMenu(e: MouseEvent) {
      if (!policyRef.current.disableRightClick) return;
      e.preventDefault();
      logRef.current("CONTENT_PROTECTION_RIGHT_CLICK_BLOCKED");
    }

    // selectstart — belt-and-suspenders on top of the CSS
    function onSelectStart(e: Event) {
      if (!policyRef.current.disableTextSelection) return;
      const target = e.target as HTMLElement | null;
      if (target && isEditableTarget(target)) return;
      e.preventDefault();
    }

    // dragstart — block drag of images/videos
    function onDragStart(e: DragEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName?.toLowerCase();
      if (tag === "img" || tag === "video" || t.closest("img, video")) {
        e.preventDefault();
      }
    }

    // keydown — shortcut blocking
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // DevTools shortcuts — always block if devToolsProtection on
      if (policyRef.current.devToolsProtection) {
        const isDevTools =
          key === "f12" ||
          (ctrl && shift && (key === "i" || key === "j" || key === "c")) ||
          (ctrl && key === "u") ||
          (ctrl && alt && key === "i"); // Cmd+Opt+I on Mac
        if (isDevTools) {
          e.preventDefault();
          logRef.current("CONTENT_PROTECTION_SHORTCUT_BLOCKED", { event: key });
          return;
        }
      }

      if (!policyRef.current.disableKeyboardShortcuts) return;

      // PrintScreen
      if (key === "printscreen") {
        e.preventDefault();
        void navigator.clipboard?.writeText?.("").catch(() => {});
        logRef.current("CONTENT_PROTECTION_SHORTCUT_BLOCKED", { event: "printscreen" });
        return;
      }

      // Ctrl/Cmd combos
      if (ctrl) {
        const blocked = new Set(["s", "p", "a"]);
        if (blocked.has(key) && !isEditableTarget(e.target)) {
          e.preventDefault();
          logRef.current("CONTENT_PROTECTION_SHORTCUT_BLOCKED", { event: `ctrl+${key}` });
          return;
        }
        // Copy / Cut on non-editable
        if ((key === "c" || key === "x") && !isEditableTarget(e.target)) {
          e.preventDefault();
          logRef.current("CONTENT_PROTECTION_COPY_BLOCKED", { event: `ctrl+${key}` });
          return;
        }
      }
    }

    // copy event — belt-and-suspenders
    function onCopy(e: ClipboardEvent) {
      if (!policyRef.current.disableKeyboardShortcuts) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      logRef.current("CONTENT_PROTECTION_COPY_BLOCKED", { event: "copy_event" });
    }

    // cut event
    function onCut(e: ClipboardEvent) {
      if (!policyRef.current.disableKeyboardShortcuts) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
    };
  }, [ready]); // Only re-register on ready change; policy changes are handled via policyRef

  return (
    <>
      {children}
      <WatermarkOverlay />
      <DevToolsDetector />
      <ScreenShareDetector />
    </>
  );
}
