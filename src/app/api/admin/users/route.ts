import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { turso } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await turso.execute(
      "SELECT id, email, created_at FROM users ORDER BY created_at ASC"
    );

    const users = res.rows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      createdAt: String(row.created_at),
      isCurrent: String(row.id) === currentUser.id,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/users GET] Error:", msg);
    return NextResponse.json(
      { error: "Failed to fetch users", details: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
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

    // Check duplicate email
    const existing = await turso.execute({
      sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
      args: [normalizedEmail],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "A user with this email address already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUserId = uuidv4();

    await turso.execute({
      sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      args: [newUserId, normalizedEmail, passwordHash],
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: normalizedEmail,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/users POST] Error:", msg);
    return NextResponse.json(
      { error: "Failed to create user", details: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (id === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot delete your own active account" },
        { status: 400 }
      );
    }

    // Delete user from Turso (foreign key cascades to tokens)
    await turso.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/users DELETE] Error:", msg);
    return NextResponse.json(
      { error: "Failed to delete user", details: msg },
      { status: 500 }
    );
  }
}
