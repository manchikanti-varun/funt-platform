"use client";

/**
 * Workshop Certificate Generator — full-featured page.
 *
 * Implements all 13 requested features:
 *   1.  Drag-and-drop text field positioning (via TemplateCanvas)
 *   2.  Live text preview on canvas (via TemplateCanvas)
 *   3.  Custom font upload (via FontUploader)
 *   4.  QR code field type
 *   5.  Row picker for preview from uploaded data
 *   6.  (Email delivery — see backend integration point, not wired to provider yet)
 *   7.  Certificate registry / audit log
 *   8.  Template duplication
 *   9.  Batch name/date auto-field (defaultFieldValues)
 *   10. Undo/redo in designer
 *   11. Image zoom in canvas (via TemplateCanvas)
 *   12. Multi-page certificate support
 *   13. Generation history on list page
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUrl, getToken } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  TemplateCanvas,
  type TextFieldConfig,
} from "@/components/workshop-certs/TemplateCanvas";
import {
  FontUploader,
  type CustomFont,
} from "@/components/workshop-certs/FontUploader";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TemplatePage {
  pageIndex: number;
  imageKey: string;
  imageUrl: string;
  width: number;
  height: number;
  textFields: TextFieldConfig[];
}

interface WorkshopTemplate {
  _id: string;
  name: string;
  templateImageKey: string;
  templateImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  textFields: TextFieldConfig[];
  pages: TemplatePage[];
  customFonts: CustomFont[];
  defaultFieldValues: Record<string, string>;
  generationHistory: Array<{
    generatedAt: string;
    recipientCount: number;
    generatedBy: string;
  }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface IssuedCert {
  certificateId: string;
  templateId: string;
  fieldValues: Record<string, string>;
  generatedBy: string;
  generatedAt: string;
  status: "ISSUED" | "REVOKED";
}

type View = "list" | "designer" | "generate" | "registry";

// ─── Helpers ────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Deep clone for undo/redo stack. */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Undo/Redo Hook ─────────────────────────────────────────────────────────

