/**
 * R2 file controller — direct browser-to-R2 upload for chapter attachments.
 */

import type { Request, Response } from "express";
import {
  generatePresignedFileUploadUrl,
  confirmFileUpload,
  deleteFileFromR2,
  generateSignedFileDownloadUrl,
  r2KeyFromFileUrl,
  ALLOWED_FILE_MIME_TYPES,
} from "../services/r2File.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

function assertSafeSegment(value: string, name: string): void {
  if (!value) throw new AppError(`${name} is required`, 400);
  if (!SAFE_SEGMENT.test(value)) {
    throw new AppError(`${name} contains invalid characters`, 400);
  }
}

// POST /api/admin/files/presign
export const presignFileUpload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const courseId = String(req.body?.courseId ?? "").trim();
  const moduleId = String(req.body?.moduleId ?? "").trim();
  const filename = String(req.body?.filename ?? "").trim();
  const mimeType = String(req.body?.mimeType ?? "application/octet-stream").trim();

  assertSafeSegment(courseId, "courseId");
  assertSafeSegment(moduleId, "moduleId");
  if (!filename) throw new AppError("filename is required", 400);

  if (!ALLOWED_FILE_MIME_TYPES.has(mimeType)) {
    throw new AppError(
      `Unsupported file type "${mimeType}". Allowed: PDF, ZIP, DOCX, XLSX, PPTX, images, CSV, TXT.`,
      400
    );
  }

  const { uploadUrl, fileKey } = await generatePresignedFileUploadUrl(courseId, moduleId, filename, mimeType);
  successRes(res, { uploadUrl, fileKey, expiresInSeconds: 15 * 60 }, "Presigned upload URL issued", 201);
});

// POST /api/admin/files/confirm
export const confirmFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { fileKey } = req.body ?? {};
  if (!fileKey || typeof fileKey !== "string") throw new AppError("fileKey is required", 400);
  if (!fileKey.startsWith("r2file://")) throw new AppError("fileKey must start with 'r2file://'", 400);

  const key = r2KeyFromFileUrl(fileKey);
  const { size, contentType } = await confirmFileUpload(key);
  successRes(res, { fileKey, size, contentType }, "Upload confirmed");
});

// DELETE /api/admin/files
export const deleteFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { fileKey } = req.body ?? {};
  if (!fileKey || typeof fileKey !== "string") throw new AppError("fileKey is required", 400);
  if (!fileKey.startsWith("r2file://")) throw new AppError("fileKey must start with 'r2file://'", 400);

  const key = r2KeyFromFileUrl(fileKey);
  await deleteFileFromR2(key);
  successRes(res, { deleted: true }, "File deleted");
});

// GET /api/student/files/download?key=r2file://...&name=filename.pdf
export const downloadFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawKey = typeof req.query.key === "string" ? req.query.key.trim() : "";
  const filename = typeof req.query.name === "string" ? req.query.name.trim() : undefined;
  if (!rawKey) throw new AppError("key query param is required", 400);
  if (!rawKey.startsWith("r2file://")) throw new AppError("key must start with 'r2file://'", 400);

  const key = r2KeyFromFileUrl(rawKey);
  const downloadUrl = await generateSignedFileDownloadUrl(key, filename);
  res.redirect(302, downloadUrl);
});
