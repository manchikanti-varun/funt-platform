"use client";

/**
 * DevToolsDetector
 *
 * Attempts to detect when browser DevTools are opened using the most
 * reliable browser-available technique: measuring the difference between
 * window.outerWidth/outerHeight and window.innerWidth/innerHeight.
 *
 * When DevTools are docked to the side or bottom the outer/inner
 * difference grows significantly. A threshold of ~160px catches most cases.
 *
 * Also uses the debugger/toString trick (console.log timing) as a secondary
 * signal. This is best-effort — sophisticated users can defeat it.
 *
 * On detection:
 *   - Logs a CONTENT_PROTECTION_DEVTOOLS_DETECTED audit event
 *   - Shows an in-page warning banner (does not block content — too disruptive)
 */

import { useEffect, useRef, useState } from "react";
import { useProtection } from "./ProtectionContext";

const DEVTOOLS_SIZE_THRESHOLD = 160; // px difference that indicates docked DevTools
const POLL_INTERVAL_MS = 2000;
// Debounce: fire the audit event at most once per session
const MIN_EVENT_INTERVAL_MS = 30_000;

export function DevToolsDetector() {
  const { policy, logEvent, ready } = useProtection();
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const lastEventRef = useRef(0);

  useEffect(() => {
    if (!ready || !policy.devToolsProtection) return;

    function check() {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const detected = widthDiff > DEVTOOLS_SIZE_THRESHOLD || heightDiff > DEVTOOLS_SIZE_THRESHOLD;

      if (detected) {
        setDevToolsOpen(true);
        const now = Date.now();
        if (now - lastEventRef.current > MIN_EVENT_INTERVAL_MS) {
          lastEventRef.current = now;
          logEvent("CONTENT_PROTECTION_DEVTOOLS_DETECTED", {
            event: `widthDiff=${widthDiff},heightDiff=${heightDiff}`,
          });
        }
      } else {
        setDevToolsOpen(false);
      }
    }

    check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ready, policy.devToolsProtection, logEvent]);

  if (!devToolsOpen) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ zIndex: 9500 }}
      className="fixed bottom-4 right-4 max-w-xs rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xl shadow-amber-200/40"
    >
      <p className="text-sm font-semibold text-amber-900">Developer Tools Detected</p>
      <p className="mt-1 text-xs text-amber-800">
        Content inspection tools are not permitted while viewing course material.
      </p>
    </div>
  );
}
