"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

type ExportLevel = 1 | 2 | 3 | 4;

const LEVEL_LABELS: Record<ExportLevel, { title: string; description: string }> = {
  1: { title: "Course Only", description: "Course + Modules + Chapters + Assignments + Learning Plan" },
  2: { title: "Course + Batches", description: "Includes batch snapshots, schedules, trainer assignments" },
  3: { title: "Academic Package", description: "Adds certificates config, license keys, attendance structure" },
  4: { title: "Full Platform", description: "Everything: shop, coupons, badges, gamification, all config" },
};

function ExportPanel() {
  const [level, setLevel] = useState<ExportLevel>(1);
  const [courseIds, setCourseIds] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setError("");
    setExporting(true);
    try {
      const body: Record<string, unknown> = { level };
      const ids = courseIds.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) body.courseIds = ids;

      const res = await fetch("/api/admin/data/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Export failed" }));
        throw new Error(err.message || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `funt-export-L${level}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Export Center</h2>
      <p className="mt-1 text-sm text-slate-500">Generate a ZIP package of platform data.</p>

      <div className="mt-5 space-y-3">
        {([1, 2, 3, 4] as ExportLevel[]).map((l) => (
          <label
            key={l}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              level === l ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="exportLevel"
              checked={level === l}
              onChange={() => setLevel(l)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-slate-800">Level {l} — {LEVEL_LABELS[l].title}</p>
              <p className="text-xs text-slate-500">{LEVEL_LABELS[l].description}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label className="block text-xs font-semibold text-slate-600">
          Course IDs (optional, comma-separated — leave empty for all)
        </label>
        <input
          type="text"
          value={courseIds}
          onChange={(e) => setCourseIds(e.target.value)}
          placeholder="CRS-25-00001, CRS-25-00002"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="mt-4 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {exporting ? "Generating..." : "Download Export ZIP"}
      </button>
    </div>
  );
}

function ImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"CREATE_NEW" | "MERGE" | "REPLACE">("CREATE_NEW");

  async function handlePreview() {
    if (!file) return;
    setError("");
    setPreview(null);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) throw new Error("Invalid package: no manifest.json found");
      const manifest = JSON.parse(await manifestFile.async("string"));

      // Load courses and batches for conflict detection
      const courses: unknown[] = [];
      const batchesArr: unknown[] = [];
      zip.folder("courses")?.forEach(async (_, zipEntry) => {
        if (zipEntry.name.endsWith(".json")) {
          courses.push(JSON.parse(await zipEntry.async("string")));
        }
      });
      zip.folder("batches")?.forEach(async (_, zipEntry) => {
        if (zipEntry.name.endsWith(".json")) {
          batchesArr.push(JSON.parse(await zipEntry.async("string")));
        }
      });

      // Wait a tick for async forEach to complete
      await new Promise((r) => setTimeout(r, 200));

      const res = await api<unknown>("/api/admin/data/import/preview", {
        method: "POST",
        body: JSON.stringify({ manifest, courses, batches: batchesArr }),
      });

      if (res.success) {
        setPreview(res.data);
      } else {
        throw new Error(res.message ?? "Preview failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  async function handleImport() {
    if (!file) return;
    setError("");
    setImporting(true);
    setResult(null);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) throw new Error("Invalid package");
      const manifest = JSON.parse(await manifestFile.async("string"));

      // Parse all entities from ZIP
      const parseFolder = async (folder: string): Promise<unknown[]> => {
        const items: unknown[] = [];
        const f = zip.folder(folder);
        if (!f) return items;
        const files = Object.keys(f.files).filter((n) => n.startsWith(`${folder}/`) && n.endsWith(".json"));
        for (const name of files) {
          const content = await zip.file(name)?.async("string");
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) items.push(...parsed);
            else items.push(parsed);
          }
        }
        return items;
      };

      const courses = await parseFolder("courses");
      const globalModules = await parseFolder("global-modules");
      const globalAssignments = await parseFolder("global-assignments");
      const batches = await parseFolder("batches");
      const licenseKeys = await parseFolder("license-keys");
      const coupons = await parseFolder("coupons");
      const shopProducts = await parseFolder("shop");
      const badgeDefinitions = await parseFolder("badges");

      const res = await api<unknown>("/api/admin/data/import", {
        method: "POST",
        body: JSON.stringify({
          mode,
          manifest,
          courses,
          globalModules,
          globalAssignments,
          batches,
          licenseKeys,
          coupons,
          shopProducts,
          badgeDefinitions,
        }),
      });

      if (res.success) {
        setResult(res.data);
      } else {
        throw new Error(res.message ?? "Import failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Import Center</h2>
      <p className="mt-1 text-sm text-slate-500">Upload a FUNT export package to import data.</p>

      <div className="mt-4">
        <input
          type="file"
          accept=".zip"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null); }}
          className="text-sm"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-600">Mode:</label>
        {(["CREATE_NEW", "MERGE", "REPLACE"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1 text-xs">
            <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
            {m === "CREATE_NEW" ? "Create New" : m === "MERGE" ? "Merge" : "Replace"}
          </label>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!file}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || importing}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-800">Import Preview</p>
          <pre className="mt-2 max-h-60 overflow-auto text-xs text-amber-900">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-800">Import Result</p>
          <pre className="mt-2 max-h-60 overflow-auto text-xs text-emerald-900">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ImportExportPage() {
  return (
    <RequireRoles roles={STAFF_ROLES}>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import / Export</h1>
          <p className="mt-1 text-sm text-slate-500">Backup, migrate, and clone platform data.</p>
        </div>

        <ExportPanel />
        <ImportPanel />
      </div>
    </RequireRoles>
  );
}
