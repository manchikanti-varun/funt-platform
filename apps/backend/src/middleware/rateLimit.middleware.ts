/**
 * Rate limiting for production security.
 * Auth endpoints get stricter limits to mitigate brute-force and abuse.
 */

import rateLimit from "express-rate-limit";
import { getEnv } from "../config/env.js";

function getWindowMs(): number {
  const { isProduction } = getEnv();
  return isProduction ? 15 * 60 * 1000 : 60 * 60 * 1000; // 15 min prod, 1 hr dev
}

/** Stricter limit for login, signup, password reset, OAuth. Per IP. */
export const authRateLimiter = rateLimit({
  windowMs: getWindowMs(),
  max: getEnv().isProduction ? 20 : 100,
  message: { success: false, message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API limit. Applied after auth routes so auth has its own window. */
export const apiRateLimiter = rateLimit({
  windowMs: getWindowMs(),
  max: getEnv().isProduction ? 300 : 2000,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
