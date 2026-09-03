"use client";

/**
 * FontUploader — upload TTF/OTF fonts for use in workshop certificate templates.
 *
 * Uploads directly to R2 via presigned PUT URLs.
 */

import React, { useRef, useState } from "react";
import { api, apiUrl } from "@/lib/api";

export interface CustomFont {
  fontKey: string;
  name: string;
  r2Key: string;
  publicUrl: string;
  variants: string[];
}

interface FontUploaderProps {
  fonts: CustomFont[];
  onChange: (fonts: CustomFont[]) => void;
}

export function FontUploader({ fonts, onChange }: FontUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isTtf = ext === "ttf";
    const isOtf = ext === "otf";
    if (!isTtf && !isOtf) {
      setError("Only TTF and OTF font files are supported.");
      return;
    }

    setUploading(true);
    try {
      // 1. Presign
      const presignRes = await api<{ uploadUrl: string; imageKey: string }>(
        "/api/admin/images/presign",
        {
          method: "POST",
          body: JSON.stringify({
            courseId: "workshop-certs",
            moduleId: "fonts",
            mimeType: isTtf ? "font/ttf" : "font/otf",
          }),
        }
      );
      if (!presignRes.success || !presignRes.data) {
        throw new Error(presignRes.message ?? "Failed to get upload URL");
      }
      const { uploadUrl, imageKey: r2Key } = presignRes.data;

      // 2. Upload to R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", () => {});
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", isTtf ? "font/ttf" : "font/otf");
        xhr.send(file);
      });

      // 3. Confirm
      const confirmRes = await api<{ imageKey: string }>(
        "/api/admin/images/confirm",
        { method: "POST", body: JSON.stringify({ imageKey: r2Key }) }
      );
      if (!confirmRes.success) {
        throw new Error(confirmRes.message ?? "Upload confirmation failed");
      }

      // 4. Build font entry
      const fontName = file.name.replace(/\.(ttf|otf)$/i, "").replace(/[-_]/g, " ").trim();
      const fontKey = fontName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const publicUrl = apiUrl(`/api/admin/images/serve/${r2Key}`);

      const newFont: CustomFont = {
        fontKey,
        name: fontName,
        r2Key,
        publicUrl,
        variants: ["normal"],
      };

      onChange([...fonts, newFont]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Font upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeFont = (fontKey: string) => {
    onChange(fonts.filter((f) => f.fontKey !== fontKey));
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">
        Custom Fonts
        {fonts.length > 0 && (
          <span className="ml-1 text-slate-400">({fonts.length} uploaded)</span>
        )}
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Uploaded fonts list */}
      {fonts.length > 0 && (
        <div className="space-y-1">
          {fonts.map((font) => (
            <div
              key={font.fontKey}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div>
                <span className="text-xs font-medium text-slate-700">{font.name}</span>
                <span className="ml-2 text-[10px] text-slate-400">
                  key: <code>{font.fontKey}</code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFont(font.fontKey)}
                className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-center transition ${
          uploading
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : "border-slate-300 bg-slate-50/50 hover:border-violet-300 hover:bg-violet-50/30"
        }`}
      >
        {uploading ? (
          <span className="text-xs text-slate-500">Uploading…</span>
        ) : (
          <span className="text-xs text-slate-500">
            + Upload TTF or OTF font
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
