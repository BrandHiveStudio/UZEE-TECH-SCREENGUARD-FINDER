/**
 * Reseed Database Script
 *
 * Replaces the entire screenguard inventory database with the new master list
 * from `new_screenguard_seed.json` (148 consolidated boxes).
 *
 * Invariants:
 * 1. Automatically backs up existing SQLite file(s) to `backup_inventory_<timestamp>.sqlite`
 * 2. Dumps current database records to `data/backups/db_backup_<timestamp>.json`
 * 3. Truncates / clears `models` and `boxes` tables
 * 4. Seeds all 148 boxes, canonical models, display sizes, and variants in batches
 * 5. Runs searchNormalizer validation across newly seeded boxes
 * 6. Verifies final database counts
 */

import fs from "fs";
import path from "path";

// Load .env.local before initializing database clients
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { v4 as uuidv4 } from "uuid";
import type { InStatement } from "@libsql/client";
import { turso } from "../src/lib/turso";
import { getAllBoxes } from "../src/lib/db";
import { matchesBox } from "../src/lib/searchNormalizer";
import type { Box, ScreenGuardVariants } from "../src/types/screenguard";

interface SeedBoxItem {
  id: string;
  groupId: string;
  boxNumber: string;
  displaySize: string;
  title: string;
  compatibleModels: string[];
  stockQuantity: number;
  unitsSold: number;
  stockStatus: string;
  stockCountVerified: boolean;
  source?: string | null;
  verification?: string | null;
  category: string;
  notes?: string | null;
  variants?: ScreenGuardVariants;
}

