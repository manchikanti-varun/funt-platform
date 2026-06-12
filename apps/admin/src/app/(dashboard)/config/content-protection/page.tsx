"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { PageHeader } from "@/components/ui/PageHeader";

interface ContentProtectionPolicy {
  disableRightClick: boolean;
  disableKeyboardShortcuts: boolean;
  disableTextSelection: boolean;
  enableWatermark: boolean;
  screenshotProtection: boolean;
  screenRecordingProtection: boolean;
  screenShareProtection: boolean;
  devToolsProtection: boolean;
}

interface WatermarkConfig {
  opacity: number;
  fontSize: number;
  rotation: number;
  refreshIntervalSeconds: number;
}

interface ContentProtectionSettings {
  lmsProtection: ContentProtectionPolicy;
  adminProtection: ContentProtectionPolicy;
  watermark: WatermarkConfig;
  updatedBy: string;
  updatedAt: string;
}

const POLICY_LABELS: Record<keyof ContentProtectionPolicy, { label: string; description: string }> = {
  disableRightClick: { label: "Block right-click", description: "Prevents the context menu on all page content." },
  disableKeyboardShortcuts: { label: "Block copy shortcuts", description: "Blocks Ctrl+C, Ctrl+A, Ctrl+S, Ctrl+P and similar shortcuts." },
  disableTextSelection: { label: "Disable text selection", description: "Prevents students from selecting and copying text." },
  enableWatermark: { label: "Dynamic watermark", description: "Shows student name, email and timestamp as a repeating overlay." },
  screenshotProtection: { label: "Screenshot deterrence", description: "Blocks Print Screen key and hides content in print mode." },
  screenRecordingProtection: { label: "Screen recording detection", description: "Attempts to detect and log screen recording activity." },
  screenShareProtection: { label: "Screen share detection", description: "Intercepts getDisplayMedia calls and logs sharing events." },
  devToolsProtection: { label: "DevTools detection", description: "Detects browser DevTools and shows a warning banner." },
};

function PolicyCard({
  title,
  policy,
  onChange,
  disabled,
}: {
  title: string;
  policy: ContentProtectionPolicy;
  onChange: (key: keyof ContentProtectionPolicy, value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-700">{title}</h3>
      <div className="space-y-3">
        {(Object.keys(POLICY_LABELS) as Array<keyof ContentProtectionPolicy>).map((key) => {
          const { label, description } = POLICY_LABELS[key];
          return (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 transition hover:bg-slate-100/60"
            >
              <input
                type="checkbox"
                checked={policy[key]}
                onChange={(e) => onChange(key, e.target.checked)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{label}</span>
                <span className="block text-xs text-slate-500">{description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function ContentProtectionPage() {
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);

  const [settings, setSettings] = useState<ContentProtectionSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api<ContentProtectionSettings>("/api/config/content-protection").then((r) => {
      if (r.success && r.data) setSettings(r.data);
    });
  }, []);

  function updateLms(key: keyof ContentProtectionPolicy, value: boolean) {
    setSettings((prev) =>
      prev ? { ...prev, lmsProtection: { ...prev.lmsProtection, [key]: value } } : prev
    );
  }

  function updateAdmin(key: keyof ContentProtectionPolicy, value: boolean) {
    setSettings((prev) =>
      prev ? { ...prev, adminProtection: { ...prev.adminProtection, [key]: value } } : prev
    );
  }

  function updateWatermark(key: keyof WatermarkConfig, value: number) {
    setSettings((prev) =>
      prev ? { ...prev, watermark: { ...prev.watermark, [key]: value } } : prev
    );
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    const res = await api("/api/config/content-protection", {
      method: "PUT",
      body: JSON.stringify({
        lmsProtection: settings.lmsProtection,
        adminProtection: settings.adminProtection,
        watermark: settings.watermark,
      }),
    });
    setSaving(false);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(res.message ?? "Failed to save.");
    }
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <PageHeader title="Content Protection" subtitle="Loading settings…" />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Content Protection"
        subtitle="Configure what content-protection behaviours apply to the LMS and admin portals. Watermark is the most effective deterrent — it persists through screenshots."
      />

      {!isSuperAdmin && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Read-only — only Super Admins can change these settings.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PolicyCard
          title="LMS — Student Portal"
          policy={settings.lmsProtection}
          onChange={updateLms}
          disabled={!isSuperAdmin || saving}
        />
        <PolicyCard
          title="Admin Portal"
          policy={settings.adminProtection}
          onChange={updateAdmin}
          disabled={!isSuperAdmin || saving}
        />
      </div>

      {/* Watermark settings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-700">
          Watermark Settings
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Applied when watermark is enabled. The overlay shows the student&apos;s name, email,
          ID and current timestamp — persists across screenshots.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: "opacity" as const, label: "Opacity", min: 0.02, max: 0.5, step: 0.01 },
            { key: "fontSize" as const, label: "Font size (px)", min: 8, max: 32, step: 1 },
            { key: "rotation" as const, label: "Rotation (°)", min: -90, max: 90, step: 5 },
            { key: "refreshIntervalSeconds" as const, label: "Shift interval (s)", min: 1, max: 120, step: 1 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {label}
                <span className="ml-1 font-mono text-teal-700">{settings.watermark[key]}</span>
              </label>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings.watermark[key]}
                onChange={(e) => updateWatermark(key, Number(e.target.value))}
                disabled={!isSuperAdmin || saving}
                className="w-full accent-teal-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{min}</span><span>{max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {settings.updatedBy && (
        <p className="text-xs text-slate-500">
          Last updated by <span className="font-medium text-slate-700">{settings.updatedBy}</span>
          {settings.updatedAt && (
            <> on {new Date(settings.updatedAt).toLocaleString()}</>
          )}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      {isSuperAdmin && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              "Save settings"
            )}
          </button>
          {success && (
            <span className="text-sm font-medium text-emerald-700">Settings saved.</span>
          )}
        </div>
      )}
    </div>
  );
}
