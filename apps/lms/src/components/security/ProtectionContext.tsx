"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface ContentProtectionPolicy {
  disableRightClick: boolean;
  disableKeyboardShortcuts: boolean;
  disableTextSelection: boolean;
  enableWatermark: boolean;
  screenshotProtection: boolean;
  screenRecordingProtection: boolean;
  screenShareProtection: boolean;
  devToolsProtection: boolean;
}

export interface WatermarkConfig {
  opacity: number;
  fontSize: number;
  rotation: number;
  refreshIntervalSeconds: number;
}

export interface ProtectedStudentIdentity {
  name: string;
  email: string;
  username: string;
  id: string;
}

interface ProtectionState {
  policy: ContentProtectionPolicy;
  watermark: WatermarkConfig;
  student: ProtectedStudentIdentity | null;
  ready: boolean;
  /** Currently active course id — used to apply per-course overrides */
  activeCourseId: string | null;
}

interface ProtectionContextValue extends ProtectionState {
  logEvent: (action: string, meta?: { courseId?: string; batchId?: string; event?: string }) => void;
  /** Call from a course page to apply per-course watermark overrides */
  setActiveCourseId: (courseId: string | null) => void;
}

const DEFAULT_POLICY: ContentProtectionPolicy = {
  disableRightClick: true,
  disableKeyboardShortcuts: true,
  disableTextSelection: true,
  enableWatermark: false,   // off by default — enabled only when backend confirms
  screenshotProtection: true,
  screenRecordingProtection: false,
  screenShareProtection: false,
  devToolsProtection: true,
};

const DEFAULT_WATERMARK: WatermarkConfig = {
  opacity: 0.12,
  fontSize: 14,
  rotation: -30,
  refreshIntervalSeconds: 8,
};

const ProtectionContext = createContext<ProtectionContextValue>({
  policy: DEFAULT_POLICY,
  watermark: DEFAULT_WATERMARK,
  student: null,
  ready: false,
  activeCourseId: null,
  logEvent: () => {},
  setActiveCourseId: () => {},
});

export function ProtectionProvider({ children }: { children: React.ReactNode }) {
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  // Bump this counter to force a re-fetch without changing activeCourseId
  const [fetchTick, setFetchTick] = useState(0);
  const [state, setState] = useState<ProtectionState>({
    policy: DEFAULT_POLICY,
    watermark: DEFAULT_WATERMARK,
    student: null,
    ready: false,
    activeCourseId: null,
  });

  // Re-fetch the policy whenever activeCourseId or fetchTick changes
  useEffect(() => {
    const url = activeCourseId
      ? `/api/student/content-protection?courseId=${encodeURIComponent(activeCourseId)}`
      : "/api/student/content-protection";
    api<{
      policy: ContentProtectionPolicy;
      watermark: WatermarkConfig;
      student: ProtectedStudentIdentity;
    }>(url)
      .then((r) => {
        if (r.success && r.data) {
          setState({
            policy: { ...DEFAULT_POLICY, ...r.data.policy },
            watermark: { ...DEFAULT_WATERMARK, ...r.data.watermark },
            student: r.data.student,
            ready: true,
            activeCourseId,
          });
        } else {
          setState((prev) => ({ ...prev, ready: true, activeCourseId }));
        }
      })
      .catch(() => {
        setState((prev) => ({ ...prev, ready: true, activeCourseId }));
      });
  // fetchTick is intentionally included so visibility changes re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId, fetchTick]);

  // Re-fetch when the tab becomes visible again — picks up admin config changes
  // made in another tab without requiring a full page reload.
  // Also polls every 30 seconds in case the tab stays in the foreground.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        setFetchTick((t) => t + 1);
      }
    }
    // Poll every 30 seconds so changes reflect without needing a tab switch
    const pollInterval = setInterval(() => {
      setFetchTick((t) => t + 1);
    }, 30_000);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const logEvent = useCallback(
    (action: string, meta?: { courseId?: string; batchId?: string; event?: string }) => {
      void api("/api/student/content-protection/events", {
        method: "POST",
        body: JSON.stringify({ action, ...meta }),
      }).catch(() => {});
    },
    []
  );

  return (
    <ProtectionContext.Provider value={{ ...state, activeCourseId, logEvent, setActiveCourseId }}>
      {children}
    </ProtectionContext.Provider>
  );
}

export function useProtection(): ProtectionContextValue {
  return useContext(ProtectionContext);
}
