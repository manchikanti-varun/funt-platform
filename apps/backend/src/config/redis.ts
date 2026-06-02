import { Redis } from "ioredis";

let redisClient: Redis | null = null;
let redisReady = false;

/**
 * Returns a shared Redis client if REDIS_URL is configured.
 * Falls back to null (in-memory rate limiting) when Redis is unavailable.
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
      retryStrategy(times: number) {
        return Math.min(times * 500, 30_000);
      },
    });

    redisClient.on("ready", () => {
      redisReady = true;
      console.log("[redis] Connected — rate limiting uses shared store.");
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
