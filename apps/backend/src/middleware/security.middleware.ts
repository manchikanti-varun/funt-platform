/**
 * Security headers and production-safe behavior.
 * Helmet sets secure HTTP headers; we avoid leaking sensitive data in responses.
 */

import helmet from "helmet";

/** Security headers via Helmet. CSP disabled to avoid breaking OAuth redirects and iframes. */
export function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}
