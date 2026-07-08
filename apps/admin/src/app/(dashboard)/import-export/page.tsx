"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
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

      const { apiUrl } = await import("@/lib/api");
      const { ensureCsrfToken } = await import("@/lib/api");
      await ensureCsrfToken();

      // Read CSRF token from cookie or in-memory
      const csrfMatch = document.cookie.match(/(?:^|; )funt_csrf=([^;]*)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const res = await fetch(apiUrl("/api/admin/data/export"), {
        method: "POST",
        headers,
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
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
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

      const courseFolder = zip.folder("courses");
      if (courseFolder) {
        const courseFiles = Object.keys(zip.files).filter(
          (n) => n.startsWith("courses/") && n.endsWith(".json")
        );
        for (const name of courseFiles) {
          const content = await zip.file(name)?.async("string");
          if (content) courses.push(JSON.parse(content));
        }
      }

      const batchFolder = zip.folder("batches");
      if (batchFolder) {
        const batchFiles = Object.keys(zip.files).filter(
          (n) => n.startsWith("batches/") && n.endsWith(".json")
        );
        for (const name of batchFiles) {
          const content = await zip.file(name)?.async("string");
          if (content) batchesArr.push(JSON.parse(content));
        }
      }

      const res = await api<Record<string, unknown>>("/api/admin/data/import/preview", {
        method: "POST",
        body: JSON.stringify({ manifest, courses, batches: batchesArr }),
      });

      if (res.success) {
        setPreview(res.data ?? null);
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

      const res = await api<Record<string, unknown>>("/api/admin/data/import", {
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
        setResult(res.data ?? null);
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

function GitBackupPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function handleBackup() {
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const { apiUrl } = await import("@/lib/api");
      const { ensureCsrfToken } = await import("@/lib/api");
      await ensureCsrfToken();
      const csrfMatch = document.cookie.match(/(?:^|; )funt_csrf=([^;]*)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), 180_000);

      const res = await fetch(apiUrl("/api/admin/backup/run"), {
        method: "POST",
        headers,
        credentials: "include",
        signal: controller.signal,
      });
      globalThis.clearTimeout(timeout);

      const json = await res.json().catch(() => ({ success: false, message: "Invalid response" }));
      if (json.success) {
        setResult(json.data ?? json);
      } else {
        throw new Error(json.message ?? "Backup failed");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("Backup is taking longer than expected. Check the repo in a few minutes.");
      } else {
        setError(err instanceof Error ? err.message : "Backup failed");
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Git Backup</h2>
      <p className="mt-1 text-sm text-slate-500">
        Push a full database snapshot (including R2 media links) to the backup git repository. Runs automatically every week.
      </p>

      <button
        type="button"
        onClick={handleBackup}
        disabled={running}
        className="mt-4 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {running ? "Backing up..." : "Run Backup Now"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-800">Backup Complete</p>
          <pre className="mt-2 max-h-60 overflow-auto text-xs text-emerald-900">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function RestorePanel() {
  const [restoreMode, setRestoreMode] = useState<"git" | "upload">("git");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [skipCollections, setSkipCollections] = useState("");

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { ensureCsrfToken } = await import("@/lib/api");
    await ensureCsrfToken();
    const csrfMatch = document.cookie.match(/(?:^|; )funt_csrf=([^;]*)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    return headers;
  }

  async function handleRestoreFromGit() {
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const { apiUrl } = await import("@/lib/api");
      const headers = await getAuthHeaders();

      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), 300_000); // 5 min timeout

      const res = await fetch(apiUrl("/api/admin/backup/restore"), {
        method: "POST",
        headers,
        credentials: "include",
        signal: controller.signal,
      });
      globalThis.clearTimeout(timeout);

      const json = await res.json().catch(() => ({ success: false, message: "Invalid response" }));
      if (json.success) {
        setResult(json.data ?? json);
      } else {
        throw new Error(json.message ?? "Restore failed");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("Restore is taking longer than expected. It may still be running — check logs.");
      } else {
        setError(err instanceof Error ? err.message : "Restore failed");
      }
    } finally {
      setRunning(false);
      setConfirmOpen(false);
    }
  }

  async function handleRestoreFromUpload() {
    if (!uploadFiles || uploadFiles.length === 0) return;
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const { apiUrl } = await import("@/lib/api");
      const headers = await getAuthHeaders();

      // Read all JSON files and build the collections object
      const collections: Record<string, unknown[]> = {};

      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        const text = await file.text();
        const parsed = JSON.parse(text);

        // File name becomes the collection name (e.g. "courses.json" → "courses")
        const collectionName = file.name.replace(/\.json$/i, "");

        if (Array.isArray(parsed)) {
          collections[collectionName] = parsed;
        } else {
          throw new Error(`File "${file.name}" does not contain a JSON array`);
        }
      }

      const skip = skipCollections.split(",").map((s) => s.trim()).filter(Boolean);

      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), 300_000);

      const res = await fetch(apiUrl("/api/admin/backup/restore-upload"), {
        method: "POST",
        headers,
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({ collections, skipCollections: skip }),
      });
      globalThis.clearTimeout(timeout);

      const json = await res.json().catch(() => ({ success: false, message: "Invalid response" }));
      if (json.success) {
        setResult(json.data ?? json);
      } else {
        throw new Error(json.message ?? "Restore failed");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("Restore is taking longer than expected. It may still be running — check logs.");
      } else {
        setError(err instanceof Error ? err.message : "Restore failed");
      }
    } finally {
      setRunning(false);
      setConfirmOpen(false);
    }
  }

  function handleConfirmRestore() {
    if (restoreMode === "git") {
      handleRestoreFromGit();
    } else {
      handleRestoreFromUpload();
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Restore from Backup</h2>
      <p className="mt-1 text-sm text-slate-500">
        Restore the entire database from a backup. All R2 media links are preserved — files remain in R2 storage.
      </p>

      {/* Warning banner */}
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <p className="text-xs font-bold text-amber-800">⚠️ Destructive Operation</p>
        <p className="mt-1 text-xs text-amber-700">
          Restoring will <strong>replace all data</strong> in each collection with the backup data.
          Active sessions are preserved but all other data will be overwritten.
          Make sure you have a current backup before restoring.
        </p>
      </div>

      {/* Restore mode selection */}
      <div className="mt-5 space-y-3">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
            restoreMode === "git" ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            name="restoreMode"
            checked={restoreMode === "git"}
            onChange={() => setRestoreMode("git")}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800">Restore from Git Repository</p>
            <p className="text-xs text-slate-500">Pull the latest backup from the configured GitHub backup repo and restore all collections.</p>
          </div>
        </label>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
            restoreMode === "upload" ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            name="restoreMode"
            checked={restoreMode === "upload"}
            onChange={() => setRestoreMode("upload")}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800">Restore from Downloaded Files</p>
            <p className="text-xs text-slate-500">Upload the JSON files from a downloaded backup (the data/*.json files from the backup repo).</p>
          </div>
        </label>
      </div>

      {/* Upload mode — file input */}
      {restoreMode === "upload" && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Select backup JSON files (e.g. courses.json, globalmodules.json, etc.)
            </label>
            <input
              type="file"
              accept=".json"
              multiple
              onChange={(e) => setUploadFiles(e.target.files)}
              className="mt-1 text-sm"
            />
            {uploadFiles && uploadFiles.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">{uploadFiles.length} file(s) selected</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Skip collections (optional, comma-separated)
            </label>
            <input
              type="text"
              value={skipCollections}
              onChange={(e) => setSkipCollections(e.target.value)}
              placeholder="users, enrollments"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Restore button */}
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={running || (restoreMode === "upload" && (!uploadFiles || uploadFiles.length === 0))}
          className="mt-4 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {running ? "Restoring..." : "Restore Database"}
        </button>
      ) : (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">Are you sure?</p>
          <p className="mt-1 text-xs text-red-700">
            This will overwrite current data with the backup. This action cannot be undone.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={handleConfirmRestore}
              disabled={running}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {running ? "Restoring..." : "Yes, Restore Now"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={running}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-800">Restore Complete</p>
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
    <AppPageShell>
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import / Export</h1>
        <p className="mt-1 text-sm text-slate-500">Backup, migrate, and clone platform data.</p>
      </div>

      <ExportPanel />
      <ImportPanel />
      <GitBackupPanel />
      <RestorePanel />
    </AppPageShell>
  );
}
