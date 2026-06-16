import helmet from "helmet";
import { getEnv } from "../config/env.js";

export function helmetMiddleware() {
  const { isProduction, corsOrigins } = getEnv();

  // Build CSP directives
  // Allow self, and configured CORS origins for connect-src (API calls from frontend)
  const connectSrc = ["'self'", ...corsOrigins];
  // Allow inline styles for editor components, self for everything else
  const styleSrc = ["'self'", "'unsafe-inline'"];
  // Allow self scripts only
  const scriptSrc = ["'self'"];
  // Allow images from self, data URIs (QR codes), and R2/CDN
  const imgSrc = ["'self'", "data:", "blob:", "https:"];
  // Allow media from self and R2 presigned URLs
  const mediaSrc = ["'self'", "blob:", "https:"];
  // Allow fonts from self
  const fontSrc = ["'self'"];
  // Allow frames for YouTube embeds and Google Drive
  const frameSrc = ["'self'", "https://www.youtube.com", "https://youtube.com", "https://drive.google.com"];

  return helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc,
            styleSrc,
            imgSrc,
            mediaSrc,
            fontSrc,
            connectSrc,
            frameSrc,
            frameAncestors: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : false, // Disable CSP in development for easier debugging
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hidePoweredBy: true,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "sameorigin" },
    noSniff: true,
    // xssFilter removed — deprecated and ineffective in modern browsers.
    // CSP provides real XSS protection.
  });
}
