/**
 * Session Code: Short-lived, single-use opaque codes for OAuth redirect flows.
 *
 * Instead of embedding raw JWTs in redirect URLs (which leak in browser history,
 * Referer headers, and proxy logs), we store the JWT server-side keyed by a
 * short random code. The frontend exchanges the code for a session cookie via
 * the /api/auth/session endpoint.
 *
 * Codes expire after 60 seconds and are burned after first use.
 */

import crypto from "node:crypto";
import { cacheGet, cacheSet, cacheDel } from "./cache.js";

const CODE_PREFIX = "sess_code:";
const CODE_TTL_SECONDS = 60; // 1 minute — plenty of time for the redirect round-trip
const CODE_LENGTH = 32; // 32 bytes → 64 hex chars

/**
 * Generates a single-use session code and stores the associated JWT.
 * Returns the opaque code (safe to embed in URLs).
 */
export async function createSessionCode(jwt: string): Promise<string> {
  const code = crypto.randomBytes(CODE_LENGTH).toString("hex");
  const key = `${CODE_PREFIX}${code}`;
  await cacheSet(key, jwt, CODE_TTL_SECONDS);
  return code;
}

/**
 * Exchanges a session code for the stored JWT.
 * Deletes the code after retrieval (single-use).
 * Returns null if the code is invalid, expired, or already consumed.
 */
export async function redeemSessionCode(code: string): Promise<string | null> {
  const sanitized = code.trim();
  if (!sanitized || sanitized.length !== CODE_LENGTH * 2) return null;
  const key = `${CODE_PREFIX}${sanitized}`;
  const jwt = await cacheGet<string>(key);
  if (!jwt) return null;
  // Burn after reading — single use
  await cacheDel(key);
  return jwt;
}
