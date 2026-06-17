"use client";

import { useEffect, useMemo, useState } from "react";
import { ROLE } from "@funt-platform/constants";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { BackLink } from "@/components/ui/BackLink";

type AwardMode = "MANUAL" | "AUTO" | "BOTH";
type AutoTrigger = "FIRST_ASSIGNMENT_COMPLETED" | "FIRST_COURSE_COMPLETED" | "FIRST_MODULE_COMPLETED" | "";

interface BadgeDef {
  badgeType: string;
  displayName: string;
  icon: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  awardMode: AwardMode;
  autoTrigger?: string;
}


export default function BadgesPage() {
  const [rows, setRows] = useState<BadgeDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [badgeType, setBadgeType] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [icon, setIcon] = useState("award");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [awardMode, setAwardMode] = useState<AwardMode>("MANUAL");
  const [autoTrigger, setAutoTrigger] = useState<AutoTrigger>("");
  const [studentId, setStudentId] = useState("");
  const [awardBadgeType, setAwardBadgeType] = useState("");

  const manualAwardOptions = useMemo(
    () => rows.filter((b) => b.isActive && b.awardMode !== "AUTO"),
    [rows]
  );

  async function refresh() {
    const r = await api<BadgeDef[]>("/api/admin/badges");
    if (r.success && Array.isArray(r.data)) {
      setRows(r.data);
      if (!awardBadgeType && r.data[0]?.badgeType) setAwardBadgeType(r.data[0].badgeType);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (manualAwardOptions.length === 0) {
      setAwardBadgeType("");
      return;
    }
    if (!manualAwardOptions.some((b) => b.badgeType === awardBadgeType)) {
      setAwardBadgeType(manualAwardOptions[0].badgeType);
    }
  }, [manualAwardOptions, awardBadgeType]);

  const autoTriggerOptions = useMemo(
    () => [
      { id: "", label: "No automatic trigger" },
      { id: "FIRST_ASSIGNMENT_COMPLETED", label: "First assignment completed" },
      { id: "FIRST_COURSE_COMPLETED", label: "First course completed" },
      { id: "FIRST_MODULE_COMPLETED", label: "First module completed" },
    ],
    []
  );

  async function createBadge(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    const r = await api<BadgeDef>("/api/admin/badges", {
      method: "POST",
      body: JSON.stringify({
        badgeType,
        displayName,
        icon,
        description,
        imageUrl,
        awardMode,
        autoTrigger: autoTrigger || undefined,
        isActive: true,
      }),
    });
    setLoading(false);
    if (!r.success) {
      setError(r.message ?? "Could not create badge.");
      return;
    }
    setMsg("Badge created.");
    setBadgeType("");
    setDisplayName("");
    setDescription("");
    setImageUrl("");
    setAwardMode("MANUAL");
    setAutoTrigger("");
    await refresh();
  }

  async function toggleActive(b: BadgeDef) {
    setError("");
    const r = await api(`/api/admin/badges/${encodeURIComponent(b.badgeType)}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    if (!r.success) {
      setError(r.message ?? "Could not update badge.");
      return;
    }
    await refresh();
  }

  async function awardNow(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!studentId.trim() || !awardBadgeType.trim()) {
      setError("studentId and badge type are required.");
      return;
    }
    setLoading(true);
    const r = await api<{ awarded: boolean }>("/api/admin/badges/award", {
      method: "POST",
      body: JSON.stringify({ studentId: studentId.trim(), badgeType: awardBadgeType.trim() }),
    });
    setLoading(false);
    if (!r.success) {
      setError(r.message ?? "Could not award badge.");
      return;
    }
    setMsg(r.data?.awarded ? "Badge awarded." : "Badge already exists for this student.");
  }

  return (
    <AppPageShell>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <div className="shrink-0 pb-4">
        <BackLink href="/dashboard">Back to Dashboard</BackLink>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Badges</h1>
          <p className="mt-1 text-sm text-slate-600">Create global badges once; all admins and super admins can use them.</p>
        </div>
        <div className="p-6 space-y-8">
          {error ? <div className="alert--error">{error}</div> : null}
          {msg ? <div className="alert--success">{msg}</div> : null}

          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700">Create badge</h2>
            <form onSubmit={createBadge} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className="input text-sm" placeholder="Badge key (e.g. TOP_PERFORMER)" value={badgeType} onChange={(e) => setBadgeType(e.target.value)} required />
              <input className="input text-sm" placeholder="Display title" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              <input className="input text-sm" placeholder="Icon name (e.g. award)" value={icon} onChange={(e) => setIcon(e.target.value)} />
              <input className="input text-sm" placeholder="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <div className="sm:col-span-2">
                <textarea className="input text-sm min-h-24" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <select className="input text-sm" value={awardMode} onChange={(e) => setAwardMode(e.target.value as AwardMode)}>
                <option value="MANUAL">Manual only</option>
                <option value="AUTO">Automatic only</option>
                <option value="BOTH">Both manual and automatic</option>
              </select>
              <select className="input text-sm" value={autoTrigger} onChange={(e) => setAutoTrigger(e.target.value as AutoTrigger)}>
                {autoTriggerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <div className="sm:col-span-2">
                <button disabled={loading} className="btn-primary">
                  Create badge
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700">Manual award</h2>
            <p className="mt-1 text-xs text-slate-500">
              Only active badges with mode <strong>MANUAL</strong> or <strong>BOTH</strong> can be awarded here.
            </p>
            <form onSubmit={awardNow} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Student user ID</span>
                <input
                  className="input text-sm"
                  placeholder="Paste student userId"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Badge</span>
                <select
                  className="input text-sm"
                  value={awardBadgeType}
                  onChange={(e) => setAwardBadgeType(e.target.value)}
                  required
                  disabled={manualAwardOptions.length === 0}
                >
                  {manualAwardOptions.length === 0 ? (
                    <option value="">No manual-eligible active badges</option>
                  ) : (
                    manualAwardOptions.map((b) => (
                      <option key={b.badgeType} value={b.badgeType}>{b.displayName} ({b.badgeType})</option>
                    ))
                  )}
                </select>
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  disabled={loading || manualAwardOptions.length === 0}
                  className="btn-primary text-sm disabled:cursor-not-allowed"
                >
                  Award badge
                </button>
                <a
                  href="/profile-search"
                  className="btn-secondary text-xs"
                >
                  Open profile search (to get user ID)
                </a>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700">Global badges</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Title</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Key</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Mode</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Trigger</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((b) => (
                    <tr key={b.badgeType}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{b.displayName}</p>
                        {b.description ? <p className="text-xs text-slate-500">{b.description}</p> : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{b.badgeType}</td>
                      <td className="px-3 py-2 text-slate-600">{b.awardMode}</td>
                      <td className="px-3 py-2 text-slate-600">{b.autoTrigger ?? "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void toggleActive(b)}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${b.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                        >
                          {b.isActive ? "Active (click to disable)" : "Disabled (click to enable)"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No badge definitions found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      </div>
    </AppPageShell>
  );
}

