import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { turso } from "@/lib/turso";
import { createSessionToken, getSessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, rememberMe } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user by email
    const userRes = await turso.execute({
      sql: "SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1",
      args: [normalizedEmail],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const userRow = userRes.rows[0];
    const passwordHash = String(userRow.password_hash);

    // Verify password with bcrypt
    const passwordValid = await bcrypt.compare(password, passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const userSession = {
      id: String(userRow.id),
      email: String(userRow.email),
    };

    const { token, maxAge } = await createSessionToken(userSession, Boolean(rememberMe));

    const response = NextResponse.json({
      success: true,
      user: userSession,
    });

    // Set httpOnly cookie
    const cookieOptions = getSessionCookieOptions(maxAge);
    response.cookies.set(cookieOptions.name, token, cookieOptions);

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[auth/login] Error:", msg);
    return NextResponse.json(
      { error: "Login failed", details: msg },
      { status: 500 }
    );
  }
}
