import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { turso } from "@/lib/turso";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing reset token" },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Hash token to look up in database
    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    // Query token
    const tokenRes = await turso.execute({
      sql: `SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1`,
      args: [tokenHash],
    });

    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has already been used. Please request a new one." },
        { status: 400 }
      );
    }

    const tokenRow = tokenRes.rows[0];
    const expiresAt = new Date(String(tokenRow.expires_at)).getTime();

    // Check expiration
    if (Date.now() > expiresAt) {
      // Clean up expired token
      await turso.execute({
        sql: "DELETE FROM password_reset_tokens WHERE id = ?",
        args: [String(tokenRow.id)],
      });

      return NextResponse.json(
        { error: "This password reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const userId = String(tokenRow.user_id);
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atomically update user's password and delete token
    await turso.batch(
      [
        {
          sql: "UPDATE users SET password_hash = ? WHERE id = ?",
          args: [newPasswordHash, userId],
        },
        {
          sql: "DELETE FROM password_reset_tokens WHERE user_id = ?",
          args: [userId],
        },
      ],
      "write"
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. You can now log in.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[auth/reset-password] Error:", msg);
    return NextResponse.json(
      { error: "Failed to reset password", details: msg },
      { status: 500 }
    );
  }
}
