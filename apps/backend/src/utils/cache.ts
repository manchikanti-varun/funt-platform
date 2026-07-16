/**
 * Redis Cache Utility
 *
 * Thin wrapper around the shared Redis client for application-level caching.
 * Gracefully falls back to no-op when Redis is unavailable (all operations
 * return null/false so callers always hit DB on cache miss).
 *
 * Designed for Upstash free tier (10k commands/day) — keep TTLs reasonable
 * and cache only high-frequency reads.
 */

import { getRedisClient } from "../config/redis.js";

const PREFIX = "funt:";

/** Get a cached value. Returns parsed JSON or null on miss/error. */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const raw = await client.get(`${PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Set a cached value with TTL in seconds. Returns true on success. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;
    await client.set(`${PREFIX}${key}`, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

/** Delete a cached key. */
export async function cacheDel(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    await client.del(`${PREFIX}${key}`);
  } catch {
    // ignore
  }
}

/** Delete multiple keys matching a pattern (use sparingly — SCAN-based). */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    const fullPattern = `${PREFIX}${pattern}`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", fullPattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // ignore
  }
}

// ─── Pre-built cache keys ────────────────────────────────────────────────────

export const CACHE_KEYS = {
  /** Cached user doc for auth middleware. TTL: 60s */
  user: (userId: string) => `user:${userId}`,
  /** Public explore courses listing. TTL: 300s */
  exploreCourses: () => "explore:courses",
  /** Public upcoming courses listing. TTL: 300s */
  upcomingCourses: () => "explore:upcoming",
  /** Student's enrolled course list. TTL: 120s */
  studentCourses: (studentId: string) => `student:courses:${studentId}`,
  /** Admin course list. TTL: 60s */
  adminCourses: () => "admin:courses",
  /** Admin batch list. TTL: 60s */
  adminBatches: () => "admin:batches",
  /** Global chapters list. TTL: 120s */
  globalChapters: () => "admin:global-chapters",
} as const;

// ─── TTL constants (seconds) ─────────────────────────────────────────────────

export const CACHE_TTL = {
  /** Auth user lookup — very short to minimize stale security state */
  USER: 30,
  /** Public course catalog — changes rarely */
  EXPLORE: 300,
  /** Student-specific data — moderate */
  STUDENT: 120,
  /** Admin list data — short */
  ADMIN_LIST: 60,
} as const;