function useUndoRedo<T>(initial: T, maxSteps = 50) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setPresent((prev) => {
        const newVal = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        setPast((p) => [...p.slice(-maxSteps + 1), deepClone(prev)]);
        setFuture([]);
        return newVal;
      });
    },
    [maxSteps]
  );

  const undo = useCallback(() => {
    setPast((past) => {
      if (past.length === 0) return past;
      const prev = past[past.length - 1];
      setPast(past.slice(0, -1));
      setFuture((f) => [deepClone(present), ...f]);
      setPresent(prev);
      return past;
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture((future) => {
      if (future.length === 0) return future;
      const next = future[0];
      setFuture(future.slice(1));
      setPast((p) => [...p, deepClone(present)]);
      setPresent(next);
      return future;
    });
  }, [present]);

  return { present, set, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

// ─── Template Designer ─────────────────────────────────────────────────────

function TemplateDesigner({
  template,
  onSaved,
  onCancel,
}: {
  template?: WorkshopTemplate;
  onSaved: (tpl: WorkshopTemplate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [imageUrl, setImageUrl] = useState(template?.templateImageUrl ?? "");
  const [imageKey, setImageKey] = useState(template?.templateImageKey ?? "");
  const [imageWidth, setImageWidth] = useState(template?.imageWidth ?? 0);
  const [imageHeight, setImageHeight] = useState(template?.imageHeight ?? 0);

  // Undo/redo for text fields
  const fieldsUndo = useUndoRedo<TextFieldConfig[]>(template?.textFields ?? []);
  const textFields = fieldsUndo.present;
  const setTextFields = fieldsUndo.set;
  const undoFields = fieldsUndo.undo;
  const redoFields = fieldsUndo.redo;
  const canUndoFields = fieldsUndo.canUndo;
  const canRedoFields = fieldsUndo.canRedo;

  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>(template?.customFonts ?? []);
  const [defaultFieldValues, setDefaultFieldValues] = useState<Record<string, string>>(
    template?.defaultFieldValues ?? {}
  );
  const [pages, setPages] = useState<TemplatePage[]>(template?.pages ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageFileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!template;

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoFields();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redoFields();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoFields, redoFields]);

  // Upload template image
  const handleImageUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError("");
      try {
        const presignRes = await api<{ uploadUrl: string; imageKey: string }>(
          "/api/admin/images/presign",
          {
            method: "POST",
            body: JSON.stringify({
              courseId: "workshop-certs",
              moduleId: "templates",
              mimeType: file.type,
            }),
          }
        );
        if (!presignRes.success || !presignRes.data) {
          throw new Error(presignRes.message ?? "Failed to get upload URL");
        }
        const { uploadUrl, imageKey: key } = presignRes.data;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", () => {});
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        const confirmRes = await api<{ imageKey: string }>(
          "/api/admin/images/confirm",
          { method: "POST", body: JSON.stringify({ imageKey: key }) }
        );
        if (!confirmRes.success) throw new Error(confirmRes.message ?? "Confirmation failed");

        const img = new Image();
        const publicUrl = apiUrl(`/api/admin/images/serve/${key}`);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image preview"));
          img.src = publicUrl;
        });

        setImageUrl(publicUrl);
        setImageKey(key);
        setImageWidth(img.naturalWidth);
        setImageHeight(img.naturalHeight);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Image upload failed");
      } finally {
        setUploading(false);
      }
    },
    []
  );

  // Add text field
  const addTextField = (type: "text" | "qr_code" = "text") => {
    const idx = textFields.length + 1;
    const newField: TextFieldConfig =
      type === "qr_code"
        ? {
            key: `qr_${idx}`,
            label: `QR Code ${idx}`,
            x: 0.5,
            y: 0.8,
            fontSize: 12,
            fontFamily: "Helvetica",
            fontWeight: "normal",
            align: "center",
            color: "#000000",
            maxWidth: 0.2,
            fieldType: "qr_code",
            qrSize: 150,
          }
        : {
            key: `field_${idx}`,
            label: `Text Field ${idx}`,
            x: 0.3,
            y: 0.4,
            fontSize: 24,
            fontFamily: "Helvetica",
            fontWeight: "normal",
            align: "center",
            color: "#000000",
            maxWidth: 0.4,
          };
    setTextFields([...textFields, newField]);
    setSelectedField(textFields.length);
  };

  const updateField = (index: number, updates: Partial<TextFieldConfig>) => {
    const updated = [...textFields];
    updated[index] = { ...updated[index], ...updates };
    setTextFields(updated);
  };

  const removeField = (index: number) => {
    setTextFields(textFields.filter((_, i) => i !== index));
    setSelectedField(null);
  };

  // Drag-move from canvas
  const handleFieldMove = (index: number, x: number, y: number) => {
    updateField(index, { x, y });
  };

  // Add extra page
  const handlePageUpload = async (file: File) => {
    setUploading(true);
    try {
      const presignRes = await api<{ uploadUrl: string; imageKey: string }>(
        "/api/admin/images/presign",
        {
          method: "POST",
          body: JSON.stringify({
            courseId: "workshop-certs",
            moduleId: `page-${pages.length + 1}`,
            mimeType: file.type,
          }),
        }
      );
      if (!presignRes.success || !presignRes.data) throw new Error(presignRes.message ?? "Presign failed");
      const { uploadUrl, imageKey: key } = presignRes.data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", () => {});
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Upload failed"));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      const confirmRes = await api<{ imageKey: string }>(
        "/api/admin/images/confirm",
        { method: "POST", body: JSON.stringify({ imageKey: key }) }
      );
      if (!confirmRes.success) throw new Error(confirmRes.message ?? "Confirm failed");

      const img = new Image();
      const publicUrl = apiUrl(`/api/admin/images/serve/${key}`);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = publicUrl;
      });

      setPages([
        ...pages,
        {
          pageIndex: pages.length + 1,
          imageKey: key,
          imageUrl: publicUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          textFields: [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Page upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Save
  const handleSave = async () => {
    if (!name.trim()) { setError("Template name is required"); return; }
    if (!imageKey) { setError("Upload a template image first"); return; }
    if (textFields.length === 0) { setError("Add at least one text field"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        templateImageKey: imageKey,
        templateImageUrl: imageUrl,
        imageWidth,
        imageHeight,
        textFields,
        pages,
        customFonts,
        defaultFieldValues,
      };
      if (isEditing) {
        const res = await api<WorkshopTemplate>(
          `/api/workshop-certificates/templates/${template._id}`,
          { method: "PUT", body: JSON.stringify(body) }
        );
        if (!res.success || !res.data) throw new Error(res.message ?? "Update failed");
        onSaved(res.data);
      } else {
        const res = await api<WorkshopTemplate>(
          "/api/workshop-certificates/templates",
          { method: "POST", body: JSON.stringify(body) }
        );
        if (!res.success || !res.data) throw new Error(res.message ?? "Create failed");
        onSaved(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // All available font options (built-in + custom)
  const fontOptions = [
    "Helvetica",
    "Times",
    "Courier",
    ...customFonts.map((f) => f.fontKey),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ← Back
        </button>
        <h2 className="text-lg font-bold text-slate-800">
          {isEditing ? "Edit Template" : "New Template"}
        </h2>
        {/* Undo/Redo buttons */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={undoFields}
            disabled={!canUndoFields}
            title="Undo (Ctrl+Z)"
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redoFields}
            disabled={!canRedoFields}
            title="Redo (Ctrl+Y)"
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            ↷
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Name & Image */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">1. Template Name & Image</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Workshop Certificate 2026"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Template Image</label>
            {imageUrl ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-3">
                <span className="text-sm text-emerald-700">
                  ✓ Image uploaded ({imageWidth} × {imageHeight}px)
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                >
                  Replace
                </button>
              </div>
            ) : (
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleImageUpload(file);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center transition hover:border-violet-300 hover:bg-violet-50/30"
              >
                {uploading ? (
                  <div className="spinner spinner--inline" />
                ) : (
                  <>
                    <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    <p className="text-sm font-semibold text-slate-700">Click or drag a certificate image here</p>
                    <p className="text-xs text-slate-500">PNG, JPG up to 10MB</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      {/* Step 2: Custom Fonts */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">2. Custom Fonts (optional)</h3>
        <FontUploader fonts={customFonts} onChange={setCustomFonts} />
      </div>

      {/* Step 3: Default Field Values (batch pre-fill) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          3. Default Values (batch pre-fill)
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          These values are applied to all recipients unless overridden in the data file.
          Great for workshop name, date, location, etc.
        </p>
        {textFields.length === 0 ? (
          <p className="text-xs text-slate-400">Add text fields first.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {textFields.filter((f) => f.fieldType !== "qr_code").map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                  {field.key}
                  {defaultFieldValues[field.key] && (
                    <span className="ml-1 text-violet-500">(pre-filled)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={defaultFieldValues[field.key] ?? ""}
                  onChange={(e) =>
                    setDefaultFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={`Default for ${field.label}`}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 4: Text Fields */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">4. Text Fields</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addTextField("text")}
              disabled={!imageKey}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              + Text Field
            </button>
            <button
              type="button"
              onClick={() => addTextField("qr_code")}
              disabled={!imageKey}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              + QR Code
            </button>
          </div>
        </div>

        {!imageKey && (
          <p className="text-sm text-slate-400">Upload an image first to add fields.</p>
        )}

        {textFields.length > 0 && (
          <div className="space-y-3">
            {textFields.map((field, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-3 transition ${
                  selectedField === idx
                    ? "border-violet-300 bg-violet-50/50 ring-2 ring-violet-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                onClick={() => setSelectedField(idx)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Key</label>
                        <input
                          type="text"
                          value={field.key}
                          onChange={(e) => updateField(idx, { key: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="studentName"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Label</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Student Name"
                        />
                      </div>
                    </div>

                    {field.fieldType !== "qr_code" && (
                      <>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">X (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={Math.round(field.x * 100)}
                              onChange={(e) => updateField(idx, { x: Number(e.target.value) / 100 })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Y (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={Math.round(field.y * 100)}
                              onChange={(e) => updateField(idx, { y: Number(e.target.value) / 100 })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Font Size</label>
                            <input
                              type="number"
                              min={6}
                              max={200}
                              value={field.fontSize}
                              onChange={(e) => updateField(idx, { fontSize: Number(e.target.value) })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Max W (%)</label>
                            <input
                              type="number"
                              min={10}
                              max={100}
                              value={Math.round(field.maxWidth * 100)}
                              onChange={(e) => updateField(idx, { maxWidth: Number(e.target.value) / 100 })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Font</label>
                            <select
                              value={field.fontFamily}
                              onChange={(e) => updateField(idx, { fontFamily: e.target.value })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            >
                              {fontOptions.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Weight</label>
                            <select
                              value={field.fontWeight}
                              onChange={(e) => updateField(idx, { fontWeight: e.target.value as "normal" | "bold" })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            >
                              <option value="normal">Normal</option>
                              <option value="bold">Bold</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Align</label>
                            <select
                              value={field.align}
                              onChange={(e) => updateField(idx, { align: e.target.value as "left" | "center" | "right" })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-medium text-slate-500">Color:</label>
                          <input
                            type="color"
                            value={field.color}
                            onChange={(e) => updateField(idx, { color: e.target.value })}
                            className="h-6 w-8 rounded border border-slate-200"
                          />
                          <span className="text-[10px] text-slate-400">{field.color}</span>
                        </div>
                      </>
                    )}

                    {field.fieldType === "qr_code" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">X (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={Math.round(field.x * 100)}
                            onChange={(e) => updateField(idx, { x: Number(e.target.value) / 100 })}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Y (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={Math.round(field.y * 100)}
                            onChange={(e) => updateField(idx, { y: Number(e.target.value) / 100 })}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">QR Size (px)</label>
                          <input
                            type="number"
                            min={50}
                            max={500}
                            value={field.qrSize ?? 150}
                            onChange={(e) => updateField(idx, { qrSize: Number(e.target.value) })}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Max W (%)</label>
                          <input
                            type="number"
                            min={5}
                            max={50}
                            value={Math.round(field.maxWidth * 100)}
                            onChange={(e) => updateField(idx, { maxWidth: Number(e.target.value) / 100 })}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeField(idx); }}
                      className="rounded border border-red-200 bg-red-50 p-1 text-red-500 hover:bg-red-100"
                      title="Remove field"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 5: Visual Preview Canvas */}
      {imageUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            5. Visual Preview & Positioning
            {selectedField !== null && (
              <span className="ml-2 text-violet-600">
                — Drag &ldquo;{textFields[selectedField]?.label}&rdquo; to reposition
              </span>
            )}
          </h3>
          <TemplateCanvas
            imageUrl={imageUrl}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            textFields={textFields}
            selectedFieldIndex={selectedField}
            sampleValues={sampleValues}
            onFieldMove={handleFieldMove}
            onFieldSelect={setSelectedField}
          />
          {/* Quick sample value input */}
          {selectedField !== null && textFields[selectedField] && textFields[selectedField].fieldType !== "qr_code" && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-slate-500">Preview text:</label>
              <input
                type="text"
                value={sampleValues[textFields[selectedField].key] ?? ""}
                onChange={(e) =>
                  setSampleValues((prev) => ({ ...prev, [textFields[selectedField].key]: e.target.value }))
                }
                placeholder={textFields[selectedField].label}
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Step 6: Multi-page */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">6. Additional Pages (optional)</h3>
          <button
            type="button"
            onClick={() => pageFileInputRef.current?.click()}
            disabled={!imageKey}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            + Add Page
          </button>
        </div>
        <input
          ref={pageFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePageUpload(file);
            e.target.value = "";
          }}
        />
        {pages.length === 0 ? (
          <p className="text-xs text-slate-400">No additional pages. Templates can have multiple pages (front/back).</p>
        ) : (
          <div className="space-y-2">
            {pages.map((page, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.imageUrl} alt={`Page ${page.pageIndex}`} className="h-12 w-16 rounded border object-cover" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-700">Page {page.pageIndex + 1}</p>
                  <p className="text-[10px] text-slate-400">{page.width} × {page.height}px · {page.textFields.length} fields</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPages(pages.filter((_, i) => i !== idx))}
                  className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !imageKey}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEditing ? "Update Template" : "Create Template"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Certificate Generator ──────────────────────────────────────────────────

function CertificateGenerator({
  template,
  onBack,
  onViewRegistry,
}: {
  template: WorkshopTemplate;
  onBack: () => void;
  onViewRegistry: (templateId: string) => void;
}) {
  const [studentData, setStudentData] = useState<Record<string, string>[]>([]);
  const [dataError, setDataError] = useState("");
  const [dataFileName, setDataFileName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [generationProgress, setGenerationProgress] = useState("");
  const [defaultOverride, setDefaultOverride] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All text field keys (non-QR)
  const textFieldKeys = template.textFields
    .filter((f) => f.fieldType !== "qr_code")
    .map((f) => f.key);

  // QR field keys
  const qrFieldKeys = template.textFields
    .filter((f) => f.fieldType === "qr_code")
    .map((f) => f.key);

  // Parse uploaded JSON/CSV
  const handleDataUpload = useCallback((file: File) => {
    setDataError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let data: Record<string, string>[];

        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          data = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          const lines = text.split("\n").filter((l) => l.trim());
          if (lines.length < 2) { setDataError("CSV must have a header + data rows"); return; }
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
          data = lines.slice(1).map((line) => {
            const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
            return row;
          });
        }

        if (data.length === 0) { setDataError("No data rows found"); return; }
        setStudentData(data);
        setDataFileName(file.name);
        setSelectedRowIndex(0);
      } catch (err) {
        setDataError(err instanceof Error ? err.message : "Failed to parse file");
      }
    };
    reader.readAsText(file);
  }, []);

  // Preview
  const handlePreview = async () => {
    const row = studentData[selectedRowIndex] ?? {};
    const fieldValues = { ...template.defaultFieldValues, ...defaultOverride, ...row };
    try {
      const res = await fetch(apiUrl("/api/workshop-certificates/preview"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ templateId: template._id, fieldValues }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch { /* silent */ }
  };

  // Generate all
  const handleGenerateAll = async () => {
    if (studentData.length === 0) return;
    setGenerating(true);
    setGenerationProgress("Generating certificates…");
    try {
      const recipients = studentData.map((row, i) => ({
        index: i,
        name: row.name ?? row.studentName ?? row.student_name ?? `recipient-${i + 1}`,
        fieldValues: { ...template.defaultFieldValues, ...defaultOverride, ...row },
      }));

      const res = await fetch(apiUrl("/api/workshop-certificates/generate-bulk"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({
          templateId: template._id,
          recipients,
          defaultFieldValues: template.defaultFieldValues,
        }),
      });
      if (!res.ok) throw new Error("Bulk generation failed");
      const blob = await res.blob();
      downloadBlob(blob, `workshop-certificates-${Date.now()}.zip`);
      setGenerationProgress(`✓ Downloaded ${studentData.length} certificates`);
    } catch (err) {
      setGenerationProgress(`Error: ${err instanceof Error ? err.message : "Generation failed"}`);
    } finally {
      setGenerating(false);
    }
  };

  const sampleJson = template.textFields.map((f) => `"${f.key}": "value"`).join(", ");
  const sampleData = `[\n  { ${sampleJson} },\n  { ${sampleJson} }\n]`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ← Back
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Generate Certificates</h2>
          <p className="text-xs text-slate-500">Template: {template.name}</p>
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => onViewRegistry(template._id)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            View Registry
          </button>
        </div>
      </div>

      {/* Expected fields */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Expected data fields:</h3>
        <div className="flex flex-wrap gap-2">
          {textFieldKeys.map((k) => (
            <span key={k} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{k}</span>
          ))}
          {qrFieldKeys.map((k) => (
            <span key={k} className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              {k} (auto QR)
            </span>
          ))}
        </div>
      </div>

      {/* Sample format */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Expected format (JSON):</h3>
        <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{sampleData}</pre>
      </div>

      {/* Default field overrides */}
      {textFieldKeys.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Batch Defaults (override template defaults per-generation)</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {textFieldKeys.map((k) => (
              <div key={k}>
                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">{k}</label>
                <input
                  type="text"
                  value={defaultOverride[k] ?? template.defaultFieldValues[k] ?? ""}
                  onChange={(e) => setDefaultOverride((prev) => ({ ...prev, [k]: e.target.value }))}
                  placeholder={template.defaultFieldValues[k] ? `Default: ${template.defaultFieldValues[k]}` : "Leave empty to skip"}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload data */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Upload Student Data</h3>
        {dataFileName && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-3">
            <span className="text-sm text-emerald-700">✓ {dataFileName} — {studentData.length} records</span>
            <button
              type="button"
              onClick={() => { setStudentData([]); setDataFileName(""); setSelectedRowIndex(0); }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        )}

        {dataError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dataError}</div>
        )}

        {studentData.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center transition hover:border-violet-300 hover:bg-violet-50/30"
          >
            <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm font-semibold text-slate-700">Click or drag a JSON / CSV file here</p>
            <p className="text-xs text-slate-500">Supports .json and .csv files</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-2 py-2 text-center font-semibold text-slate-700 w-8">#</th>
                  {textFieldKeys.map((k) => (
                    <th key={k} className="px-3 py-2 text-left font-semibold text-slate-700">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentData.slice(0, 20).map((row, i) => (
                  <tr
                    key={i}
                    className={`cursor-pointer transition ${
                      i === selectedRowIndex
                        ? "bg-violet-50 ring-1 ring-inset ring-violet-300"
                        : "hover:bg-slate-50/50"
                    }`}
                    onClick={() => setSelectedRowIndex(i)}
                  >
                    <td className="px-2 py-1.5 text-center text-slate-400">{i + 1}</td>
                    {textFieldKeys.map((k) => (
                      <td key={k} className="px-3 py-1.5 text-slate-600">{row[k] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
                {studentData.length > 20 && (
                  <tr>
                    <td colSpan={textFieldKeys.length + 1} className="px-3 py-2 text-center text-xs text-slate-400">
                      … and {studentData.length - 20} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleDataUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Preview with row picker */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Preview Certificate</h3>
        {studentData.length > 0 && (
          <div className="mb-3 flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600">Preview row:</label>
            <select
              value={selectedRowIndex}
              onChange={(e) => setSelectedRowIndex(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
            >
              {studentData.map((row, i) => {
                const label = row.name ?? row.studentName ?? row.student_name ?? `Row ${i + 1}`;
                return (
                  <option key={i} value={i}>
                    Row {i + 1}: {label}
                  </option>
                );
              })}
            </select>
            <span className="text-xs text-slate-400">
              {selectedRowIndex + 1} of {studentData.length}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handlePreview}
          disabled={studentData.length === 0}
          className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
        >
          Preview Row {selectedRowIndex + 1}
        </button>

        {previewUrl && (
          <div className="mt-4">
            <iframe
              src={previewUrl}
              className="w-full rounded-lg border border-slate-200"
              style={{ height: "600px" }}
              title="Certificate Preview"
            />
          </div>
        )}
      </div>

      {/* Generate */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Generate & Download</h3>
        {generationProgress && (
          <div
            className={`mb-3 rounded-lg border px-4 py-3 text-sm ${
              generationProgress.startsWith("Error")
                ? "border-red-200 bg-red-50 text-red-700"
                : generationProgress.startsWith("✓")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {generationProgress}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={studentData.length === 0 || generating}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {generating ? "Generating…" : `Generate & Download All (${studentData.length})`}
          </button>
          <span className="text-xs text-slate-400">ZIP with one PDF per recipient</span>
        </div>
      </div>
    </div>
  );
}

// ─── Certificate Registry View ──────────────────────────────────────────────

function RegistryView({
  templateId,
  onBack,
}: {
  templateId: string;
  onBack: () => void;
}) {
  const [certs, setCerts] = useState<IssuedCert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<IssuedCert[]>(`/api/workshop-certificates/templates/${templateId}/registry`)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setCerts(res.data);
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  const handleRevoke = async (certificateId: string) => {
    if (!confirm("Revoke this certificate?")) return;
    const res = await api(`/api/workshop-certificates/revoke/${certificateId}`, { method: "POST" });
    if (res.success) {
      setCerts((prev) =>
        prev.map((c) =>
          c.certificateId === certificateId ? { ...c, status: "REVOKED" as const } : c
        )
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ← Back
        </button>
        <h2 className="text-lg font-bold text-slate-800">Certificate Registry</h2>
        <span className="text-sm text-slate-400">({certs.length} certificates)</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      ) : certs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-500">No certificates issued for this template yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Certificate ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Issued</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {certs.map((cert) => (
                <tr key={cert.certificateId} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{cert.certificateId}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {cert.fieldValues.name ?? cert.fieldValues.studentName ?? cert.fieldValues.student_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(cert.generatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {cert.status === "ISSUED" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Issued</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Revoked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {cert.status === "ISSUED" && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(cert.certificateId)}
                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function WorkshopCertificatesPage() {
  const [view, setView] = useState<View>("list");
  const [templates, setTemplates] = useState<WorkshopTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<WorkshopTemplate | undefined>(undefined);
  const [generatingTemplate, setGeneratingTemplate] = useState<WorkshopTemplate | null>(null);
  const [registryTemplateId, setRegistryTemplateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const res = await api<WorkshopTemplate[]>("/api/workshop-certificates/templates");
    if (res.success && Array.isArray(res.data)) setTemplates(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(id);
    await api(`/api/workshop-certificates/templates/${id}`, { method: "DELETE" });
    setDeletingId(null);
    loadTemplates();
  };

  const handleDuplicate = async (id: string) => {
    const res = await api<WorkshopTemplate>(
      `/api/workshop-certificates/templates/${id}/duplicate`,
      { method: "POST" }
    );
    if (res.success) loadTemplates();
  };

  const handleTemplateSaved = (_tpl: WorkshopTemplate) => {
    setEditingTemplate(undefined);
    setView("list");
    loadTemplates();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();
  const formatRelativeTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  // ── List View ──
  if (view === "list") {
    return (
      <AppPageShell>
        <PageHeader
          title="Workshop Certificates"
          subtitle="Upload a certificate template, position text fields, provide student data, and generate certificates in bulk."
          actions={
            <button
              type="button"
              onClick={() => { setEditingTemplate(undefined); setView("designer"); }}
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              + New Template
            </button>
          }
        />

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="mt-4 text-sm font-medium text-slate-700">No templates yet</p>
            <p className="mt-1 text-sm text-slate-500">Create your first template to start generating workshop certificates.</p>
            <button
              type="button"
              onClick={() => { setEditingTemplate(undefined); setView("designer"); }}
              className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              + Create Template
            </button>
          </div>
        )}

        {!loading && templates.length > 0 && (
          <div className="space-y-3">
            {templates.map((tpl) => {
              const lastGen = tpl.generationHistory?.[0];
              return (
                <div
                  key={tpl._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/20"
                >
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tpl.templateImageUrl}
                      alt={tpl.name}
                      className="h-16 w-24 rounded-lg border border-slate-200 object-cover"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{tpl.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {tpl.imageWidth} × {tpl.imageHeight}px · {tpl.textFields.length} field{tpl.textFields.length !== 1 ? "s" : ""}
                        {tpl.customFonts?.length ? ` · ${tpl.customFonts.length} font(s)` : ""}
                        {tpl.pages?.length ? ` · ${tpl.pages.length + 1} pages` : ""}
                      </p>
                      {/* Generation history */}
                      {lastGen ? (
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Last generated {formatRelativeTime(lastGen.generatedAt)} · {lastGen.recipientCount} recipient{lastGen.recipientCount !== 1 ? "s" : ""}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-slate-400">Created {formatDate(tpl.createdAt)} · Never generated</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setGeneratingTemplate(tpl); setView("generate"); }}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRegistryTemplateId(tpl._id); setView("registry"); }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      title="View issued certificates"
                    >
                      Registry
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(tpl._id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      title="Duplicate template"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingTemplate(tpl); setView("designer"); }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === tpl._id}
                      onClick={() => handleDelete(tpl._id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingId === tpl._id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AppPageShell>
    );
  }

  // ── Designer View ──
  if (view === "designer") {
    return (
      <AppPageShell>
        <TemplateDesigner
          template={editingTemplate}
          onSaved={handleTemplateSaved}
          onCancel={() => { setEditingTemplate(undefined); setView("list"); }}
        />
      </AppPageShell>
    );
  }

  // ── Generate View ──
  if (view === "generate" && generatingTemplate) {
    return (
      <AppPageShell>
        <CertificateGenerator
          template={generatingTemplate}
          onBack={() => { setGeneratingTemplate(null); setView("list"); }}
          onViewRegistry={(id) => { setRegistryTemplateId(id); setView("registry"); }}
        />
      </AppPageShell>
    );
  }

  // ── Registry View ──
  if (view === "registry" && registryTemplateId) {
    return (
      <AppPageShell>
        <RegistryView
          templateId={registryTemplateId}
          onBack={() => { setRegistryTemplateId(null); setView("list"); }}
        />
      </AppPageShell>
    );
  }

  return null;
}
