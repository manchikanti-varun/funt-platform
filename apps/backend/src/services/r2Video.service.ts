/**
 * R2 video storage service.
 *
 * Architecture: direct browser-to-R2 uploads via presigned PUT URLs.
 * Railway never touches the video bytes — it only issues credentials and
 * confirms the upload afterward.
 *
 * Upload flow:
 *   1. Admin calls POST /api/admin/videos/presign
 *      → backend builds the object key, generates a presigned PUT URL (15 min)
 *      → returns { uploadUrl, videoKey }
 *   2. Admin browser PUTs the file directly to R2 (XHR with progress events)
 *      → 0 Railway bandwidth/memory used
 *   3. Admin calls POST /api/admin/videos/confirm  { videoKey }
 *      → backend HeadObjects the key to verify the upload landed
 *      → returns { videoKey } for the frontend to save into the chapter
 *
 * Playback flow (unchanged from previous implementation):
 *   Student requests chapter → backend issues a presigned GET URL (5 min)
 *   → 302 redirect → browser streams MP4 directly from R2
 *
 * All video objects are stored under:
 *   courses/{courseId}/{moduleId}/{lessonId}.mp4
 *
 * The DB stores "r2://{key}" in the videoUrl field.
 * isR2VideoKey() / r2KeyFromVideoUrl() / videoUrlFromR2Key() are the
 * boundary helpers — nothing else in the codebase should construct keys.
 */

import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket } from "../config/r2.js";
import { AppError } from "../utils/AppError.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Prefix stored in the DB videoUrl field to identify R2-hosted videos. */
export const R2_VIDEO_PREFIX = "r2://";

/** Presigned PUT URL validity window in seconds (15 minutes). */
const PRESIGNED_PUT_TTL_SECONDS = 15 * 60;

/** Presigned GET URL validity window in seconds (5 minutes). */
const PRESIGNED_GET_TTL_SECONDS = 5 * 60;

/** Allowed MIME types for uploads — enforced in the presign step. */
export const ALLOWED_VIDEO_MIME_TYPES = new Set(["video/mp4"]);

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Build the canonical R2 object key for a video.
 * Example: courses/abc123/module456/lesson789.mp4
 */
export function buildVideoKey(courseId: string, moduleId: string, lessonId: string): string {
  return `courses/${courseId}/${moduleId}/${lessonId}.mp4`;
}

/**
 * Returns true when a stored videoUrl value refers to an R2 object.
 * Example: "r2://courses/abc123/module456/lesson789.mp4" → true
 */
export function isR2VideoKey(videoUrl: string | undefined | null): boolean {
  return typeof videoUrl === "string" && videoUrl.startsWith(R2_VIDEO_PREFIX);
}

/**
 * Strip the "r2://" prefix to get the raw object key.
 * Throws if the value is not an R2 key.
 */
export function r2KeyFromVideoUrl(videoUrl: string): string {
  if (!isR2VideoKey(videoUrl)) {
    throw new AppError("Not an R2 video key", 400);
  }
  return videoUrl.slice(R2_VIDEO_PREFIX.length);
}

/** Wrap a raw object key with the "r2://" prefix for DB storage. */
export function videoUrlFromR2Key(key: string): string {
  return `${R2_VIDEO_PREFIX}${key}`;
}

// ---------------------------------------------------------------------------
// Presigned PUT — direct browser-to-R2 upload
// ---------------------------------------------------------------------------

/**
 * Generate a presigned PUT URL so the browser can upload an MP4 file
 * directly to R2 without routing bytes through Railway.
 *
 * The presigned URL encodes:
 *   - the exact object key
 *   - ContentType: video/mp4  (the browser must send this header)
 *   - expiry: PRESIGNED_PUT_TTL_SECONDS
 *
 * @returns { uploadUrl, videoKey }
 *   uploadUrl — the presigned PUT URL the browser should PUT to
 *   videoKey  — "r2://..." value to store in the DB after confirmation
 */
export async function generatePresignedUploadUrl(
  courseId: string,
  moduleId: string,
  lessonId: string
): Promise<{ uploadUrl: string; videoKey: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const key = buildVideoKey(courseId, moduleId, lessonId);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: "video/mp4",
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_PUT_TTL_SECONDS,
  });

  console.log(`[r2] Presigned PUT issued: ${key} (expires in ${PRESIGNED_PUT_TTL_SECONDS}s)`);

  return {
    uploadUrl,
    videoKey: videoUrlFromR2Key(key),
  };
}

// ---------------------------------------------------------------------------
// Confirm — verify the object actually landed in R2
// ---------------------------------------------------------------------------

/**
 * Verify that a previously presigned upload was completed.
 *
 * Uses HeadObject — a lightweight metadata-only request that returns 404
 * if the object does not exist and 200 with size/ETag if it does.
 *
 * @param key - Raw object key (without "r2://" prefix)
 * @returns   Object metadata { size, contentType }
 * @throws    AppError 404 if the object is not in R2 yet
 */
export async function confirmVideoUpload(
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
    // AWS SDK throws a shaped error when the object is not found
    const code = (err as { name?: string; $metadata?: { httpStatusCode?: number } }).name;
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (code === "NotFound" || status === 404) {
      throw new AppError(
        "Upload not found in R2. The presigned URL may have expired, or the upload did not complete.",
        404
      );
    }
    throw err;
  }

  const size = head.ContentLength ?? 0;
  const contentType = head.ContentType ?? "video/mp4";

  if (size === 0) {
    throw new AppError("Upload appears to be empty (0 bytes). Please re-upload the file.", 400);
  }

  console.log(`[r2] Confirmed upload: ${key} (${size} bytes, ${contentType})`);
  return { size, contentType };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a video object from R2 by its raw object key.
 * Does not throw if the object does not exist (idempotent).
 */
export async function deleteVideoFromR2(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`[r2] Deleted video: ${key}`);
}

// ---------------------------------------------------------------------------
// Presigned GET — student video playback
// ---------------------------------------------------------------------------

/**
 * Generate a short-lived presigned GET URL for student video playback.
 *
 * The URL is valid for PRESIGNED_GET_TTL_SECONDS (5 minutes).
 * Students are redirected here by getStudentMediaPlaybackRedirect after
 * enrollment and auth checks pass.
 *
 * @param key - Raw object key (without "r2://" prefix)
 * @returns   Presigned HTTPS URL for streaming
 */
export async function generateSignedVideoUrl(key: string): Promise<string> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_GET_TTL_SECONDS,
  });

  return url;
}
