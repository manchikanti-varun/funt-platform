export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  const v = String(value ?? "").trim();
  if (!v) return fallback;
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//")) return fallback;
  if (v.includes("://")) return fallback;
  if (v.includes("\\") || v.includes("\r") || v.includes("\n")) return fallback;
  return v;
}
