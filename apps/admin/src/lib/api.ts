
function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production for admin app.");
  }
  return "http://localhost:38472";
}

const API_URL = resolveApiUrl();

const LEGACY_TOKEN_KEY = "funt_admin_token";

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
  setAuthHintCookie();
}

export async function establishSessionFromToken(token: string): Promise<{ roles: string[] } | null> {
  const res = await fetch(`${API_URL}/api/auth/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim(), portal: "admin" }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { user?: { roles: string[] } } };
  if (!res.ok) return null;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  const roles = json.data?.user?.roles;
  return roles ? { roles } : null;
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

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  clearAuthHintCookie();
  void fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

function authRedirectError(message: string | undefined): string {
  const raw = (message ?? "").trim().toLowerCase();
  if (raw.includes("session revoked")) {
    return "You were signed out because your account was used to sign in on another device.";
  }
  if (raw.includes("session expired after password change")) {
    return "You were signed out because your password was changed. Please sign in again.";
  }
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

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers });
  } catch (err) {
    return { success: false, message: "Network error. Check that the API URL is correct and CORS allows this origin." };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const serverMessage = typeof json.message === "string" ? json.message : undefined;
    if (res.status === 401) {
      clearToken();
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
