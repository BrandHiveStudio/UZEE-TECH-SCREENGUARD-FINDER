import { NextResponse } from "next/server";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { turso } from "@/lib/turso";
import { sendPasswordResetEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    // Normalize incoming email
    const targetEmail = email.trim().toLowerCase();

    // Query Turso strictly
    const userRes = await turso.execute({
      sql: "SELECT id, email FROM users WHERE LOWER(email) = ? LIMIT 1",
      args: [targetEmail],
    });

    // CRITICAL: If no user is returned, DO NOT CALL sendPasswordResetEmail. Exit immediately.
    if (userRes.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "If an account exists, a link was sent.",
      });
    }

    const userRow = userRes.rows[0];
    const userId = String(userRow.id);
    const registeredEmail = String(userRow.email);

    // Generate secure random raw token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Hash token for database storage
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Expiration: 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Clean up any existing tokens for this user first
    await turso.execute({
      sql: "DELETE FROM password_reset_tokens WHERE user_id = ?",
      args: [userId],
    });

    // Store new token
    await turso.execute({
      sql: `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, ?)`,
      args: [uuidv4(), userId, tokenHash, expiresAt],
    });

    // ONLY when user is found: call sendPasswordResetEmail with registered email and rawToken
    await sendPasswordResetEmail(registeredEmail, rawToken);

    return NextResponse.json({
      success: true,
      message: "If an account exists, a link was sent.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[auth/forgot-password] Error:", msg);
    return NextResponse.json(
      { error: "Failed to process password reset request", details: msg },
      { status: 500 }
    );
  }
}
