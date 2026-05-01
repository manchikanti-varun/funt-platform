import helmet from "helmet";
import { getEnv } from "../config/env.js";

export function helmetMiddleware() {
  const { isProduction } = getEnv();
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hidePoweredBy: true,
    hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true, preload: false } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "sameorigin" },
    noSniff: true,
    xssFilter: true,
  });
}
