const required = ["MONGO_URI", "JWT_SECRET"] as const;
const optional = { PORT: "38472" } as const;

const PLACEHOLDER_SECRETS = new Set([
  "your-secure-jwt-secret-min-32-chars",
  "changeme",
  "secret",
  "jwt_secret",
]);

export function validateEnv(): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("[config] Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const jwtSecret = process.env.JWT_SECRET!.trim();
  if (nodeEnv === "production") {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (!raw || !raw.split(",").some((o) => o.trim())) {
      console.error("[config] In production, CORS_ORIGINS must be set (comma-separated origins, e.g. https://app.example.com,https://admin.example.com).");
      process.exit(1);
    }
    if (jwtSecret.length < 32) {
      console.error("[config] In production, JWT_SECRET must be at least 32 characters.");
      process.exit(1);
    }
    const lower = jwtSecret.toLowerCase();
    if (PLACEHOLDER_SECRETS.has(lower)) {
      console.error("[config] In production, JWT_SECRET must not use a placeholder value from .env.example.");
      process.exit(1);
    }
    if (process.env.CORS_ALLOW_LOCALHOST === "1") {
      console.warn("[config] CORS_ALLOW_LOCALHOST=1: localhost origins are allowed on this production server. Disable after local testing.");
    }
    validateProductionUrls();
  }
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

const LOCAL_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
];

function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  const configured = raw ? raw.split(",").map((o) => o.trim()).filter(Boolean) : [];

  if (!isProduction) {
    if (configured.length === 0) return LOCAL_CORS_ORIGINS;
    return [...new Set([...configured, ...LOCAL_CORS_ORIGINS])];
  }

  if (process.env.CORS_ALLOW_LOCALHOST === "1") {
    return [...new Set([...configured, ...LOCAL_CORS_ORIGINS])];
  }
  return configured;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function isLocalHostName(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function parseHttpUrl(name: string, raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    console.error(`[config] ${name} must be a valid absolute URL. Received: ${raw}`);
    process.exit(1);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    console.error(`[config] ${name} must use http:// or https://. Received: ${raw}`);
    process.exit(1);
  }
  return u;
}

export function getEnv() {
  const corsOrigins = getCorsOrigins();
  const jwtExpiresInAdmin = process.env.JWT_EXPIRES_IN_ADMIN ?? "8h";
  const jwtExpiresInLms = process.env.JWT_EXPIRES_IN_LMS ?? "12h";
  const frontendAdminUrlDefault = isProduction ? "https://admin.funt.in" : "http://localhost:3000";
  const frontendLmsUrlDefault = isProduction ? "https://learn.funt.in" : "http://localhost:3001";
  return {
    port: Number(process.env.PORT ?? optional.PORT),
    mongoUri: process.env.MONGO_URI!,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    jwtExpiresInAdmin,
    jwtExpiresInLms,
    idleTimeoutMinutesAdmin: parsePositiveInt(process.env.IDLE_TIMEOUT_MINUTES_ADMIN, 180),
    idleTimeoutMinutesLms: parsePositiveInt(process.env.IDLE_TIMEOUT_MINUTES_LMS, 45),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    backendPublicUrl: process.env.BACKEND_PUBLIC_URL ?? "",
    frontendAdminUrl: process.env.FRONTEND_ADMIN_URL ?? frontendAdminUrlDefault,
    frontendLmsUrl: process.env.FRONTEND_LMS_URL ?? frontendLmsUrlDefault,
    nodeEnv,
    isProduction,
    corsOrigins,
  };
}

function validateProductionUrls(): void {
  const allowLocalhost = process.env.CORS_ALLOW_LOCALHOST === "1";
  const values: Array<{ name: string; value?: string }> = [
    { name: "BACKEND_PUBLIC_URL", value: process.env.BACKEND_PUBLIC_URL },
    { name: "FRONTEND_ADMIN_URL", value: process.env.FRONTEND_ADMIN_URL },
    { name: "FRONTEND_LMS_URL", value: process.env.FRONTEND_LMS_URL },
  ];
  for (const item of values) {
    const raw = item.value?.trim();
    if (!raw) {
      console.error(`[config] In production, ${item.name} must be set.`);
      process.exit(1);
    }
    const u = parseHttpUrl(item.name, raw);
    if (!allowLocalhost && u.protocol !== "https:") {
      console.error(`[config] In production, ${item.name} must use https:// (or set CORS_ALLOW_LOCALHOST=1 only for local testing).`);
      process.exit(1);
    }
    if (!allowLocalhost && isLocalHostName(u.hostname)) {
      console.error(`[config] In production, ${item.name} must not point to localhost.`);
      process.exit(1);
    }
  }
}

