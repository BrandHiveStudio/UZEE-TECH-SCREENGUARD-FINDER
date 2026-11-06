import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { turso } from "@/lib/turso";
import { getAllBoxes } from "@/lib/db";
import type { InStatement } from "@libsql/client";

interface ConsolidatedBoxRecord {
  groupId: string;
  boxNumber: string;
  displaySize: string;
  title: string;
  compatibleModels: string[];
  stockQuantity: number;
  stockStatus: string;
  category: string;
  stockCountVerified: string;
}

/**
 * Parses the clean 148-box CSV file or falls back to live snapshot json.
 */
function loadConsolidated148Dataset(): ConsolidatedBoxRecord[] {
  const csvPath = path.join(process.cwd(), "UZEE_TECH_SCREENGUARD_CLEAN_CONSOLIDATED_2026.csv");

  if (fs.existsSync(csvPath)) {
    try {
      const content = fs.readFileSync(csvPath, "utf8");
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const records: ConsolidatedBoxRecord[] = [];

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Parse CSV line handling quoted strings
        const matches: string[] = [];
        let cur = "";
        let inQuotes = false;

        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            if (inQuotes && line[c + 1] === '"') {
              cur += '"';
              c++; // skip escaped quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            matches.push(cur);
            cur = "";
          } else {
            cur += char;
          }
        }
        matches.push(cur);

        if (matches.length >= 5) {
          const groupId = matches[0] || `box-${String(i).padStart(3, "0")}`;
          const boxNumber = matches[1] || `BOX ${String(i).padStart(3, "0")}`;
          const displaySize = matches[2] || "Unknown";
          const title = matches[3] || "Screen Guard";
          const modelsRaw = matches[4] || title;
          const models = modelsRaw
            .split("|")
            .map((m) => m.trim())
            .filter((m) => m.length > 0);

          records.push({
            groupId,
            boxNumber,
            displaySize,
            title,
            compatibleModels: models.length > 0 ? models : [title],
            stockQuantity: 0,
            stockStatus: "NOT COUNTED",
            category: "Super-D",
            stockCountVerified: "NO",
          });
        }
      }

      if (records.length === 148) {
        return records;
      }
    } catch (e) {
      console.warn("Failed parsing CSV, falling back to snapshot:", e);
    }
  }

  // Fallback to scripts/live_supabase_snapshot.json
  const snapshotPath = path.join(process.cwd(), "scripts", "live_supabase_snapshot.json");
  if (fs.existsSync(snapshotPath)) {
    const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    const map = new Map<number, any>();
    raw.forEach((x: any) => {
      const m = (x.box_number || "").match(/BOX\s*(\d+)/i);
      if (m) map.set(parseInt(m[1], 10), x);
    });

    const fallbackList: ConsolidatedBoxRecord[] = [];
    for (let i = 1; i <= 148; i++) {
      const item = map.get(i) || {};
      const boxNumPadded = "BOX " + String(i).padStart(3, "0");
      const groupId = "box-" + String(i).padStart(3, "0");
      const displaySize = item.display_size || "Unknown";
      const title = item.title || "Screen Guard";
      const models = (item.models || []).map((m: any) => m.model_name || m).filter(Boolean);

      fallbackList.push({
        groupId,
        boxNumber: boxNumPadded,
        displaySize,
        title,
        compatibleModels: models.length > 0 ? models : [title],
        stockQuantity: 0,
        stockStatus: "NOT COUNTED",
        category: "Super-D",
        stockCountVerified: "NO",
      });
    }
    return fallbackList;
  }

  throw new Error("Could not find clean consolidated dataset source.");
}

/**
 * Moves clutter legacy files into archive/legacy_seeds_and_excels/
 */
function archiveLegacyFiles(): number {
  const root = process.cwd();
  const archiveDir = path.join(root, "archive", "legacy_seeds_and_excels");
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  let count = 0;
  const rootFiles = fs.readdirSync(root);

  for (const file of rootFiles) {
    // Preserve current clean consolidated csv & active db
    if (file === "UZEE_TECH_SCREENGUARD_CLEAN_CONSOLIDATED_2026.csv") continue;
    if (file === "local.db" || file === "screenguards.db") continue;

    const isLegacyExcel =
      file.startsWith("UZEE_TECH_SUPER_D_") && (file.endsWith(".xlsx") || file.endsWith(".csv"));
    const isLegacyJsonMock =
      file === "redmi13c_output.json" ||
      file === "samsung_a06.json" ||
      file === "curl_samsung_a06.json" ||
      file === "screenguards.backup.json" ||
      (file.startsWith("screenguards.previous-") && file.endsWith(".json"));
    const isLegacySql =
      file === "seed-data.backup.sql" ||
      (file.startsWith("seed-data.previous-") && file.endsWith(".sql"));

    if (isLegacyExcel || isLegacyJsonMock || isLegacySql) {
      try {
        const srcPath = path.join(root, file);
        const destPath = path.join(archiveDir, file);
        if (fs.existsSync(srcPath)) {
          fs.renameSync(srcPath, destPath);
          count++;
        }
      } catch (err) {
        console.warn(`Could not archive ${file}:`, err);
      }
    }
  }

  return count;
}

