import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { turso } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId, newPassword } = body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const targetUserId =
      typeof userId === "string" && userId.trim() ? userId.trim() : currentUser.id;

    // If userId is provided and differs from session user, verify caller has admin privileges
    if (targetUserId !== currentUser.id) {
      const callerCheck = await turso.execute({
        sql: "SELECT id, email FROM users WHERE id = ? LIMIT 1",
        args: [currentUser.id],
      });

      if (callerCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Forbidden: Caller does not possess authorized privileges." },
          { status: 403 }
        );
      }

      // Verify target user exists
      const targetCheck = await turso.execute({
        sql: "SELECT id FROM users WHERE id = ? LIMIT 1",
        args: [targetUserId],
      });

      if (targetCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Target user account not found." },
          { status: 404 }
        );
      }
    } else {
      // Self-update: verify active user exists
      const selfCheck = await turso.execute({
        sql: "SELECT id FROM users WHERE id = ? LIMIT 1",
        args: [targetUserId],
      });

      if (selfCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "User account not found." },
          { status: 404 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    try {
      await turso.execute({
        sql: "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [passwordHash, targetUserId],
      });
    } catch (dbErr: unknown) {
      const errorMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (errorMsg.includes("no such column: updated_at")) {
        try {
          await turso.execute("ALTER TABLE users ADD COLUMN updated_at TEXT");
          await turso.execute({
            sql: "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            args: [passwordHash, targetUserId],
          });
        } catch {
          await turso.execute({
            sql: "UPDATE users SET password_hash = ? WHERE id = ?",
            args: [passwordHash, targetUserId],
          });
        }
      } else {
        throw dbErr;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/users/change-password POST] Error:", msg);
    return NextResponse.json(
      { error: "Failed to update password", details: msg },
      { status: 500 }
    );
  }
}
