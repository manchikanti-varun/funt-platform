import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_EXACT = new Set([
  "/login",
  "/signup",
  "/forgot-username",
  "/parent",
  "/parent/login",
  "/parent/profiles",
]);
const PUBLIC_PREFIXES = ["/auth/callback", "/verify"];
const AUTH_COOKIE = "funt_auth_lms";
const PARENT_DELEGATE_COOKIE = "funt_parent_delegate";

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
  const delegate = request.cookies.get(PARENT_DELEGATE_COOKIE)?.value;
  const hasAuth = hasValidUnexpiredJwt(token) || hasValidUnexpiredJwt(delegate);

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isPublic) {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
