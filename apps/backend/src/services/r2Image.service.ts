/**
 * R2 image storage service.
 *
 * Architecture: direct browser-to-R2 uploads via presigned PUT URLs.
 * Identical pattern to r2Video.service.ts but for images embedded in
 * rich-text editor content.
 *
 * Upload flow:
 *   1. Admin calls POST /api/admin/images/presign
 *      → backend builds the object key, generates a presigned PUT URL (15 min)
 *      → returns { uploadUrl, imageKey, publicUrl }
 *   2. Admin browser PUTs the file directly to R2 (XHR with progress events)
 *      → 0 Railway bandwidth/memory used
 *   3. Admin calls POST /api/admin/images/confirm  { imageKey }
 *      → backend HeadObjects the key to verify the upload landed
 *      → returns { imageKey, publicUrl, size }
 *
 * Storage:
 *   All image objects are stored under:
 *     images/{courseId}/{moduleId}/{timestamp}-{random}.{ext}
 *
 *   The editor stores the publicUrl (HTTPS) directly in <img src="...">,
 *   so no r2:// resolution logic is needed — images work everywhere.
 */

import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket } from "../config/r2.js";
import { AppError } from "../utils/AppError.js";
import { getEnv } from "../config/env.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Presigned PUT URL validity window in seconds (15 minutes). */
const PRESIGNED_PUT_TTL_SECONDS = 15 * 60;

/** Presigned GET URL validity window for fallback (7 days — images are long-lived). */
const PRESIGNED_GET_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Allowed MIME types for image uploads. */
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

/** Map MIME type to file extension. */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Build the canonical R2 object key for an image.
 * Example: images/abc123/module456/1720000000000-a1b2c3d4.jpg
 */
export function buildImageKey(courseId: string, moduleId: string, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType] ?? "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `images/${courseId}/${moduleId}/${timestamp}-${random}.${ext}`;
}

/**
 * Build the public URL for an image stored in R2.
 * Uses the backend serve endpoint which redirects to a presigned GET URL.
 */
export function buildImagePublicUrl(objectKey: string): string {
  const backendUrl = (getEnv().backendPublicUrl || "").replace(/\/$/, "");
  return `${backendUrl}/api/admin/images/serve/${objectKey}`;
}

// ---------------------------------------------------------------------------
// Presigned PUT — direct browser-to-R2 upload
// ---------------------------------------------------------------------------

/**
 * Generate a presigned PUT URL so the browser can upload an image file
 * directly to R2 without routing bytes through Railway.
 */
export async function generatePresignedImageUploadUrl(
  courseId: string,
  moduleId: string,
  mimeType: string
): Promise<{ uploadUrl: string; imageKey: string; publicUrl: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const key = buildImageKey(courseId, moduleId, mimeType);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_PUT_TTL_SECONDS,
  });

  const publicUrl = buildImagePublicUrl(key);

  if (!getEnv().isProduction) {
    console.log(`[r2] Image presigned PUT issued: ${key} (expires in ${PRESIGNED_PUT_TTL_SECONDS}s)`);
  }

  return { uploadUrl, imageKey: key, publicUrl };
}

// ---------------------------------------------------------------------------
// Confirm — verify the object actually landed in R2
// ---------------------------------------------------------------------------

/**
 * Verify that a previously presigned image upload was completed.
 */
export async function confirmImageUpload(
  key: string
): Promise<{ size: number; contentType: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  let head;
  try {
    head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
  } catch (err) {
    const code = (err as { name?: string; $metadata?: { httpStatusCode?: number } }).name;
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (code === "NotFound" || status === 404) {
      throw new AppError(
        "Image upload not found in R2. The presigned URL may have expired, or the upload did not complete.",
        404
      );
    }
    throw err;
  }

  const size = head.ContentLength ?? 0;
  const contentType = head.ContentType ?? "image/jpeg";

  if (size === 0) {
    throw new AppError("Upload appears to be empty (0 bytes). Please re-upload the file.", 400);
  }

  if (!getEnv().isProduction) {
    console.log(`[r2] Confirmed image upload: ${key} (${size} bytes, ${contentType})`);
  }
  return { size, contentType };
}

// ---------------------------------------------------------------------------
// Serve — generate a presigned GET URL (fallback when no public domain)
// ---------------------------------------------------------------------------

/**
 * Generate a presigned GET URL for serving an image.
 * Used as fallback when R2_PUBLIC_DOMAIN is not configured.
 */
export async function generateSignedImageUrl(key: string): Promise<string> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, {
    expiresIn: PRESIGNED_GET_TTL_SECONDS,
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete an image object from R2 by its raw object key.
 * Does not throw if the object does not exist (idempotent).
 */
export async function deleteImageFromR2(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  if (!getEnv().isProduction) {
    console.log(`[r2] Deleted image: ${key}`);
  }
}