// ── POST: Execute migration with handshake ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { confirmationPhrase } = body;

    if (confirmationPhrase !== "RESET AND MIGRATE 2026") {
      return NextResponse.json(
        {
          error:
            "Invalid confirmation phrase. Please type 'RESET AND MIGRATE 2026' to authorize migration.",
        },
        { status: 403 }
      );
    }

    // ── 1. Create Automated Pre-Migration Snapshot ──────────────────────────
    const currentBoxes = await getAllBoxes();
    const backupsDir = path.join(process.cwd(), "data", "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .split(".")[0];
    const backupFileName = `db_backup_${timestamp}.json`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    const snapshotData = {
      snapshotCreatedAt: new Date().toISOString(),
      totalBoxes: currentBoxes.length,
      boxes: currentBoxes,
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(snapshotData, null, 2), "utf8");

    // ── 2. Load Consolidated 148 Master Catalog ─────────────────────────────
    const master148 = loadConsolidated148Dataset();

    // ── 3. Cleanse & Seed Database in Batch Transactions ────────────────────
    // Clean tables
    await turso.execute("DELETE FROM models");
    await turso.execute("DELETE FROM boxes");

    // Ensure variants column
    try {
      await turso.execute("ALTER TABLE boxes ADD COLUMN variants TEXT");
    } catch {
      // column already exists
    }

    const defaultVariantsJSON = JSON.stringify({
      super_d: 0,
      privacy: 0,
      matte: 0,
      borderless: 0,
    });

    // Chunk into batches of 25 boxes (+ their models) to stay well within statement limits
    const CHUNK_SIZE = 25;
    for (let i = 0; i < master148.length; i += CHUNK_SIZE) {
      const chunk = master148.slice(i, i + CHUNK_SIZE);
      const statements: InStatement[] = [];

      for (const item of chunk) {
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
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [
            item.groupId,
            item.boxNumber,
            item.displaySize,
            item.title,
            item.compatibleModels.join(" • "),
            item.category,
            null,
            "2026-Consolidated",
            "VERIFIED",
            0,
            0,
            0,
            defaultVariantsJSON,
          ],
        });

        for (const model of item.compatibleModels) {
          statements.push({
            sql: "INSERT INTO models (box_id, model_name) VALUES (?, ?)",
            args: [item.groupId, model],
          });
        }
      }

      await turso.batch(statements, "write");
    }

    // ── 4. File Clutter Archival ────────────────────────────────────────────
    const archivedFilesCount = archiveLegacyFiles();

    return NextResponse.json({
      success: true,
      backupFile: `data/backups/${backupFileName}`,
      seededRecordsCount: master148.length,
      archivedFilesCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[database-migration] Error:", error);
    return NextResponse.json(
      { error: error.message || "Database migration failed" },
      { status: 500 }
    );
  }
}

// ── GET: List past backups or download a specific snapshot ──────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedFile = searchParams.get("file");

    const backupsDir = path.join(process.cwd(), "data", "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Single file download / inspection
    if (requestedFile) {
      // Prevent directory traversal
      const safeName = path.basename(requestedFile);
      const targetPath = path.join(backupsDir, safeName);
      if (!fs.existsSync(targetPath)) {
        return NextResponse.json({ error: "Snapshot file not found" }, { status: 404 });
      }

      const content = fs.readFileSync(targetPath, "utf8");
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    }

    // List all snapshots
    const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".json"));
    const snapshots = files
      .map((fileName) => {
        try {
          const filePath = path.join(backupsDir, fileName);
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, "utf8");
          const parsed = JSON.parse(content);
          return {
            fileName,
            sizeBytes: stats.size,
            createdAt: parsed.snapshotCreatedAt || stats.mtime.toISOString(),
            totalBoxes: parsed.totalBoxes ?? (Array.isArray(parsed.boxes) ? parsed.boxes.length : 0),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

    return NextResponse.json({ snapshots });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to list snapshots" },
      { status: 500 }
    );
  }
}

