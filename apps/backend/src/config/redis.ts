import { Redis } from "ioredis";

let redisClient: Redis | null = null;
let redisReady = false;

/**
 * Returns a shared Redis client if REDIS_URL is configured.
 * Supports Upstash (rediss:// TLS URLs) and standard Redis.
 * Falls back to null when Redis is unavailable — callers handle gracefully.
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisReady ? redisClient : null;

  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
      // Upstash uses TLS — ioredis handles rediss:// automatically
      tls: url.startsWith("rediss://") ? {} : undefined,
      retryStrategy(times: number) {
        return Math.min(times * 500, 30_000);
      },
    });

    redisClient.on("ready", () => {
      redisReady = true;
      console.log("[redis] Connected — caching and rate limiting active.");
    });

    redisClient.on("error", (err: Error) => {
      if (redisReady) {
        console.warn("[redis] Connection error:", err.message);
      }
      redisReady = false;
    });

    redisClient.on("close", () => {
      redisReady = false;
    });
  } catch (err) {
    console.warn("[redis] Failed to create client:", err instanceof Error ? err.message : String(err));
    redisClient = null;
  }

  return redisReady ? redisClient : null;
}
