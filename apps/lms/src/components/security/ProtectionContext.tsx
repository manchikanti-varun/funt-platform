"use client";

/**
 * ProtectionContext
 *
 * Fetches the effective content-protection policy + student identity from
 * the backend once on mount, then makes them available to all security
 * components via React context.
 *
 * Also exposes logEvent() so any component can fire an audit event without
 * reimplementing the API call.
 */

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
}

interface ProtectionContextValue extends ProtectionState {
  logEvent: (action: string, meta?: { courseId?: string; batchId?: string; event?: string }) => void;
}

const DEFAULT_POLICY: ContentProtectionPolicy = {
  disableRightClick: true,
  disableKeyboardShortcuts: true,
  disableTextSelection: true,
  enableWatermark: true,
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
  logEvent: () => {},
});

export function ProtectionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProtectionState>({
    policy: DEFAULT_POLICY,
    watermark: DEFAULT_WATERMARK,
    student: null,
    ready: false,
  });

  useEffect(() => {
    api<{
      policy: ContentProtectionPolicy;
      watermark: WatermarkConfig;
      student: ProtectedStudentIdentity;
    }>("/api/student/content-protection")
      .then((r) => {
        if (r.success && r.data) {
          setState({
            policy: { ...DEFAULT_POLICY, ...r.data.policy },
            watermark: { ...DEFAULT_WATERMARK, ...r.data.watermark },
            student: r.data.student,
            ready: true,
          });
        } else {
          // Fallback to defaults — protection still active
          setState((prev) => ({ ...prev, ready: true }));
        }
      })
      .catch(() => {
        setState((prev) => ({ ...prev, ready: true }));
      });
  }, []);

  const logEvent = useCallback(
    (action: string, meta?: { courseId?: string; batchId?: string; event?: string }) => {
      // Fire-and-forget — never block the UI
      void api("/api/student/content-protection/events", {
        method: "POST",
        body: JSON.stringify({ action, ...meta }),
      }).catch(() => {});
    },
    []
  );

  return (
    <ProtectionContext.Provider value={{ ...state, logEvent }}>
      {children}
    </ProtectionContext.Provider>
  );
}

export function useProtection(): ProtectionContextValue {
  return useContext(ProtectionContext);
}
