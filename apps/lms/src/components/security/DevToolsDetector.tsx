"use client";

/**
 * DevToolsDetector
 *
 * Attempts to detect when browser DevTools are opened using the
 * window outer/inner size difference technique.
 *
 * When DevTools are docked to the side or bottom the outer/inner
 * difference grows significantly beyond what the browser chrome
 * (title bar, bookmarks bar, taskbar) normally accounts for.
 *
 * Threshold is set conservatively (200px) to avoid false positives
 * from Windows taskbar, bookmarks bar, extensions panel, or
 * display scaling > 100%.
 *
 * On detection:
 *   - Logs a CONTENT_PROTECTION_DEVTOOLS_DETECTED audit event
 *   - Shows an in-page warning banner (does not block content)
 */

import { useEffect, useRef, useState } from "react";
import { useProtection } from "./ProtectionContext";

// Conservative threshold: browser chrome is typically 80-150px.
// DevTools docked adds 300-600px. Set to 200 to avoid false positives
// from taskbar + bookmarks bar + extensions on high-DPI Windows displays.
const DEVTOOLS_SIZE_THRESHOLD = 200;
const POLL_INTERVAL_MS = 3000;
// Debounce: fire the audit event at most once per 60 seconds
const MIN_EVENT_INTERVAL_MS = 60_000;
// Require multiple consecutive detections to confirm (avoids one-off false positives)
const REQUIRED_CONSECUTIVE_DETECTIONS = 3;

export function DevToolsDetector() {
  const { policy, logEvent, ready } = useProtection();
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const lastEventRef = useRef(0);
  const consecutiveRef = useRef(0);

  useEffect(() => {
    if (!ready || !policy.devToolsProtection) return;

    function check() {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const detected = widthDiff > DEVTOOLS_SIZE_THRESHOLD || heightDiff > DEVTOOLS_SIZE_THRESHOLD;

      if (detected) {
        consecutiveRef.current += 1;
        // Only flag as open after multiple consecutive detections
        if (consecutiveRef.current >= REQUIRED_CONSECUTIVE_DETECTIONS) {
          setDevToolsOpen(true);
          const now = Date.now();
          if (now - lastEventRef.current > MIN_EVENT_INTERVAL_MS) {
            lastEventRef.current = now;
            logEvent("CONTENT_PROTECTION_DEVTOOLS_DETECTED", {
              event: `widthDiff=${widthDiff},heightDiff=${heightDiff}`,
            });
          }
        }
      } else {
        consecutiveRef.current = 0;
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
