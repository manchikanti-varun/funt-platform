

import rateLimit from "express-rate-limit";
import { getEnv } from "../config/env.js";

function getWindowMs(): number {
  const { isProduction } = getEnv();
  return isProduction ? 15 * 60 * 1000 : 60 * 60 * 1000; 
}


export const authRateLimiter = rateLimit({
  windowMs: getWindowMs(),
  max: getEnv().isProduction ? 20 : 100,
  message: { success: false, message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});


export const apiRateLimiter = rateLimit({
  windowMs: getWindowMs(),
  max: getEnv().isProduction ? 300 : 2000,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Mobile → linked students lookup (pre-auth). Tight in production to reduce enumeration. */
export const parentMobileLookupRateLimiter = rateLimit({
  windowMs: getEnv().isProduction ? 60 * 60 * 1000 : 15 * 60 * 1000,
  max: getEnv().isProduction ? 25 : 200,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Issue parent delegate cookie after mobile+student check. */
export const parentDelegateIssueRateLimiter = rateLimit({
  windowMs: getEnv().isProduction ? 60 * 60 * 1000 : 15 * 60 * 1000,
  max: getEnv().isProduction ? 40 : 300,
  message: { success: false, message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
