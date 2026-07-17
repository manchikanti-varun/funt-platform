/**
 * R2 file storage service — downloadable chapter attachments.
 *
 * Upload flow (same pattern as video/image):
 *   1. Admin calls POST /api/admin/files/presign
 *      → backend builds the object key, generates a presigned PUT URL (15 min)
 *      → returns { uploadUrl, fileKey }
 *   2. Admin browser PUTs the file directly to R2 (XHR with progress events)
 *      → 0 Railway bandwidth/memory used
 *   3. Admin calls POST /api/admin/files/confirm  { fileKey }
 *      → backend HeadObjects the key to verify the upload landed
 *      → returns { fileKey, size, contentType }
 *
 * Download flow:
 *   Student requests file → backend issues a presigned GET URL (10 min)
 *   → 302 redirect → browser downloads directly from R2
 *
 * All file objects are stored under:
 *   files/{courseId}/{moduleId}/{timestamp}-{sanitizedFilename}
 *
 * The DB stores "r2file://{key}" in the downloadableFiles array.
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
import { getEnv } from "../config/env.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const R2_FILE_PREFIX = "r2file://";
const PRESIGNED_PUT_TTL_SECONDS = 15 * 60;
const PRESIGNED_GET_TTL_SECONDS = 10 * 60;

/** Allowed MIME types for chapter file attachments. */
export const ALLOWED_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/json",
]);

// ─── Key helpers ──────────────────────────────────────────────────────────────

function sanitizeSegment(input: string): string {
  return input.replace(/\.\./g, "").replace(/[/\\:*?"<>|]/g, "_").trim().slice(0, 100);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .trim()
    .slice(0, 120);
}

export function buildFileKey(courseId: string, moduleId: string, filename: string): string {
  const safeCourse = sanitizeSegment(courseId);
  const safeModule = sanitizeSegment(moduleId);
  const safeName = sanitizeFilename(filename);
  if (!safeCourse || !safeModule || !safeName) {
    throw new AppError("Invalid path component for file key", 400);
  }
  const timestamp = Date.now();
  return `files/${safeCourse}/${safeModule}/${timestamp}-${safeName}`;
}

export function isR2FileKey(url: string | undefined | null): boolean {
  return typeof url === "string" && url.startsWith(R2_FILE_PREFIX);
}

export function r2KeyFromFileUrl(fileUrl: string): string {
  if (!isR2FileKey(fileUrl)) throw new AppError("Not an R2 file key", 400);
  return fileUrl.slice(R2_FILE_PREFIX.length);
}

export function fileUrlFromR2Key(key: string): string {
  return `${R2_FILE_PREFIX}${key}`;
}

// ─── Presigned PUT ────────────────────────────────────────────────────────────

export async function generatePresignedFileUploadUrl(
  courseId: string,
  moduleId: string,
  filename: string,
  mimeType: string
): Promise<{ uploadUrl: string; fileKey: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const key = buildFileKey(courseId, moduleId, filename);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_PUT_TTL_SECONDS,
  });

  if (!getEnv().isProduction) {
    console.log(`[r2] File presigned PUT issued: ${key} (expires in ${PRESIGNED_PUT_TTL_SECONDS}s)`);
  }

  return { uploadUrl, fileKey: fileUrlFromR2Key(key) };
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

export async function confirmFileUpload(
  key: string
): Promise<{ size: number; contentType: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  let head;
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    const code = (err as { name?: string })?.name;
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (code === "NotFound" || status === 404) {
      throw new AppError("Upload not found in R2. The presigned URL may have expired.", 404);
    }
    throw err;
  }

  const size = head.ContentLength ?? 0;
  const contentType = head.ContentType ?? "application/octet-stream";
  if (size === 0) throw new AppError("Upload appears to be empty (0 bytes).", 400);

  if (!getEnv().isProduction) {
    console.log(`[r2] File confirmed: ${key} (${size} bytes, ${contentType})`);
  }
  return { size, contentType };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteFileFromR2(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  if (!getEnv().isProduction) {
    console.log(`[r2] Deleted file: ${key}`);
  }
}

// ─── Presigned GET (download) ─────────────────────────────────────────────────

export async function generateSignedFileDownloadUrl(key: string, filename?: string): Promise<string> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
  });

  return getSignedUrl(client, command, { expiresIn: PRESIGNED_GET_TTL_SECONDS });
}
