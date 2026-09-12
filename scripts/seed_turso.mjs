import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || "file:local.db";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

console.log("Connecting to Turso at:", TURSO_DATABASE_URL);
const db = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function seed() {
  console.log("==================================================");
  console.log("SEEDING TURSO DATABASE WITH 130-BOX MASTER DATASET");
  console.log("==================================================");

  // 1. Execute Schema DDL
  const schemaPath = path.resolve(process.cwd(), "turso-schema.sql");
  console.log(`Reading schema from ${schemaPath}...`);
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  // Remove SQL comments and split statements
  const cleanSql = schemaSql.replace(/--.*$/gm, "");
  const statements = cleanSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Executing ${statements.length} DDL statements...`);
  for (const statement of statements) {
    await db.execute(statement);
  }
  console.log("✓ Schema created/verified successfully.");

  // 2. Read Authoritative 130-Box Dataset
  const jsonPath = path.resolve(process.cwd(), "src/data/screenguards.json");
  console.log(`Reading 130-box dataset from ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const dataset = JSON.parse(rawData);

  const boxes = dataset.boxes;
  console.log(`Found ${boxes.length} boxes in dataset.`);

  // 3. Clear existing models and boxes
  console.log("Clearing existing data...");
  await db.batch([
    { sql: "DELETE FROM models", args: [] },
    { sql: "DELETE FROM boxes", args: [] },
  ]);
  console.log("✓ Existing data cleared.");

  // 4. Prepare batch inserts for boxes and models
  console.log("Inserting boxes...");
  const boxBatches = [];
  const modelBatches = [];

  for (const box of boxes) {
    boxBatches.push({
      sql: `INSERT INTO boxes (
        id, box_number, display_size, title, raw_text, category, notes, source, verification, stock_quantity, stock_count_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        box.id,
        box.boxNumber,
        box.displaySize || "Unknown",
        box.title || "",
        box.rawText || null,
        box.category || "Super-D",
        box.notes || null,
        box.source || null,
        box.verification || null,
        box.stockQuantity || 0,
        box.stockCountVerified ? 1 : 0,
      ],
    });

    const models = Array.isArray(box.compatibleModels) ? box.compatibleModels : [];
    for (const model of models) {
      modelBatches.push({
        sql: `INSERT INTO models (id, box_id, model_name) VALUES (?, ?, ?)`,
        args: [uuidv4(), box.id, model.trim()],
      });
    }
  }

  // Execute in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < boxBatches.length; i += BATCH_SIZE) {
    const chunk = boxBatches.slice(i, i + BATCH_SIZE);
    await db.batch(chunk);
  }
  console.log(`✓ Inserted ${boxBatches.length} boxes.`);

  console.log(`Inserting ${modelBatches.length} model relationships...`);
  for (let i = 0; i < modelBatches.length; i += BATCH_SIZE) {
    const chunk = modelBatches.slice(i, i + BATCH_SIZE);
    await db.batch(chunk);
  }
  console.log(`✓ Inserted ${modelBatches.length} model relationships.`);

  // 5. Verification queries
  const boxCountRes = await db.execute("SELECT COUNT(*) as count FROM boxes");
  const modelCountRes = await db.execute("SELECT COUNT(*) as count FROM models");

  const totalBoxes = Number(boxCountRes.rows[0].count);
  const totalModels = Number(modelCountRes.rows[0].count);

  console.log("==================================================");
  console.log(`VERIFICATION RESULT:`);
  console.log(`Boxes in database:  ${totalBoxes} (Expected: 130)`);
  console.log(`Models in database: ${totalModels} (Expected: 520)`);
  console.log("==================================================");

  if (totalBoxes !== 130 || totalModels !== 520) {
    console.error(`❌ Verification failed! Row counts do not match expected values.`);
    process.exit(1);
  } else {
    console.log("🎉 TURSO SEEDING COMPLETED SUCCESSFULLY!");
  }
}

seed().catch((err) => {
  console.error("❌ Seeding error:", err);
  process.exit(1);
});
