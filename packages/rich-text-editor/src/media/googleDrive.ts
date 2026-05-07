import type { MediaAsset, MediaProvider, MediaUploadInput, MediaValidationResult } from "./provider.js";
import { toGoogleDrivePreviewUrl } from "./googleDriveUtils.js";

export interface GoogleDriveUploadClient {
  upload(file: File, options?: { signal?: AbortSignal; onProgress?: (progress: number) => void }): Promise<{
    id: string;
    url: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
  delete(fileId: string): Promise<void>;
}

const DEFAULT_ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
] as const;

export class GoogleDriveProvider implements MediaProvider {
  id = "google-drive";

  constructor(
    private readonly client: GoogleDriveUploadClient,
    private readonly allowedMimeTypes: readonly string[] = DEFAULT_ALLOWED
  ) {}

  validate(file: File): MediaValidationResult {
    if (!this.allowedMimeTypes.includes(file.type)) {
      return { ok: false, reason: `Unsupported MIME type: ${file.type || "unknown"}` };
    }
    return { ok: true, normalizedFileName: file.name.trim() || "resource" };
  }

  async upload(input: MediaUploadInput): Promise<MediaAsset> {
    const validation = this.validate(input.file);
    if (!validation.ok) {
      throw new Error(validation.reason ?? "File validation failed");
    }
    const result = await this.client.upload(input.file, {
      signal: input.signal,
      onProgress: input.onProgress,
    });
    return {
      id: result.id,
      provider: this.id,
      type: resolveAssetType(input.file.type),
      url: result.url,
      previewUrl: toGoogleDrivePreviewUrl(result.url),
      mimeType: result.mimeType ?? input.file.type,
      sizeBytes: result.sizeBytes ?? input.file.size,
    };
  }

  async delete(assetId: string): Promise<void> {
    await this.client.delete(assetId);
  }

  getPreview(url: string): string {
    return toGoogleDrivePreviewUrl(url);
  }
}

function resolveAssetType(mimeType: string): MediaAsset["type"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}
