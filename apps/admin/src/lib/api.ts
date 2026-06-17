
function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production for admin app.");
  }
  return "http://localhost:38472";
}

const API_URL = resolveApiUrl();
const REQUEST_TIMEOUT_MS = 15000;

const LEGACY_TOKEN_KEY = "funt_admin_token";
const CSRF_COOKIE_NAME = "funt_csrf";

/**
 * In-memory CSRF token storage.
 * Cross-origin cookies (api.funt.in → admin.funt.in) can't be read via document.cookie
 * in modern browsers with third-party cookie restrictions. So we fetch the token
 * from the /api/csrf-token endpoint and store it in memory.
 */
let _csrfToken: string | null = null;

/**
 * Reads the CSRF token — first from in-memory store, then falls back to cookie.
 */
function getCsrfToken(): string | null {
  if (_csrfToken) return _csrfToken;
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Fetches the CSRF token from the backend and stores it in memory.
 * Call once on app boot. The backend returns the token in the response body
 * so we don't need to read cross-origin cookies.
 */
export async function ensureCsrfToken(): Promise<void> {
  if (_csrfToken) return;
  // Try cookie first (works in same-origin / non-restricted browsers)
  const fromCookie = getCsrfToken();
  if (fromCookie) { _csrfToken = fromCookie; return; }
  try {
    const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      if (json.csrfToken) _csrfToken = json.csrfToken;
    }
  } catch {
    // Non-critical — the next mutation will fail with a clear CSRF error
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function clearLegacyJwtStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

function setAuthHintCookie(): void {
  if (typeof window === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `funt_admin_auth=1; path=/; max-age=604800; SameSite=Lax${secure}`;
}

function clearAuthHintCookie(): void {
  if (typeof window === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `funt_admin_auth=; path=/; max-age=0; SameSite=Lax${secure}`;
}

export function markClientLoggedIn(): void {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  setAuthHintCookie();
}

export async function establishSessionFromToken(token: string): Promise<{ roles: string[] } | null> {
  const result = await establishSessionFromTokenDetailed(token);
  return result.session;
}

export async function establishSessionFromTokenDetailed(
  token: string
): Promise<{ session: { roles: string[] } | null; error?: string }> {
  const res = await fetch(`${API_URL}/api/auth/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim(), portal: "admin" }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { user?: { roles: string[] } }; message?: string };
  if (!res.ok) {
    return { session: null, error: json.message ?? `Session setup failed (${res.status})` };
  }
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  const roles = json.data?.user?.roles;
  if (!roles) return { session: null, error: "Session response missing user roles" };
  return { session: { roles } };
}

export async function migrateLegacyTokenIfPresent(): Promise<void> {
  const legacy = getToken()?.trim();
  if (!legacy) return;
  const session = await establishSessionFromToken(legacy);
  if (!session) localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function setToken(_token: string): void {
  markClientLoggedIn();
}

export function clearToken(options?: { revokeServer?: boolean }): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  clearAuthHintCookie();
  const revokeServer = options?.revokeServer ?? true;
  if (revokeServer) {
    void fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  }
}

function authRedirectError(message: string | undefined): string {
  const normalized = (message ?? "").trim();
  const raw = normalized.toLowerCase();
  if (raw.includes("session revoked")) {
    return "You were signed out because your account was used to sign in on another device.";
  }
  if (raw.includes("session expired after password change")) {
    return "You were signed out because your password was changed. Please sign in again.";
  }
  if (normalized) return normalized;
  return "Your session expired. Please sign in again.";
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; success: boolean; message?: string }> {
  const legacy = getToken()?.trim();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (legacy) (headers as Record<string, string>)["Authorization"] = `Bearer ${legacy}`;

  // Attach CSRF token for state-changing requests
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfToken = getCsrfToken();
    if (csrfToken) (headers as Record<string, string>)["X-CSRF-Token"] = csrfToken;
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const externalSignal = options.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      res = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers, signal: controller.signal });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { success: false, message: "Request timed out. Please retry." };
    }
    return { success: false, message: "Network error. Check that the API URL is correct and CORS allows this origin." };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const serverMessage = typeof json.message === "string" ? json.message : undefined;
    if (res.status === 401) {
      // Important: don't call server logout on passive 401.
      // Otherwise we can revoke the freshly-created session in another tab/device.
      clearToken({ revokeServer: false });
      if (typeof window !== "undefined") {
        const message = authRedirectError(serverMessage);
        window.location.href = `/login?error=${encodeURIComponent(message)}`;
      }
    }
    const msg =
      serverMessage ??
      (res.status === 0 ? "Connection refused or blocked (check CORS and API URL)." : `Request failed (${res.status})`);
    return { success: false, message: msg };
  }

  // Prefer nested `data`; avoid `??` with nullish `data: null` accidentally falling through to the whole envelope.
  let data: T | undefined;
  if ("data" in json && json.data !== undefined && json.data !== null) {
    data = json.data as T;
  } else {
    const { success: _s, message: _m, ...rest } = json;
    if (Object.keys(rest).length > 0) {
      data = rest as T;
    }
  }

  return {
    success: true,
    data,
    message: typeof json.message === "string" ? json.message : undefined,
  };
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
