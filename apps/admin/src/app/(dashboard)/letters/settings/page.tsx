"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { ROLE } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";

interface LetterSettings {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyWeb: string;
  hrEmail: string;
  offerIntro: string;
  offerDuration: string;
  offerReporting: string;
  offerStipend: string;
  offerAcceptanceNote: string;
  offerCompletionNote: string;
  offerClosing: string;
  offerAcceptanceBlock: string;
  page2Intro: string;
  page2Welcome: string;
  page2Contact: string;
  annexureItems: string[];
  experienceTitle: string;
  experienceIntro: string;
  experienceDuties: string;
  experienceClosing: string;
  defaultSignatoryName: string;
  defaultSignatoryRole: string;
  defaultSignatoryImageUrl: string;
  defaultStampImageUrl: string;
  version: number;
}

export default function LetterSettingsPage() {
  const [settings, setSettings] = useState<LetterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"company" | "offer" | "experience" | "annexure" | "signatory">("company");

  useEffect(() => {
    api<LetterSettings>("/api/letters/settings/template")
      .then((r) => { if (r.success && r.data) setSettings(r.data); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    const res = await api("/api/letters/settings/template", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setMessage(res.success ? "Settings saved! New letters will use the updated template." : (res.message ?? "Failed to save"));
  }

  function updateField(field: keyof LetterSettings, value: string) {
    setSettings((s) => s ? { ...s, [field]: value } : s);
  }

  function updateAnnexureItem(index: number, value: string) {
    setSettings((s) => {
      if (!s) return s;
      const items = [...s.annexureItems];
      items[index] = value;
      return { ...s, annexureItems: items };
    });
  }

  function addAnnexureItem() {
    setSettings((s) => s ? { ...s, annexureItems: [...s.annexureItems, ""] } : s);
  }

  function removeAnnexureItem(index: number) {
    setSettings((s) => {
      if (!s) return s;
      const items = s.annexureItems.filter((_, i) => i !== index);
      return { ...s, annexureItems: items };
    });
  }

  if (loading) return <AppPageShell><div className="flex min-h-[300px] items-center justify-center"><div className="spinner" /></div></AppPageShell>;
  if (!settings) return <AppPageShell><p className="text-red-600">Failed to load settings</p></AppPageShell>;

  const tabs = [
    { key: "company" as const, label: "Company Info" },
    { key: "offer" as const, label: "Offer Letter" },
    { key: "experience" as const, label: "Experience Letter" },
    { key: "annexure" as const, label: "Annexure" },
    { key: "signatory" as const, label: "Signatory" },
  ];

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[ROLE.SUPER_ADMIN]} fallbackHref="/letters" />
      <BackLink href="/letters">Back to Letters</BackLink>
      <PageHeader
        title="Letter Template Settings"
        subtitle={`Template version ${settings.version}. Changes apply to NEW letters only — previously issued letters keep their original format.`}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataPanel className="p-6">
        {/* Company Info Tab */}
        {activeTab === "company" && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">These appear on the letterhead of every letter PDF.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Company Name</label>
                <input value={settings.companyName} onChange={(e) => updateField("companyName", e.target.value)} className="input mt-1 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Company Email</label>
                <input value={settings.companyEmail} onChange={(e) => updateField("companyEmail", e.target.value)} className="input mt-1 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Company Address</label>
                <input value={settings.companyAddress} onChange={(e) => updateField("companyAddress", e.target.value)} className="input mt-1 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Website</label>
                <input value={settings.companyWeb} onChange={(e) => updateField("companyWeb", e.target.value)} className="input mt-1 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">HR Email</label>
                <input value={settings.hrEmail} onChange={(e) => updateField("hrEmail", e.target.value)} className="input mt-1 text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Offer Letter Tab */}
        {activeTab === "offer" && (
          <div className="space-y-4 max-w-3xl">
            <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
              Use placeholders: <code className="bg-slate-100 px-1 rounded text-xs">{"{{recipientName}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{designation}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{duration}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{startDate}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{endDate}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{reportingTo}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{responsibilities}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{stipend}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{acceptanceDeadline}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{joiningDate}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{hrEmail}}"}</code>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700">Opening Paragraph</label>
              <textarea value={settings.offerIntro} onChange={(e) => updateField("offerIntro", e.target.value)} rows={3} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Duration Paragraph</label>
              <textarea value={settings.offerDuration} onChange={(e) => updateField("offerDuration", e.target.value)} rows={2} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Reporting & Responsibilities</label>
              <textarea value={settings.offerReporting} onChange={(e) => updateField("offerReporting", e.target.value)} rows={3} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Stipend Text</label>
              <textarea value={settings.offerStipend} onChange={(e) => updateField("offerStipend", e.target.value)} rows={2} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Acceptance Note</label>
              <textarea value={settings.offerAcceptanceNote} onChange={(e) => updateField("offerAcceptanceNote", e.target.value)} rows={2} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Completion Note (for interns)</label>
              <textarea value={settings.offerCompletionNote} onChange={(e) => updateField("offerCompletionNote", e.target.value)} rows={3} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Closing Line</label>
              <input value={settings.offerClosing} onChange={(e) => updateField("offerClosing", e.target.value)} className="input mt-1 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Acceptance Block</label>
              <textarea value={settings.offerAcceptanceBlock} onChange={(e) => updateField("offerAcceptanceBlock", e.target.value)} rows={2} className="input mt-1 text-sm w-full" />
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold text-slate-800">Page 2</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Page 2 Intro (sign & return instructions)</label>
              <textarea value={settings.page2Intro} onChange={(e) => updateField("page2Intro", e.target.value)} rows={3} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Welcome Message</label>
              <input value={settings.page2Welcome} onChange={(e) => updateField("page2Welcome", e.target.value)} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Contact Line</label>
              <input value={settings.page2Contact} onChange={(e) => updateField("page2Contact", e.target.value)} className="input mt-1 text-sm w-full" />
            </div>
          </div>
        )}

        {/* Experience Letter Tab */}
        {activeTab === "experience" && (
          <div className="space-y-4 max-w-3xl">
            <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
              Placeholders: <code className="bg-slate-100 px-1 rounded text-xs">{"{{salutation}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{recipientName}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{employmentType}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{designation}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{startDate}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{endDate}}"}</code>, <code className="bg-slate-100 px-1 rounded text-xs">{"{{dutiesDescription}}"}</code>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700">Title</label>
              <input value={settings.experienceTitle} onChange={(e) => updateField("experienceTitle", e.target.value)} className="input mt-1 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Intro Paragraph</label>
              <textarea value={settings.experienceIntro} onChange={(e) => updateField("experienceIntro", e.target.value)} rows={3} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Duties Paragraph</label>
              <textarea value={settings.experienceDuties} onChange={(e) => updateField("experienceDuties", e.target.value)} rows={2} className="input mt-1 text-sm w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Closing Paragraph</label>
              <textarea value={settings.experienceClosing} onChange={(e) => updateField("experienceClosing", e.target.value)} rows={2} className="input mt-1 text-sm w-full" />
            </div>
          </div>
        )}

        {/* Annexure Tab */}
        {activeTab === "annexure" && (
          <div className="space-y-4 max-w-3xl">
            <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">Document checklist shown on Page 2 of offer letters. Use bullet points with • character.</p>
            {settings.annexureItems.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="mt-2 text-sm font-bold text-slate-500 w-6 shrink-0">{idx + 1}.</span>
                <textarea
                  value={item}
                  onChange={(e) => updateAnnexureItem(idx, e.target.value)}
                  rows={3}
                  className="input text-sm flex-1"
                />
                <button type="button" onClick={() => removeAnnexureItem(idx)} className="shrink-0 mt-1 text-red-500 hover:text-red-700 text-xs font-bold">✕</button>
              </div>
            ))}
            <button type="button" onClick={addAnnexureItem} className="btn-secondary text-sm px-4 py-2">+ Add Item</button>
          </div>
        )}

        {/* Signatory Tab */}
        {activeTab === "signatory" && (
          <div className="space-y-5 max-w-2xl">
            <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">Default signatory for all letters. Signature and stamp images appear on the experience letter PDF.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Default Signatory Name</label>
                <input value={settings.defaultSignatoryName} onChange={(e) => updateField("defaultSignatoryName", e.target.value)} className="input mt-1 text-sm" placeholder="e.g. Govind Raj" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Default Signatory Role</label>
                <input value={settings.defaultSignatoryRole} onChange={(e) => updateField("defaultSignatoryRole", e.target.value)} className="input mt-1 text-sm" placeholder="e.g. Human Resources" />
              </div>
            </div>

            {/* Signature Image */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Signature Image URL</label>
              <input value={settings.defaultSignatoryImageUrl || ""} onChange={(e) => updateField("defaultSignatoryImageUrl", e.target.value)} className="input mt-1 text-sm w-full" placeholder="https://... or paste image URL from R2" />
              <p className="mt-1 text-xs text-slate-500">PNG with transparent background works best. Will appear on the left side of the signatory section.</p>
              {settings.defaultSignatoryImageUrl && (
                <div className="mt-2 inline-block rounded-lg border border-slate-200 bg-white p-2">
                  <img src={settings.defaultSignatoryImageUrl} alt="Signature preview" className="h-12 object-contain" />
                </div>
              )}
            </div>

            {/* Stamp Image */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Company Stamp Image URL</label>
              <input value={settings.defaultStampImageUrl || ""} onChange={(e) => updateField("defaultStampImageUrl", e.target.value)} className="input mt-1 text-sm w-full" placeholder="https://... or paste image URL from R2" />
              <p className="mt-1 text-xs text-slate-500">Round company stamp/seal PNG. Will appear on the right side next to the signature on experience letters.</p>
              {settings.defaultStampImageUrl && (
                <div className="mt-2 inline-block rounded-lg border border-slate-200 bg-white p-2">
                  <img src={settings.defaultStampImageUrl} alt="Stamp preview" className="h-16 object-contain" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-4">
          <button onClick={handleSave} disabled={saving} className="btn-primary px-6 py-2.5 text-sm">
            {saving ? "Saving..." : "Save Template Settings"}
          </button>
          {message && (
            <p className={`text-sm font-medium ${message.includes("saved") ? "text-emerald-700" : "text-red-600"}`}>
              {message}
            </p>
          )}
          <span className="text-xs text-slate-400 ml-auto">Version {settings.version}</span>
        </div>
      </DataPanel>
    </AppPageShell>
  );
}
