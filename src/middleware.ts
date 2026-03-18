import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cleanPath = stripLocalePrefix(pathname);

  // Auth check for dashboard routes (locale-agnostic)
  const isDashboard =
    cleanPath.startsWith("/dashboard") || cleanPath === "/api/portal";

  if (isDashboard) {
    const sessionCookie =
      request.cookies.get("better-auth.session_token") ||
      request.cookies.get("__Secure-better-auth.session_token");
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // i18n routing for all paths (including dashboard)
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)", "/api/portal"],
};
