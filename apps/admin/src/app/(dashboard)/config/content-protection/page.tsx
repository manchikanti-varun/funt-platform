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

const POLICY_LABELS: Record<keyof ContentProtectionPolicy, { label: string; description: string; icon: string }> = {
  disableRightClick:       { label: "Block right-click",        description: "Prevents the context menu on all page content.",                          icon: "🖱️" },
  disableKeyboardShortcuts:{ label: "Block copy shortcuts",      description: "Blocks Ctrl+C, Ctrl+A, Ctrl+S, Ctrl+P and similar shortcuts.",            icon: "⌨️" },
  disableTextSelection:    { label: "Disable text selection",    description: "Prevents students from selecting and copying text.",                       icon: "🔡" },
  enableWatermark:         { label: "Dynamic watermark",         description: "Shows student name, email and timestamp as a repeating overlay.",          icon: "💧" },
  screenshotProtection:    { label: "Screenshot deterrence",     description: "Blocks Print Screen key and hides content in print mode.",                 icon: "📸" },
  screenRecordingProtection:{ label: "Screen recording detection",description: "Attempts to detect and log screen recording activity.",                   icon: "🎥" },
  screenShareProtection:   { label: "Screen share detection",    description: "Intercepts getDisplayMedia calls and logs sharing events.",                icon: "🖥️" },
  devToolsProtection:      { label: "DevTools detection",        description: "Detects browser DevTools and shows a warning banner.",                     icon: "🔧" },
};

// ── Toggle switch component ────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2",
        checked ? "bg-teal-600" : "bg-slate-300",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// ── Policy card with toggle rows ──────────────────────────────────────────
function PolicyCard({
  title,
  subtitle,
  policy,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  policy: ContentProtectionPolicy;
  onChange: (key: keyof ContentProtectionPolicy, value: boolean) => void;
  disabled: boolean;
}) {
  const enabledCount = Object.values(policy).filter(Boolean).length;
  const totalCount = Object.keys(POLICY_LABELS).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            enabledCount === totalCount
              ? "bg-teal-100 text-teal-800"
              : enabledCount === 0
                ? "bg-slate-100 text-slate-500"
                : "bg-amber-100 text-amber-800"
          }`}>
            {enabledCount}/{totalCount} on
          </span>
        </div>
      </div>

      {/* Toggle rows */}
      <div className="divide-y divide-slate-50 p-1">
        {(Object.keys(POLICY_LABELS) as Array<keyof ContentProtectionPolicy>).map((key) => {
          const { label, description, icon } = POLICY_LABELS[key];
          const isOn = policy[key];
          return (
            <div
              key={key}
              className={[
                "flex items-center gap-4 rounded-xl px-4 py-3 transition",
                isOn ? "bg-teal-50/40" : "hover:bg-slate-50/60",
                disabled ? "" : "cursor-pointer",
              ].join(" ")}
              onClick={() => !disabled && onChange(key, !isOn)}
            >
              {/* Icon */}
              <span className="text-lg leading-none select-none" aria-hidden>{icon}</span>

              {/* Label + description */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold leading-tight ${isOn ? "text-teal-900" : "text-slate-700"}`}>
                  {label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-slate-500">{description}</p>
              </div>

              {/* Status pill + toggle */}
              <div className="flex shrink-0 items-center gap-2.5">
                <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-block ${
                  isOn ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {isOn ? "On" : "Off"}
                </span>
                <Toggle
                  checked={isOn}
                  onChange={(v) => onChange(key, v)}
                  disabled={disabled}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
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
        subtitle="Configure content-protection behaviours for the LMS and admin portals. Toggle each protection on or off independently."
      />

      {!isSuperAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm font-medium text-amber-900">
            Read-only — only Super Admins can change these settings.
          </p>
        </div>
      )}

      {/* Policy cards side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PolicyCard
          title="LMS — Student Portal"
          subtitle="Applies to all students on learn.funt.in"
          policy={settings.lmsProtection}
          onChange={updateLms}
          disabled={!isSuperAdmin || saving}
        />
        <PolicyCard
          title="Admin Portal"
          subtitle="Applies to admins and trainers on admin.funt.in"
          policy={settings.adminProtection}
          onChange={updateAdmin}
          disabled={!isSuperAdmin || saving}
        />
      </div>

      {/* Watermark settings */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Watermark Settings</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Customise the overlay appearance. Active when &ldquo;Dynamic watermark&rdquo; is on.
          </p>
        </div>
        <div className="p-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "opacity" as const,               label: "Opacity",           min: 0.02, max: 0.5,  step: 0.01, unit: "" },
              { key: "fontSize" as const,              label: "Font size",         min: 8,    max: 32,   step: 1,    unit: "px" },
              { key: "rotation" as const,              label: "Rotation",          min: -90,  max: 90,   step: 5,    unit: "°" },
              { key: "refreshIntervalSeconds" as const,label: "Shift interval",    min: 1,    max: 120,  step: 1,    unit: "s" },
            ].map(({ key, label, min, max, step, unit }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">{label}</label>
                  <span className="font-mono text-xs font-bold text-teal-700">
                    {settings.watermark[key]}{unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={settings.watermark[key]}
                  onChange={(e) => updateWatermark(key, Number(e.target.value))}
                  disabled={!isSuperAdmin || saving}
                  className="w-full accent-teal-600 disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{min}{unit}</span>
                  <span>{max}{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Last updated */}
      {settings.updatedBy && (
        <p className="text-xs text-slate-500">
          Last updated by{" "}
          <span className="font-medium text-slate-700">{settings.updatedBy}</span>
          {settings.updatedAt && <> on {new Date(settings.updatedAt).toLocaleString()}</>}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
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
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Save settings
              </>
            )}
          </button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Settings saved successfully.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
