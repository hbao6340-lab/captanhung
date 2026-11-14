import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PREFIXES = ["/dashboard", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin HTML routes. API routes self-authenticate.
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get("cap_access_token")?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin-login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
