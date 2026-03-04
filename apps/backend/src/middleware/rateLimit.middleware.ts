

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
