/**
 * Cloudflare R2 client configuration.
 *
 * R2 is S3-compatible, so we use @aws-sdk/client-s3 pointed at the R2 endpoint.
 * The client is a lazy singleton — it is only created when first requested, so
 * servers that don't have R2 env vars set will not crash on startup (R2 upload
 * endpoints will return a 500 with a clear error message instead).
 *
 * ── R2 CORS setup (required for direct browser uploads) ──────────────────────
 * Because the browser PUTs directly to R2 (cross-origin), your R2 bucket must
 * have a CORS policy that allows PUT from your admin origin.
 *
 * In the Cloudflare dashboard → R2 → your bucket → Settings → CORS Policy:
 *
 *   [
 *     {
 *       "AllowedOrigins": ["https://admin.funt.in"],
 *       "AllowedMethods": ["PUT"],
 *       "AllowedHeaders": ["Content-Type"],
 *       "MaxAgeSeconds": 3600
 *     }
 *   ]
 *
 * For local development, add "http://localhost:3000" to AllowedOrigins.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { S3Client } from "@aws-sdk/client-s3";

let r2Client: S3Client | null = null;

/** Returns the shared R2 S3Client, creating it on first call. */
export function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "[r2] R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must all be set"
    );
  }

  // R2 endpoint: prefer explicit R2_ENDPOINT, otherwise derive from account id.
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    `https://${accountId}.r2.cloudflarestorage.com`;

  r2Client = new S3Client({
    region: "auto", // Cloudflare R2 always uses "auto"
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log("[r2] S3-compatible R2 client initialised");
  return r2Client;
}

/** The R2 bucket name — required at runtime for every operation. */
export function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET?.trim();
  if (!bucket) throw new Error("[r2] R2_BUCKET must be set");
  return bucket;
}
