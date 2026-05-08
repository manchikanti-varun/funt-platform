import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_EXACT = new Set(["/login", "/admin-signup"]);
const PUBLIC_PREFIXES = ["/auth/callback"];
const AUTH_COOKIE = "funt_auth_admin";
const AUTH_HINT_COOKIE = "funt_admin_auth";

function hasValidUnexpiredJwt(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payloadRaw = atob(padded);
    const payload = JSON.parse(payloadRaw) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  // `funt_auth_admin` is an httpOnly cookie set by backend.
  // In split-domain deployments (admin + api on different subdomains),
  // middleware may not see it, so we allow pass-through when the client
  // callback has set the short auth hint cookie.
  const hasAuth = hasValidUnexpiredJwt(token) || request.cookies.get(AUTH_HINT_COOKIE)?.value === "1";

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isPublic) {
    if (hasAuth) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!hasAuth) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Skip static files (anything with an extension) so assets in /public are served directly.
  // Public auth routes are excluded from proxy matching to avoid redirect loops and false 404s.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|admin-signup|auth/callback|.*\\..*).*)"],
};
