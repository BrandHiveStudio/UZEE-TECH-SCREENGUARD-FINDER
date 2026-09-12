import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const dbPath = path.resolve(process.cwd(), "screenguards.db");

console.log("==================================================");
console.log("BUILDING CANONICAL LOCAL SQLITE DATABASE (screenguards.db)");
console.log("==================================================");
console.log("Target Database Path:", dbPath);

// 1. Remove existing file if present for a clean build
if (fs.existsSync(dbPath)) {
  console.log("Removing existing screenguards.db...");
  fs.unlinkSync(dbPath);
}

// 2. Initialize better-sqlite3 database
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

try {
  // 3. Execute Schema DDL
  const schemaPath = path.resolve(process.cwd(), "turso-schema.sql");
  console.log(`Reading DDL schema from ${schemaPath}...`);
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  // Strip comments and execute schema
  const cleanSql = schemaSql.replace(/--.*$/gm, "");
  db.exec(cleanSql);
  console.log("✓ DDL schema executed successfully.");

  // 4. Read canonical 130-box JSON dataset
  const jsonPath = path.resolve(process.cwd(), "src/data/screenguards.json");
  console.log(`Reading canonical 130-box dataset from ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const dataset = JSON.parse(rawData);

  const boxes = dataset.boxes;
  console.log(`Found ${boxes.length} boxes to insert.`);

  // 5. Prepare insert statements
  const insertBoxStmt = db.prepare(`
    INSERT INTO boxes (
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
      created_at,
      updated_at
    ) VALUES (
      @id,
      @box_number,
      @display_size,
      @title,
      @raw_text,
      @category,
      @notes,
      @source,
      @verification,
      @stock_quantity,
      @stock_count_verified,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const insertModelStmt = db.prepare(`
    INSERT INTO models (
      id,
      box_id,
      model_name,
      created_at
    ) VALUES (
      @id,
      @box_id,
      @model_name,
      CURRENT_TIMESTAMP
    )
  `);

  // 6. Execute inserts within a single atomic transaction
  let totalModelsInserted = 0;

  const insertAll = db.transaction(() => {
    for (const box of boxes) {
      insertBoxStmt.run({
        id: box.id,
        box_number: box.boxNumber,
        display_size: box.displaySize || "Unknown",
        title: box.title || "",
        raw_text: box.rawText ?? null,
        category: box.category ?? "Super-D",
        notes: box.notes ?? null,
        source: box.source ?? null,
        verification: box.verification ?? null,
        stock_quantity: box.stockQuantity ?? 0,
        stock_count_verified: box.stockCountVerified ? 1 : 0,
      });

      const models = Array.isArray(box.compatibleModels) ? box.compatibleModels : [];
      for (const model of models) {
        if (model && model.trim()) {
          insertModelStmt.run({
            id: uuidv4(),
            box_id: box.id,
            model_name: model.trim(),
          });
          totalModelsInserted++;
        }
      }
    }
  });

  insertAll();
  console.log(`✓ Inserted ${boxes.length} boxes.`);
  console.log(`✓ Inserted ${totalModelsInserted} model relationships.`);

  // 7. Verification queries
  const boxCount = db.prepare("SELECT COUNT(*) as count FROM boxes").get().count;
  const modelCount = db.prepare("SELECT COUNT(*) as count FROM models").get().count;

  console.log("==================================================");
  console.log("DATABASE AUDIT & VERIFICATION:");
  console.log(`Total boxes in DB:   ${boxCount} (Expected: 130)`);
  console.log(`Total models in DB:  ${modelCount} (Expected: 520)`);
  console.log("==================================================");

  if (boxCount !== 130 || modelCount !== 520) {
    throw new Error(`Integrity check failed: Expected 130 boxes and 520 models, got ${boxCount} boxes and ${modelCount} models.`);
  }

  // Vacuum to produce a clean, compact file for upload
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec("VACUUM");

  console.log("✓ Vacuum and checkpoint completed.");
} finally {
  // 8. Close connection cleanly
  db.close();
  console.log("✓ Database connection closed cleanly.");
}

const stats = fs.statSync(dbPath);
console.log(`\n🎉 SUCCESS: screenguards.db is ready (${stats.size} bytes).`);
console.log("Ready for direct Turso upload via: turso db create <db-name> --from-file screenguards.db");
