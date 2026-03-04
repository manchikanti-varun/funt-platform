
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("funt_admin_token");
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("funt_admin_token", token);
  document.cookie = "funt_admin_auth=1; path=/; max-age=604800";
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("funt_admin_token");
  document.cookie = "funt_admin_auth=; path=/; max-age=0";
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; success: boolean; message?: string }> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (err) {
    return { success: false, message: "Network error. Check that the API URL is correct and CORS allows this origin." };
  }
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    const msg = (json as { message?: string }).message ?? (res.status === 0 ? "Connection refused or blocked (check CORS and API URL)." : `Request failed (${res.status})`);
    return { success: false, message: msg };
  }
  return { success: true, data: json.data ?? json, message: json.message };
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
