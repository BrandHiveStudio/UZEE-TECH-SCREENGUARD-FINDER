import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const SESSION_COOKIE_NAME = "uzee_session";

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || "uzee-tech-screenguard-finder-jwt-secret-2026-production";
  return new TextEncoder().encode(secret);
}

// Public route prefixes
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
];

// Static file extensions to skip middleware check
const STATIC_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".css",
  ".js",
  ".woff",
  ".woff2",
];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Allow Next.js internal paths and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  ) {
    return NextResponse.next();
  }

  // 2. Check for session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  let isAuthenticated = false;

  if (sessionCookie?.value) {
    try {
      const { payload } = await jwtVerify(sessionCookie.value, getJwtSecret());
      if (payload.sub && payload.email) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // 3. If authenticated user visits login or password recovery, redirect to home
  if (isAuthenticated && (pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 4. If public path, allow access
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 5. If unauthenticated on protected route
  if (!isAuthenticated) {
    // For API requests, return 401 Unauthorized
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // For page requests, redirect to /login with original destination
    const redirectUrl = new URL("/login", request.url);
    const target = pathname + search;
    if (target !== "/") {
      redirectUrl.searchParams.set("redirect", target);
    }
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
