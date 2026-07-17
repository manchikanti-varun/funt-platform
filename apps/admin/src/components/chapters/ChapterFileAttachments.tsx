"use client";

import { useRef, useState } from "react";
import { makeUploadFileFn, type UploadedFile } from "@/lib/uploadFileToR2";
import { Upload, X, Loader2 } from "lucide-react";

interface FileAttachment {
  fileKey: string;
  filename: string;
  size?: number;
  mimeType?: string;
}

interface Props {
  courseId: string;
  moduleId: string;
  files: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
  disabled?: boolean;
}

const FILE_ICON_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "application/json": "JSON",
};

function getFileLabel(mimeType?: string): string {
  if (!mimeType) return "FILE";
  return FILE_ICON_MAP[mimeType] ?? mimeType.split("/").pop()?.toUpperCase().slice(0, 4) ?? "FILE";
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChapterFileAttachments({ courseId, moduleId, files, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setError("");
    setUploading(true);
    setProgress(0);

    const uploadFn = makeUploadFileFn({ courseId, moduleId });
    const newFiles: FileAttachment[] = [...files];

    for (let i = 0; i < fileList.length; i++) {
      try {
        const result: UploadedFile = await uploadFn(fileList[i], (pct) => {
          setProgress(Math.round((i / fileList.length) * 100 + pct / fileList.length));
        });
        newFiles.push({
          fileKey: result.fileKey,
          filename: result.filename,
          size: result.size,
          mimeType: result.mimeType,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        break;
      }
    }

    onChange(newFiles);
    setUploading(false);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">
          Downloadable Files ({files.length})
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? `Uploading ${progress}%` : "Add Files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.zip,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.txt,.csv,.png,.jpg,.jpeg,.svg,.json"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={f.fileKey} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-indigo-100 text-[9px] font-bold text-indigo-700">
                {getFileLabel(f.mimeType)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{f.filename}</p>
                {f.size && <p className="text-[10px] text-slate-400">{formatSize(f.size)}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                disabled={disabled}
                className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                title="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && !uploading && (
        <p className="text-xs text-slate-400">
          No files attached. Students will be able to download any files you add here.
        </p>
      )}
    </div>
  );
}
