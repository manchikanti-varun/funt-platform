import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/login", "/admin-signup"];
const AUTH_COOKIE = "funt_admin_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuth = request.cookies.get(AUTH_COOKIE)?.value === "1";

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
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

export const config = { matcher: ["/((?!_next|api|favicon.ico).*)"] };
