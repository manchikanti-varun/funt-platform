export type MediaAssetType = "image" | "video" | "file" | "pdf" | "audio" | "embed";

export interface MediaAsset {
  id: string;
  type: MediaAssetType;
  provider: string;
  url: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MediaValidationResult {
  ok: boolean;
  reason?: string;
  normalizedFileName?: string;
}

export interface MediaUploadInput {
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface MediaProvider {
  id: string;
  upload(input: MediaUploadInput): Promise<MediaAsset>;
  delete(assetId: string): Promise<void>;
  getPreview(url: string): string;
  validate(file: File): MediaValidationResult;
}

export interface MediaProviderRegistry {
  register(provider: MediaProvider): void;
  get(id: string): MediaProvider;
}

export class DefaultMediaProviderRegistry implements MediaProviderRegistry {
  private providers = new Map<string, MediaProvider>();

  register(provider: MediaProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): MediaProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Unknown media provider: ${id}`);
    }
    return provider;
  }
}
