/**
 * Franchise Upload Service — presigned URL generation for franchise file uploads.
 *
 * Used for: payment proof screenshots/receipts when requesting license keys.
 * Storage: Cloudflare R2 under `franchise/{franchiseId}/proofs/{timestamp}-{filename}`
 */

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket } from "../config/r2.js";
import { AppError } from "../utils/AppError.js";

const PRESIGNED_PUT_TTL_SECONDS = 15 * 60; // 15 minutes

const ALLOWED_PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/**
 * Build the R2 object key for a franchise payment proof.
 */
function buildProofKey(franchiseId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const ts = Date.now();
  return `franchise/${franchiseId}/proofs/${ts}-${sanitized}`;
}

/**
 * Generate a presigned PUT URL for the franchise admin to upload payment proof directly to R2.
 */
export async function getPaymentProofPresignedUpload(input: {
  franchiseId: string;
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
  const { franchiseId, filename, contentType } = input;

  if (!filename?.trim()) throw new AppError("filename is required", 400);
  if (!contentType?.trim()) throw new AppError("contentType is required", 400);

  if (!ALLOWED_PROOF_MIME_TYPES.has(contentType)) {
    throw new AppError(
      `Invalid file type. Allowed: ${[...ALLOWED_PROOF_MIME_TYPES].join(", ")}`,
      400
    );
  }

  const client = getR2Client();
  if (!client) {
    throw new AppError("File storage is not configured. Contact admin.", 503);
  }

  const bucket = getR2Bucket();
  const objectKey = buildProofKey(franchiseId, filename);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_PUT_TTL_SECONDS,
  });

  // Public URL (Cloudflare R2 public access or custom domain)
  const r2PublicDomain = process.env.R2_PUBLIC_DOMAIN?.trim();
  const publicUrl = r2PublicDomain
    ? `${r2PublicDomain.replace(/\/$/, "")}/${objectKey}`
    : `r2://${objectKey}`;

  return { uploadUrl, objectKey, publicUrl };
}