export async function runReseed() {
  console.log("==================================================================");
  console.log("UZEE TECH - DATABASE RESEED & MASTER INVENTORY MIGRATION 2026");
  console.log("==================================================================\n");

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .split(".")[0];

  // ── Step 1: Backup Existing SQLite & Live Records ───────────────────────────
  console.log("Step 1: Creating automated backups of existing database...");
  const root = process.cwd();

  // SQLite file backup
  const localDbPath = path.join(root, "local.db");
  const backupSqliteName = `backup_inventory_${timestamp}.sqlite`;
  const backupSqlitePath = path.join(root, backupSqliteName);

  if (fs.existsSync(localDbPath)) {
    fs.copyFileSync(localDbPath, backupSqlitePath);
    console.log(`✓ SQLite backup created: ${backupSqliteName} (${fs.statSync(backupSqlitePath).size} bytes)`);
  } else {
    console.log("ℹ No local.db file found on disk (remote Turso database).");
  }

  // Backup screenguards.db if present
  const screenguardsDbPath = path.join(root, "screenguards.db");
  if (fs.existsSync(screenguardsDbPath)) {
    const backupSgPath = path.join(root, `backup_screenguards_${timestamp}.sqlite`);
    fs.copyFileSync(screenguardsDbPath, backupSgPath);
    console.log(`✓ screenguards.db backup created: ${path.basename(backupSgPath)}`);
  }

  // Live records JSON dump
  const backupsDir = path.join(root, "data", "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  let existingCount = 0;
  try {
    const currentBoxes = await getAllBoxes();
    existingCount = currentBoxes.length;
    const backupJsonPath = path.join(backupsDir, `db_backup_${timestamp}.json`);
    fs.writeFileSync(
      backupJsonPath,
      JSON.stringify(
        {
          snapshotCreatedAt: new Date().toISOString(),
          totalBoxes: currentBoxes.length,
          boxes: currentBoxes,
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`✓ JSON snapshot created: data/backups/db_backup_${timestamp}.json (${currentBoxes.length} boxes backed up)`);
  } catch (err) {
    console.warn("⚠️ Warning during pre-migration JSON snapshot:", err);
  }

  // ── Step 2: Load New Master Seed Data ──────────────────────────────────────
  console.log("\nStep 2: Loading new master inventory dataset...");
  const seedJsonPath = path.join(root, "new_screenguard_seed.json");
  if (!fs.existsSync(seedJsonPath)) {
    throw new Error(`Master seed file not found at: ${seedJsonPath}`);
  }

  const rawSeed = JSON.parse(fs.readFileSync(seedJsonPath, "utf8")) as SeedBoxItem[];
  console.log(`✓ Loaded ${rawSeed.length} boxes from ${path.basename(seedJsonPath)}`);

  // ── Step 3: Clear Existing Database Records ───────────────────────────────
  console.log(`\nStep 3: Clearing existing database records (${existingCount} boxes currently in database)...`);
  await turso.execute("DELETE FROM models");
  await turso.execute("DELETE FROM boxes");
  console.log("✓ Existing records cleared from 'models' and 'boxes' tables.");

  // Ensure variants column exists
  try {
    await turso.execute("ALTER TABLE boxes ADD COLUMN variants TEXT");
  } catch {
    // Column already exists
  }

  // ── Step 4: Bulk Insert New Master Boxes in Batches ────────────────────────
  console.log("\nStep 4: Bulk-inserting 148 master boxes & canonical models...");
  const BATCH_SIZE = 25;
  let insertedBoxes = 0;
  let insertedModels = 0;

  for (let i = 0; i < rawSeed.length; i += BATCH_SIZE) {
    const batch = rawSeed.slice(i, i + BATCH_SIZE);
    const statements: InStatement[] = [];

    for (const item of batch) {
      const boxId = item.id || item.groupId || `box-${String(insertedBoxes + 1).padStart(3, "0")}`;
      const variantsJSON = JSON.stringify(
        item.variants || {
          super_d: item.stockQuantity || 0,
          privacy: 0,
          matte: 0,
          borderless: 0,
        }
      );

      statements.push({
        sql: `INSERT INTO boxes (
          id,
          box_number,
          display_size,
          title,
          raw_text,
          category,
          notes,
          source,
          verification,
          stock_quantity,
          stock_count_verified,
          units_sold,
          variants,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [
          boxId,
          item.boxNumber,
          item.displaySize || "Unknown",
          item.title || "",
          item.compatibleModels.join(" | "),
          item.category || "Super-D",
          item.notes || null,
          item.source || null,
          item.verification || null,
          item.stockQuantity || 0,
          item.stockCountVerified ? 1 : 0,
          item.unitsSold || 0,
          variantsJSON,
        ],
      });

      // Insert models for this box
      for (const m of item.compatibleModels) {
        if (m && m.trim()) {
          statements.push({
            sql: `INSERT INTO models (id, box_id, model_name) VALUES (?, ?, ?)`,
            args: [uuidv4(), boxId, m.trim()],
          });
          insertedModels++;
        }
      }

      insertedBoxes++;
    }

    await turso.batch(statements, "write");
    process.stdout.write(`  Inserted ${insertedBoxes}/${rawSeed.length} boxes...\r`);
  }

  console.log(`\n✓ Inserted ${insertedBoxes} boxes and ${insertedModels} model mappings successfully.`);

  // ── Step 5: searchNormalizer Validation ────────────────────────────────────
  console.log("\nStep 5: Running searchNormalizer indexing validation...");
  const allFreshBoxes = await getAllBoxes();

  const validationChecks = [
    { query: "apple 7 plus", expectedBox: "BOX 002" },
    { query: "Apple 7+", expectedBox: "BOX 002" },
    { query: "iPhone 6", expectedBox: "BOX 001" },
    { query: "Samsung Galaxy A34 5G", expectedBox: "BOX 050" },
    { query: "box 084", expectedBox: "BOX 084" },
    { query: "box 126", expectedBox: "BOX 126" },
  ];

  let validationOk = true;
  for (const check of validationChecks) {
    const matches = allFreshBoxes.filter((b) => matchesBox(b, check.query));
    const hasExpected = matches.some((b) => b.boxNumber.toUpperCase() === check.expectedBox.toUpperCase());
    if (hasExpected) {
      console.log(`  ✓ Search '${check.query}' -> Matched ${check.expectedBox}`);
    } else {
      console.error(`  ❌ Search '${check.query}' FAILED to match expected ${check.expectedBox}!`);
      validationOk = false;
    }
  }

  if (!validationOk) {
    throw new Error("searchNormalizer validation failed on newly seeded catalog!");
  }
  console.log("✓ All search normalizer index checks PASSED.");

  // ── Step 6: Final Verification ─────────────────────────────────────────────
  console.log("\nStep 6: Database Verification Summary");
  const countRes = await turso.execute("SELECT COUNT(*) as cnt FROM boxes");
  const dbCount = Number(countRes.rows[0].cnt);
  const modelsCountRes = await turso.execute("SELECT COUNT(*) as cnt FROM models");
  const dbModelsCount = Number(modelsCountRes.rows[0].cnt);

  console.log(`  Total boxes in database: ${dbCount} (Expected: 148)`);
  console.log(`  Total models in database: ${dbModelsCount}`);
  console.log("==================================================================");
  if (dbCount === 148) {
    console.log("🎉 RESEED COMPLETED SUCCESSFULLY! (148 MASTER BOXES ACTIVE)");
  } else {
    console.warn(`⚠️ Warning: Expected 148 boxes but database reports ${dbCount}`);
  }
  console.log("==================================================================");
}

// Auto-run if executed directly via CLI
if (require.main === module || process.argv[1]?.includes("reseed_database")) {
  runReseed().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}

