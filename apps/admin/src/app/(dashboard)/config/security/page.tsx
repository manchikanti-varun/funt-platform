"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { ROLE } from "@funt-platform/constants";
import { Shield, Save, Plus, X } from "lucide-react";

interface SecurityConfig {
  officeIps: string[];
  riskScoreThreshold: number;
  suspiciousTravelMinutes: number;
  maxDesktopDevices: number;
  maxMobileDevices: number;
  inactiveAfterYearsNoLogin: number;
  inactiveAfterYearsFromEnrollment: number;
  concurrentSessionEnabled: boolean;
}

export default function SecurityConfigPage() {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newIp, setNewIp] = useState("");

  useEffect(() => {
    api<SecurityConfig>("/api/admin/security-config")
      .then((r) => { if (r.success && r.data) setConfig(r.data); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setMessage("");
    const r = await api("/api/admin/security-config", { method: "PUT", body: JSON.stringify(config) });
    setSaving(false);
    setMessage(r.success ? "Security settings saved." : (r.message ?? "Failed to save."));
  }

  function addIp() {
    if (!newIp.trim() || !config) return;
    setConfig({ ...config, officeIps: [...config.officeIps, newIp.trim()] });
    setNewIp("");
  }

  function removeIp(index: number) {
    if (!config) return;
    setConfig({ ...config, officeIps: config.officeIps.filter((_, i) => i !== index) });
  }

  if (loading) return <AppPageShell><div className="flex min-h-[300px] items-center justify-center"><div className="spinner" /></div></AppPageShell>;
  if (!config) return <AppPageShell><p className="text-red-600">Failed to load config.</p></AppPageShell>;

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <PageHeader title="Security Configuration" subtitle="Trusted devices, risk scoring, and account policies." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Office IPs */}
        <DataPanel className="p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Shield className="h-4 w-4 text-indigo-600" /> Office Wi-Fi IPs</h3>
          <p className="text-xs text-slate-500">Devices from these IPs bypass trusted device checks. Add your office public IP addresses.</p>
          <div className="space-y-2">
            {config.officeIps.map((ip, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="flex-1 font-mono text-xs text-slate-700">{ip}</span>
                <button onClick={() => removeIp(i)} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="e.g. 103.21.58.100" className="input flex-1 text-sm font-mono" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIp(); } }} />
            <button onClick={addIp} disabled={!newIp.trim()} className="btn-secondary inline-flex items-center gap-1 text-xs"><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
        </DataPanel>

        {/* Device Limits */}
        <DataPanel className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Device Limits</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs font-medium text-slate-600">Max Desktop Devices</label><input type="number" min={1} max={5} value={config.maxDesktopDevices} onChange={(e) => setConfig({ ...config, maxDesktopDevices: Number(e.target.value) })} className="input mt-1 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-600">Max Mobile Devices</label><input type="number" min={1} max={5} value={config.maxMobileDevices} onChange={(e) => setConfig({ ...config, maxMobileDevices: Number(e.target.value) })} className="input mt-1 text-sm" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config.concurrentSessionEnabled} onChange={(e) => setConfig({ ...config, concurrentSessionEnabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-slate-700">Enforce single active session (logout previous on new login)</span>
          </label>
        </DataPanel>

        {/* Risk Scoring */}
        <DataPanel className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Risk Scoring</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs font-medium text-slate-600">Risk Threshold (score)</label><input type="number" min={10} max={1000} value={config.riskScoreThreshold} onChange={(e) => setConfig({ ...config, riskScoreThreshold: Number(e.target.value) })} className="input mt-1 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-600">Suspicious Travel (minutes)</label><input type="number" min={5} max={120} value={config.suspiciousTravelMinutes} onChange={(e) => setConfig({ ...config, suspiciousTravelMinutes: Number(e.target.value) })} className="input mt-1 text-sm" /></div>
          </div>
          <p className="text-[10px] text-slate-400">If a student&apos;s city changes within the configured minutes, their risk score increases. Score above threshold flags for admin review.</p>
        </DataPanel>

        {/* Auto-Inactive */}
        <DataPanel className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Auto-Inactive Rules</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs font-medium text-slate-600">Inactive after N years no login</label><input type="number" min={1} max={20} value={config.inactiveAfterYearsNoLogin} onChange={(e) => setConfig({ ...config, inactiveAfterYearsNoLogin: Number(e.target.value) })} className="input mt-1 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-600">Inactive after N years from enrollment</label><input type="number" min={1} max={30} value={config.inactiveAfterYearsFromEnrollment} onChange={(e) => setConfig({ ...config, inactiveAfterYearsFromEnrollment: Number(e.target.value) })} className="input mt-1 text-sm" /></div>
          </div>
          <p className="text-[10px] text-slate-400">Accounts are marked Inactive (NOT deleted). All data is preserved. Only status changes. Admin can reactivate.</p>
        </DataPanel>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
          <Save className="h-4 w-4" />{saving ? "Saving..." : "Save Security Settings"}
        </button>
        {message && <p className={`text-sm font-medium ${message.includes("saved") ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
      </div>
    </AppPageShell>
  );
}
