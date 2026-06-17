"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { AppPageShell } from "@/components/ui";
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

const POLICY_LABELS: Record<
  keyof ContentProtectionPolicy,
  { label: string; description: string }
> = {
  disableRightClick:        { label: "Block right-click",         description: "Prevents the context menu on all page content." },
  disableKeyboardShortcuts: { label: "Block copy shortcuts",      description: "Blocks Ctrl+C, Ctrl+A, Ctrl+S, Ctrl+P and similar shortcuts." },
  disableTextSelection:     { label: "Disable text selection",    description: "Prevents students from selecting and copying text." },
  enableWatermark:          { label: "Dynamic watermark",         description: "Shows student name, email and timestamp as a repeating overlay." },
  screenshotProtection:     { label: "Screenshot deterrence",     description: "Blocks Print Screen key and hides content in print mode." },
  screenRecordingProtection:{ label: "Screen recording detection",description: "Attempts to detect and log screen recording activity." },
  screenShareProtection:    { label: "Screen share detection",    description: "Intercepts getDisplayMedia calls and logs sharing events." },
  devToolsProtection:       { label: "DevTools detection",        description: "Detects browser DevTools and shows a warning banner." },
};

// ── Toggle switch ──────────────────────────────────────────────────────────
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
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        checked ? "bg-indigo-600" : "bg-slate-200",
        disabled ? "cursor-not-allowed opacity-50" : "hover:opacity-90",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0",
          "transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// ── Policy card ────────────────────────────────────────────────────────────
function PolicyCard({
  title,
  subtitle,
  policy,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  policy: ContentProtectionPolicy;
  onChange: (key: keyof ContentProtectionPolicy, value: boolean) => void;
  disabled: boolean;
}) {
  const onCount = Object.values(policy).filter(Boolean).length;
  const total = Object.keys(POLICY_LABELS).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="label-overline">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className={`badge text-xs ${
          onCount === total
            ? "badge-success"
            : onCount === 0
              ? "bg-slate-100 text-slate-500 ring-1 ring-slate-200/50"
              : "badge-warning"
        }`}>
          {onCount}/{total} active
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-50 px-2 py-1.5">
        {(Object.keys(POLICY_LABELS) as Array<keyof ContentProtectionPolicy>).map((key) => {
          const { label, description } = POLICY_LABELS[key];
          const isOn = policy[key];
          return (
            <div
              key={key}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && onChange(key, !isOn)}
              onKeyDown={(e) => {
                if (!disabled && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onChange(key, !isOn);
                }
              }}
              className={[
                "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150",
                isOn
                  ? "bg-indigo-50/60 hover:bg-indigo-50"
                  : "hover:bg-slate-50/60",
                disabled ? "cursor-default" : "",
              ].join(" ")}
            >
              {/* Active indicator dot */}
              <span className={`h-2 w-2 shrink-0 rounded-full transition-colors ${isOn ? "bg-indigo-500" : "bg-slate-200"}`} />

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-tight ${isOn ? "text-slate-900" : "text-slate-600"}`}>
                  {label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-slate-400">{description}</p>
              </div>

              {/* Badge + toggle */}
              <div className="flex shrink-0 items-center gap-2">
                <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:block ${
                  isOn
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-400"
                }`}>
                  {isOn ? "On" : "Off"}
                </span>
                <Toggle checked={isOn} onChange={(v) => onChange(key, v)} disabled={disabled} />
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
    setSettings((p) => p ? { ...p, lmsProtection: { ...p.lmsProtection, [key]: value } } : p);
  }
  function updateAdmin(key: keyof ContentProtectionPolicy, value: boolean) {
    setSettings((p) => p ? { ...p, adminProtection: { ...p.adminProtection, [key]: value } } : p);
  }
  function updateWatermark(key: keyof WatermarkConfig, value: number) {
    setSettings((p) => p ? { ...p, watermark: { ...p.watermark, [key]: value } } : p);
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
    if (res.success) { setSuccess(true); setTimeout(() => setSuccess(false), 3500); }
    else setError(res.message ?? "Failed to save.");
  }

  if (!settings) {
    return (
      <AppPageShell>
        <PageHeader title="Content Protection" subtitle="Loading settings…" />
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Content Protection"
        subtitle="Control security behaviours for the student portal and admin portal independently."
      />

      {/* Read-only banner */}
      {!isSuperAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 shadow-sm">
          <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm font-medium text-amber-800">
            Read-only — only Super Admins can modify these settings.
          </p>
        </div>
      )}

      {/* Two portal cards */}
      <div className="grid gap-5 lg:grid-cols-2">
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
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="label-overline">Watermark Settings</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Visual settings for the watermark overlay. Only active when &ldquo;Dynamic watermark&rdquo; is on.
          </p>
        </div>
        <div className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { key: "opacity" as const,                label: "Opacity",        min: 0.02, max: 0.5,  step: 0.01, fmt: (v: number) => v.toFixed(2) },
              { key: "fontSize" as const,               label: "Font size",      min: 8,    max: 32,   step: 1,    fmt: (v: number) => `${v}px` },
              { key: "rotation" as const,               label: "Rotation",       min: -90,  max: 90,   step: 5,    fmt: (v: number) => `${v}°` },
              { key: "refreshIntervalSeconds" as const, label: "Shift interval", min: 1,    max: 120,  step: 1,    fmt: (v: number) => `${v}s` },
            ] as const
          ).map(({ key, label, min, max, step, fmt }) => (
            <div key={key} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">{label}</span>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-xs font-bold text-indigo-700">
                  {fmt(settings.watermark[key])}
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
                className="w-full accent-indigo-600 disabled:opacity-40"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{fmt(min)}</span>
                <span>{fmt(max)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer meta */}
      {settings.updatedBy && (
        <p className="text-xs text-slate-400">
          Last saved by{" "}
          <span className="font-medium text-slate-600">{settings.updatedBy}</span>
          {settings.updatedAt && (
            <> &mdash; {new Date(settings.updatedAt).toLocaleString()}</>
          )}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {/* Save */}
      {isSuperAdmin && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Saving…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Save settings
              </>
            )}
          </button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Settings saved successfully.
            </span>
          )}
        </div>
      )}
    </AppPageShell>
  );
}
