import { NextResponse } from "next/server";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { turso } from "@/lib/turso";
import { sendPasswordResetEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();

    console.log("[FORGOT-PASSWORD] Request received for:", email);

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    // Query the database using the Turso client
    const userRes = await turso.execute({
      sql: "SELECT id, email FROM users WHERE LOWER(email) = ? LIMIT 1",
      args: [email],
    });

    console.log(
      "[FORGOT-PASSWORD] DB Search Rows Count:",
      userRes.rows ? userRes.rows.length : 0
    );

    // STRICT EARLY EXIT: If user doesn't exist, halt execution immediately with 404
    if (!userRes.rows || userRes.rows.length === 0) {
      console.log(
        "[FORGOT-PASSWORD] User not found. Halting execution without sending email."
      );
      return NextResponse.json(
        { error: "No account found with this email address. Check for typos or contact the Admin." },
        { status: 404 }
      );
    }

    // Retrieve verified registered user
    const userRow = userRes.rows[0];
    const userId = String(userRow.id);
    const matchedEmail = String(userRow.email).trim().toLowerCase();

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

    // Dispatch reset email strictly to verified registered email
    await sendPasswordResetEmail(matchedEmail, rawToken);

    console.log(
      "[FORGOT-PASSWORD] Successfully dispatched reset email to registered user:",
      matchedEmail
    );

    return NextResponse.json({
      success: true,
      message: "If an account exists, a link was sent.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[FORGOT-PASSWORD] Error:", msg);
    return NextResponse.json(
      { error: "Failed to process password reset request", details: msg },
      { status: 500 }
    );
  }
}
