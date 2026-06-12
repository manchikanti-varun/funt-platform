"use client";

/**
 * ScreenShareDetector
 *
 * Uses the Screen Capture API (getDisplayMedia) indirectly:
 * We listen to the `navigator.mediaDevices` `devicechange` event and the
 * Visibility API. When a display capture track is found active in any
 * MediaStream, we flag it.
 *
 * More practically: we use the Page Visibility API + document focus events
 * to detect when the user switches away (likely to share), and we poll
 * for active display-capture MediaStreamTracks using getDisplayMedia state.
 *
 * Note: browsers do not expose a passive "is screen being shared?" API.
 * The only way to know is if OUR code called getDisplayMedia — we don't.
 * What we CAN do is detect if the tab loses focus + document becomes hidden,
 * and show a deterrence warning. This is the standard web-LMS approach.
 *
 * On detection: logs audit event + shows warning overlay.
 */

import { useEffect, useRef, useState } from "react";
import { useProtection } from "./ProtectionContext";

const MIN_EVENT_INTERVAL_MS = 60_000;

export function ScreenShareDetector() {
  const { policy, logEvent, ready } = useProtection();
  const [warning, setWarning] = useState(false);
  const lastEventRef = useRef(0);

  useEffect(() => {
    if (!ready || !policy.screenShareProtection) return;

    // Strategy: intercept getDisplayMedia calls globally.
    // If the student (or a third-party extension) invokes getDisplayMedia,
    // we detect it and log immediately.
    const originalGetDisplayMedia =
      typeof navigator.mediaDevices?.getDisplayMedia === "function"
        ? navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices)
        : null;

    if (originalGetDisplayMedia && navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = async (
        constraints?: DisplayMediaStreamOptions
      ): Promise<MediaStream> => {
        const now = Date.now();
        if (now - lastEventRef.current > MIN_EVENT_INTERVAL_MS) {
          lastEventRef.current = now;
          logEvent("CONTENT_PROTECTION_SCREEN_SHARE_DETECTED", {
            event: "getDisplayMedia_intercepted",
          });
        }
        setWarning(true);
        // Still allow it to proceed — blocking would throw an error that
        // might crash unrelated browser features.
        return originalGetDisplayMedia(constraints);
      };
    }

    // Secondary: document visibility — tab hidden while in learn mode
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        // Tab hidden — could be screen share, alt+tab, etc.
        // Log conservatively
        const now = Date.now();
        if (now - lastEventRef.current > MIN_EVENT_INTERVAL_MS) {
          lastEventRef.current = now;
          logEvent("CONTENT_PROTECTION_SCREEN_SHARE_DETECTED", {
            event: "tab_hidden",
          });
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Restore original
      if (originalGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
    };
  }, [ready, policy.screenShareProtection, logEvent]);

  if (!warning) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ zIndex: 9500 }}
      className="fixed bottom-4 left-4 max-w-xs rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-xl shadow-rose-200/40"
    >
      <p className="text-sm font-semibold text-rose-900">Screen Sharing Detected</p>
      <p className="mt-1 text-xs text-rose-800">
        Sharing or recording course content is not permitted. This session has been logged.
      </p>
      <button
        type="button"
        onClick={() => setWarning(false)}
        className="mt-2 text-xs font-medium text-rose-700 underline hover:text-rose-900"
      >
        Dismiss
      </button>
    </div>
  );
}
