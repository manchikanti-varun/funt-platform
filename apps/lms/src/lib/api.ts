
function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production for LMS app.");
  }
  return "http://localhost:38472";
}

export const API_URL = resolveApiUrl();

/**
 * Course payloads use root-relative media URLs (`/api/student/media/play?...`) for `api()`.
 * `<iframe src>` and `<video src>` resolve against the Next.js origin unless prefixed with the API base.
 */
export function resolveMediaPlaybackUrl(pathOrAbsolute: string | undefined): string {
  if (!pathOrAbsolute) return "";
  const t = pathOrAbsolute.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = API_URL.replace(/\/$/, "");
  return `${base}${t.startsWith("/") ? t : `/${t}`}`;
}

/** Legacy localStorage key — migrated to httpOnly cookie via /api/auth/session when present. */
const LEGACY_TOKEN_KEY = "funt_lms_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LEGACY_TOKEN_KEY);
}

/** Drop any legacy JWT in localStorage (e.g. after password change issues a new httpOnly cookie). */
export function clearLegacyJwtStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

function setAuthHintCookie(): void {
  if (typeof window === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `funt_lms_auth=1; path=/; max-age=604800; SameSite=Lax${secure}`;
}

function clearAuthHintCookie(): void {
  if (typeof window === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `funt_lms_auth=; path=/; max-age=0; SameSite=Lax${secure}`;
}

/** Call after successful login/signup responses that set the httpOnly cookie (same-origin fetch with credentials). */
export function markClientLoggedIn(): void {
  setAuthHintCookie();
}

/** OAuth redirect / legacy: exchange a JWT for an httpOnly session cookie. */
export async function establishSessionFromToken(token: string): Promise<{ roles: string[] } | null> {
  const res = await fetch(`${API_URL}/api/auth/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim(), portal: "lms" }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { user?: { roles: string[] } } };
  if (!res.ok) return null;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  const roles = json.data?.user?.roles;
  return roles ? { roles } : null;
}

/** One-time migration for users who still have a JWT in localStorage. */
export async function migrateLegacyTokenIfPresent(): Promise<void> {
  const legacy = getToken()?.trim();
  if (!legacy) return;
  const session = await establishSessionFromToken(legacy);
  if (!session) localStorage.removeItem(LEGACY_TOKEN_KEY);
}

/** @deprecated Prefer establishSessionFromToken + markClientLoggedIn. Kept for gradual refactors. */
export function setToken(_token: string): void {
  markClientLoggedIn();
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  clearAuthHintCookie();
  void fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; success: boolean; message?: string }> {
  const legacy = getToken()?.trim();
  const headers: HeadersInit = { "Content-Type": "application/json", ...options.headers };
  if (legacy) (headers as Record<string, string>)["Authorization"] = `Bearer ${legacy}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers });
  } catch (err) {
    return { success: false, message: "Network error. Check that the API URL is correct and CORS allows this origin." };
  }
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        window.location.href = path.startsWith("/parent") ? "/parent/profiles" : "/login";
      }
    }
    const msg = (json as { message?: string }).message ?? (res.status === 0 ? "Connection refused or blocked (check CORS and API URL)." : `Request failed (${res.status})`);
    return { success: false, message: msg };
  }
  return { success: true, data: (json as { data?: T }).data ?? (json as T), message: (json as { message?: string }).message };
}
