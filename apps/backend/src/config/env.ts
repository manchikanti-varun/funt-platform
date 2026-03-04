/**
 * Environment variable validation.
 * Server fails to start if required variables are missing.
 * Production: set NODE_ENV=production and CORS_ORIGINS to restrict origins.
 */

const required = ["MONGO_URI", "JWT_SECRET"] as const;
const optional = { PORT: "38472" } as const;

export function validateEnv(): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("[config] Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production") {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (!raw || !raw.split(",").some((o) => o.trim())) {
      console.error("[config] In production, CORS_ORIGINS must be set (comma-separated origins, e.g. https://app.example.com,https://admin.example.com).");
      process.exit(1);
    }
  }
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

/** Parse CORS_ORIGINS (comma-separated). If unset, dev defaults to localhost:3000,3001; production has no default (must set). */
function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  }
  if (isProduction) {
    return [];
  }
  return ["http://localhost:3000", "http://localhost:3001"];
}

export function getEnv() {
  const corsOrigins = getCorsOrigins();
  return {
    port: Number(process.env.PORT ?? optional.PORT),
    mongoUri: process.env.MONGO_URI!,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    /** Base URL for OAuth redirect (must match exactly what you add in Google Console). */
    backendPublicUrl: process.env.BACKEND_PUBLIC_URL ?? "",
    frontendAdminUrl: process.env.FRONTEND_ADMIN_URL ?? "http://localhost:3000",
    frontendLmsUrl: process.env.FRONTEND_LMS_URL ?? "http://localhost:3001",
    nodeEnv,
    isProduction,
    corsOrigins,
  };
}
