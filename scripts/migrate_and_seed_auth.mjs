import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || "file:local.db";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const DEFAULT_EMAIL = "uzeetechcare@gmail.com";
const DEFAULT_PASSWORD = "123456";

console.log("==================================================");
console.log("RUNNING AUTH MIGRATION & DEFAULT USER SEED");
console.log("==================================================");

// 1. Read Auth DDL Schema
const schemaPath = path.resolve(process.cwd(), "turso-auth-schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf-8");
const cleanSql = schemaSql.replace(/--.*$/gm, "");
const statements = cleanSql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// Helper to migrate and seed a client
async function migrateTurso() {
  console.log(`Connecting to Turso at: ${TURSO_DATABASE_URL}`);
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  console.log(`Executing ${statements.length} auth DDL statements on Turso...`);
  for (const stmt of statements) {
    await client.execute(stmt);
  }
  console.log("✓ Turso auth schema tables verified.");

  // Check default user
  const checkRes = await client.execute({
    sql: "SELECT id, email FROM users WHERE email = ?",
    args: [DEFAULT_EMAIL],
  });

  if (checkRes.rows.length === 0) {
    const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
    const userId = uuidv4();
    await client.execute({
      sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      args: [userId, DEFAULT_EMAIL, passwordHash],
    });
    console.log(`✓ Created default admin user: ${DEFAULT_EMAIL}`);
  } else {
    console.log(`✓ Default admin user already exists: ${DEFAULT_EMAIL}`);
  }
}

function migrateLocalScreenguardsDb() {
  const dbPath = path.resolve(process.cwd(), "screenguards.db");
  if (!fs.existsSync(dbPath)) return;

  console.log(`Syncing auth schema to standalone ${dbPath}...`);
  const db = new Database(dbPath);
  try {
    db.exec(cleanSql);
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(DEFAULT_EMAIL);
    if (!existing) {
      const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(
        uuidv4(),
        DEFAULT_EMAIL,
        passwordHash
      );
      console.log(`✓ Default user added to ${dbPath}`);
    }
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.exec("VACUUM");
  } finally {
    db.close();
  }
}

async function main() {
  await migrateTurso();
  migrateLocalScreenguardsDb();
  console.log("==================================================");
  console.log("🎉 AUTH MIGRATION & SEEDING COMPLETED!");
  console.log("Default Login:");
  console.log(`  Email:    ${DEFAULT_EMAIL}`);
  console.log(`  Password: ${DEFAULT_PASSWORD}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});
