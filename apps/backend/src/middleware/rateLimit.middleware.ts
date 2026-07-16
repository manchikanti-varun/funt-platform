import rateLimit, { type Options } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { getEnv } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";

function getWindowMs(): number {
  const { isProduction } = getEnv();
  return isProduction ? 15 * 60 * 1000 : 60 * 60 * 1000;
}

/**
 * Returns a Redis-backed store if REDIS_URL is configured and the connection is live.
 * Falls back to the default in-memory store (fine for single-instance deployments).
 */
function getStore(prefix: string): Partial<Options> {
  const client = getRedisClient();
  if (!client) return {};
  return {
    store: new RedisStore({
      // Use sendCommand for ioredis compatibility with rate-limit-redis v4
      sendCommand: (...args: string[]) => client.call(args[0], ...args.slice(1)) as never,
      prefix: `rl:${prefix}:`,
    }),
  };
}

export const authRateLimiter = rateLimit({
  windowMs: getWindowMs(),
  max: getEnv().isProduction ? 20 : 100,
  message: { success: false, message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  ...getStore("auth"),
});

export const apiRateLimiter = rateLimit({
  windowMs: getWindowMs(),
  max: getEnv().isProduction ? 300 : 2000,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  ...getStore("api"),
});

/** Mobile → linked students lookup (pre-auth). Tight in production to reduce enumeration. */
export const parentMobileLookupRateLimiter = rateLimit({
  windowMs: getEnv().isProduction ? 60 * 60 * 1000 : 15 * 60 * 1000,
  max: getEnv().isProduction ? 25 : 200,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  ...getStore("parent-lookup"),
});

/** Issue parent delegate cookie after mobile+student check. */
export const parentDelegateIssueRateLimiter = rateLimit({
  windowMs: getEnv().isProduction ? 60 * 60 * 1000 : 15 * 60 * 1000,
  max: getEnv().isProduction ? 40 : 300,
  message: { success: false, message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  ...getStore("parent-delegate"),
});


/**
 * Password change rate limiter.
 * Per-user (IP-keyed since auth cookie identifies the user).
 * Protects against brute-forcing the old password field.
 */
export const passwordChangeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getEnv().isProduction ? 5 : 50,
  message: { success: false, message: "Too many password change attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  ...getStore("password-change"),
});

/**
 * Signup rate limiter.
 * Tighter than general auth limiter to prevent junk account creation.
 */
export const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getEnv().isProduction ? 5 : 50,
  message: { success: false, message: "Too many signup attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  ...getStore("signup"),
});

/**
 * Support agent signup rate limiter.
 * Very tight — prevents spamming registration requests.
 */
export const supportSignupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getEnv().isProduction ? 3 : 30,
  message: { success: false, message: "Too many signup attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  ...getStore("support-signup"),
});
