import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "uzee_session";

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || "uzee-tech-screenguard-finder-jwt-secret-2026-production";
  return new TextEncoder().encode(secret);
}

export interface UserSession {
  id: string;
  email: string;
}

/**
 * Creates and signs an edge-compatible JWT session token.
 * Lifetime: 30 days if rememberMe is true, otherwise 12 hours.
 */
export async function createSessionToken(
  user: UserSession,
  rememberMe = false
): Promise<{ token: string; maxAge: number }> {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 12 * 60 * 60; // seconds
  const secret = getJwtSecret();

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? "30d" : "12h")
    .sign(secret);

  return { token, maxAge };
}

/**
 * Verifies a JWT session token and returns the decoded user, or null if invalid/expired.
 */
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.email) return null;

    return {
      id: String(payload.sub),
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}

/**
 * Helper to retrieve and verify the current session from Next.js cookies (server components / route handlers).
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return null;

  return verifySessionToken(sessionCookie.value);
}

/**
 * Generates cookie options for the session cookie.
 */
export function getSessionCookieOptions(maxAge: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
