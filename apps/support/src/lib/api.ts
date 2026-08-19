/**
 * Support App — API utility with CSRF support.
 */

function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production for support app.");
  }
  return "http://localhost:38472";
}

export const API_URL = resolveApiUrl();

const CSRF_COOKIE_NAME = "funt_csrf";

let _csrfToken: string | null = null;

function persistCsrfToken(token: string): void {
  _csrfToken = token;
  if (typeof sessionStorage !== "undefined") {
    try { sessionStorage.setItem("_csrf", token); } catch { /* */ }
  }
}

function getCsrfToken(): string | null {
  if (_csrfToken) return _csrfToken;
  if (typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem("_csrf");
    if (stored) { _csrfToken = stored; return stored; }
  }
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfToken(): Promise<void> {
  if (_csrfToken) return;
  if (typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem("_csrf");
    if (stored) { _csrfToken = stored; return; }
  }
  const fromCookie = getCsrfToken();
  if (fromCookie) { persistCsrfToken(fromCookie); return; }
  try {
    const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      if (json.csrfToken) persistCsrfToken(json.csrfToken);
    }
  } catch { /* non-critical */ }
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}

/** Convert technical server error messages into user-friendly text. */
function friendlyErrorMessage(status: number, serverMessage: string | undefined): string {
  const msg = (serverMessage ?? "").trim();
  const lower = msg.toLowerCase();

  if (lower.includes("csrf")) {
    return "Your session security token expired. Please refresh the page and try again.";
  }
  if (lower.includes("invalid origin") || lower.includes("request blocked")) {
    return "This request was blocked for security reasons. Please refresh the page and try again.";
  }
  if (status === 429) {
    return msg || "Too many requests. Please wait a moment and try again.";
  }
  if (status === 403 && msg) return msg;
  if (status >= 500) {
    return msg || "Something went wrong on our end. Please try again in a moment.";
  }
  if (status === 0) {
    return "Could not connect to the server. Please check your internet connection.";
  }
  if (msg) return msg;
  return "Something went wrong. Please try again.";
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; success: boolean; message?: string }> {
  const headers: HeadersInit = { "Content-Type": "application/json", ...options.headers };

  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfToken = getCsrfToken();
    if (csrfToken) (headers as Record<string, string>)["X-CSRF-Token"] = csrfToken;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers });
  } catch {
    return { success: false, message: "Could not connect to the server. Please check your internet connection and try again." };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const serverMessage = typeof json.message === "string" ? json.message : undefined;
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return { success: false, message: friendlyErrorMessage(res.status, serverMessage) };
  }

  let data: T | undefined;
  if ("data" in json && json.data !== undefined && json.data !== null) {
    data = json.data as T;
  } else {
    const { success: _s, message: _m, ...rest } = json;
    if (Object.keys(rest).length > 0) data = rest as T;
  }

  return {
    success: true,
    data,
    message: typeof json.message === "string" ? json.message : undefined,
  };
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  void fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
}
