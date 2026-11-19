import fs from "fs";
import path from "path";

// Load .env.local
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

import { createClient, type InStatement } from "@libsql/client";
import { turso } from "../src/lib/turso";
import { v4 as uuidv4 } from "uuid";
import type { Box, ScreenGuardVariants } from "../src/types/screenguard";

// Specific Model Additions Map by Box Number or ID
const ENRICHMENT_MAP: Record<string, string[]> = {
  // Apple
  "BOX 001": [
    "iPhone 6",
    "iPhone 6s",
    "iPhone 7",
    "iPhone 8",
    "iPhone SE (2020)",
    "iPhone SE 2nd Gen",
    "iPhone SE (2022)",
    "iPhone SE 3rd Gen",
    "iPhone SE 2",
    "iPhone SE 3",
    "iPhone SE2",
    "iPhone SE3",
    "iPhone 6/6s/7/8/SE",
    "iPhone 6s",
    "iPhone 6"
  ],
  "BOX 002": [
    "iPhone 6 Plus",
    "iPhone 6s Plus",
    "iPhone 7 Plus",
    "iPhone 8 Plus",
    "iPhone 6+",
    "iPhone 6s+",
    "iPhone 7+",
    "iPhone 8+",
    "iPhone 6 Plus / 6s Plus / 7 Plus / 8 Plus"
  ],
  "BOX 003": [
    "iPhone X",
    "iPhone XS",
    "iPhone 11 Pro",
    "iPhone 10",
    "iPhone X / XS / 11 Pro",
    "iPhone XS 5.8",
    "iPhone 11 Pro 5.8"
  ],
  "BOX 004": [
    "iPhone XR",
    "iPhone 11",
    "iPhone XR / 11",
    "iPhone 11 6.1",
    "iPhone XR 6.1"
  ],
  "BOX 005": [
    "iPhone XS Max",
    "iPhone 11 Pro Max",
    "iPhone XS Max / 11 Pro Max",
    "iPhone XS Max 6.5",
    "iPhone 11 Pro Max 6.5"
  ],
  "BOX 006": [
    "iPhone 12",
    "iPhone 12 Pro",
    "iPhone 12 / 12 Pro",
    "iPhone 12/12 Pro 6.1"
  ],
  "BOX 007": [
    "iPhone 12 mini",
    "iPhone 13 mini",
    "iPhone 12 mini / 13 mini"
  ],
  "BOX 008": [
    "iPhone 12 Pro Max",
    "iPhone 12 Pro Max 6.7"
  ],
  "BOX 009": [
    "iPhone 13",
    "iPhone 13 Pro",
    "iPhone 14",
    "iPhone 16e",
    "iPhone 13 / 13 Pro / 14",
    "iPhone 13/14 6.1"
  ],
  "BOX 010": [
    "iPhone 13 Pro Max",
    "iPhone 14 Plus",
    "iPhone 14+",
    "iPhone 13 Pro Max / 14 Plus",
    "iPhone 13 Pro Max / 14 Plus 6.7"
  ],
  "BOX 011": [
    "iPhone 14 Pro",
    "iPhone 15",
    "iPhone 16",
    "iPhone 14 Pro / 15",
    "iPhone 14 Pro 6.1"
  ],
  "BOX 012": [
    "iPhone 14 Pro Max",
    "iPhone 15 Plus",
    "iPhone 16 Plus",
    "iPhone 14 Pro Max / 15 Plus",
    "iPhone 14 Pro Max 6.7"
  ],
  "BOX 013": [
    "iPhone 15",
    "iPhone 16",
    "iPhone 14 Pro",
    "iPhone 16 / 15",
    "iPhone 15 6.1"
  ],
  "BOX 014": [
    "iPhone 15 Plus",
    "iPhone 16 Plus",
    "iPhone 14 Pro Max",
    "iPhone 15 Plus / 16 Plus",
    "iPhone 15 Plus 6.7"
  ],
  "BOX 015": [
    "iPhone 15 Pro",
    "iPhone 15 Pro 6.1"
  ],
  "BOX 016": [
    "iPhone 15 Pro Max",
    "iPhone 15 Pro Max 6.7"
  ],
  "BOX 017": [
    "iPhone 16 Pro",
    "iPhone 16 Pro 6.3"
  ],
  "BOX 018": [
    "iPhone 16 Pro Max",
    "iPhone 16 Pro Max 6.9"
  ],
  "BOX 019": [
    "iPhone 17",
    "iPhone 17 Pro",
    "iPhone 17 / 17 Pro"
  ],
  "BOX 020": [
    "iPhone 17 Pro Max",
    "iPhone 17 Pro Max 6.9"
  ],

  // Google Pixel
  "BOX 024": ["Google Pixel 6a", "Pixel 6a"],
  "BOX 026": ["Google Pixel 7", "Pixel 7"],
  "BOX 027": ["Google Pixel 8", "Pixel 8"],
  "BOX 028": ["Google Pixel 7a", "Pixel 7a"],
  "BOX 029": ["Google Pixel 9a", "Pixel 9a"],
  "BOX 030": ["Google Pixel 9 Pro", "Pixel 9 Pro"],
  "BOX 032": ["Google Pixel 9 Pro XL", "Pixel 9 Pro XL"],
  "BOX 033": ["Google Pixel 9", "Pixel 9"],

  // Samsung
  "BOX 041": ["Samsung Galaxy S22", "Samsung Galaxy S23", "S22", "S23"],
  "BOX 043": ["Samsung Galaxy S24+", "Samsung Galaxy S24 Plus", "Samsung Galaxy S23+", "S24+", "S24 Plus"],
  "BOX 046": [
    "Samsung Galaxy A71",
    "Samsung Galaxy A70",
    "Samsung Galaxy M51",
    "Samsung Galaxy Note 10 Lite",
    "Samsung Galaxy S10 Lite",
    "A71",
    "A70",
    "M51"
  ],
  "BOX 047": [
    "Samsung Galaxy A16",
    "Samsung Galaxy A16 5G",
    "Samsung Galaxy M16",
    "A16",
    "A16 5G",
    "M16"
  ],
  "BOX 048": [
    "Samsung Galaxy A05",
    "Samsung Galaxy A05s",
    "Samsung Galaxy A06",
    "Samsung Galaxy A07",
    "Samsung Galaxy A14",
    "Samsung Galaxy A14 5G",
    "Samsung Galaxy M06",
    "Samsung Galaxy F06",
    "Samsung Galaxy M14",
    "Samsung Galaxy F14",
    "Vivo Y04",
    "Vivo Y19e",
    "Vivo Y29s",
    "A05",
    "A05s",
    "A06",
    "A07",
    "A14",
    "M06",
    "F06",
    "M14",
    "F14",
    "Samsung A05",
    "Samsung A05s",
    "Samsung A06",
    "Samsung A14",
    "Realme Note 60",
    "Realme Note 50",
    "Realme C61",
    "Realme C63",
    "Realme C51",
    "Realme C53",
    "POCO C65",
    "POCO M6",
    "Redmi 13C"
  ],
  "BOX 050": ["Samsung Galaxy A34 5G", "Samsung Galaxy A34", "A34", "A34 5G"],
  "BOX 051": ["Samsung Galaxy A35 5G", "Samsung Galaxy A35", "A35", "A35 5G", "Samsung Galaxy A55 5G"],
  "BOX 055": [
    "Samsung Galaxy A25",
    "Samsung Galaxy A25 5G",
    "Samsung Galaxy A24",
    "Samsung Galaxy A24 4G",
    "A25",
    "A24"
  ],
  "BOX 058": [
    "Samsung Galaxy A51",
    "Samsung Galaxy A51 5G",
    "Google Pixel 6",
    "A51"
  ],
  "BOX 060": [
    "Samsung Galaxy A10",
    "Samsung Galaxy A10s",
    "Samsung Galaxy M10",
    "Samsung Galaxy M10s",
    "Samsung Galaxy M01",
    "Samsung Galaxy M01s",
    "A10",
    "A10s",
    "M10"
  ],
  "BOX 061": ["Samsung Galaxy A54", "Samsung Galaxy A54 5G", "Samsung Galaxy M54 5G", "A54", "A54 5G"],
  "BOX 065": [
    "Samsung Galaxy A10",
    "Samsung Galaxy A10s",
    "Samsung Galaxy M10",
    "Samsung Galaxy M01",
    "A10",
    "A10s"
  ],
  "BOX 085": [
    "Samsung Galaxy A51",
    "Samsung Galaxy A51 5G",
    "Google Pixel 6",
    "A51"
  ],
  "BOX 089": [
    "Samsung Galaxy A55",
    "Samsung Galaxy A55 5G",
    "Samsung Galaxy A35 5G",
    "A55",
    "A55 5G"
  ],

  // Xiaomi / Redmi / POCO
  "BOX 049": [
    "Redmi Note 13 Pro 4G",
    "POCO M6 Pro 4G",
    "Redmi Note 13 Pro 5G",
    "Note 13 Pro 4G",
    "Note 13 Pro"
  ],
  "BOX 053": [
    "Redmi 10",
    "Redmi 10 Prime",
    "Redmi 10 2022",
    "Redmi 10 Power"
  ],
  "BOX 054": [
    "Redmi 9",
    "Redmi 9 Prime",
    "POCO M2",
    "Redmi 9 Activ"
  ],
  "BOX 056": [
    "Redmi Note 7",
    "Redmi Note 7 Pro",
    "Redmi Note 7S"
  ],
  "BOX 062": [
    "Redmi Note 9",
    "Redmi Note 9S",
    "Redmi Note 9 Pro",
    "Redmi Note 9 Pro Max",
    "POCO M2 Pro",
    "Note 9",
    "Note 9 Pro",
    "Note 9S"
  ],
  "BOX 063": [
    "Redmi Note 10 4G",
    "Redmi Note 10",
    "Redmi Note 10S",
    "POCO M5s",
    "Note 10",
    "Note 10S"
  ],
  "BOX 064": [
    "Redmi 8",
    "Redmi 8A",
    "Redmi 8A Dual",
    "Redmi 8A Pro"
  ],
  "BOX 088": [
    "Redmi Note 12",
    "Redmi Note 12 4G",
    "Redmi Note 12 5G",
    "POCO X5 5G",
    "Note 12",
    "Note 12 4G"
  ],
  "BOX 095": [
    "Redmi 14C",
    "POCO C75",
    "Redmi 14R",
    "14C",
    "C75"
  ],
  "BOX 121": [
    "Redmi 12",
    "Redmi 12 4G",
    "Redmi 12 5G",
    "Redmi 13",
    "Redmi 13 4G",
    "POCO M6",
    "POCO M6 Pro 4G",
    "POCO M6 Pro 5G",
    "Redmi 11 Prime",
    "Redmi Note 12R"
  ],
  "BOX 126": [
    "Redmi Note 13",
    "Redmi Note 13 4G",
    "Redmi Note 13 5G",
    "POCO M6 Pro",
    "Note 13",
    "Note 13 4G"
  ],

  // Realme / OPPO
  "BOX 074": [
    "OPPO F19",
    "OPPO F19 Pro",
    "OPPO F19 Pro+",
    "OPPO Reno 5F",
    "OPPO Reno 6 Lite",
    "OPPO A74 4G",
    "OPPO A94 4G",
    "OPPO A95 4G",
    "Realme 8",
    "Realme 8 Pro",
    "F19",
    "F19 Pro",
    "A74",
    "A94",
    "Realme 8"
  ],
  "BOX 084": [
    "Realme 5",
    "Realme 5s",
    "Realme 5i",
    "Realme 6i",
    "Realme C3",
    "Realme C11",
    "Realme C11 2021",
    "Realme C12",
    "Realme C15",
    "Realme C20",
    "Realme C21",
    "Realme C21Y",
    "Realme C25",
    "Realme C25s",
    "Realme C25Y",
    "Realme Narzo 10",
    "Realme Narzo 10A",
    "Realme Narzo 20",
    "Realme Narzo 30A",
    "OPPO A5 (2020)",
    "OPPO A9 (2020)",
    "OPPO A31 (2020)",
    "OPPO A11",
    "Narzo 10",
    "Narzo 20",
    "Narzo 30A",
    "C11",
    "C12",
    "C15",
    "C21",
    "C25"
  ],
  "BOX 098": [
    "OPPO F17",
    "OPPO A73 (2020)",
    "Realme 7i",
    "F17"
  ],

  // Vivo
  "BOX 076": [
    "Vivo Y83",
    "Vivo Y83 Pro",
    "Vivo Y81",
    "Vivo Y81i",
    "Vivo Y71",
    "Y83",
    "Y81"
  ],
  "BOX 086": [
    "Vivo V15 Pro",
    "Vivo S1 Pro",
    "Vivo V15",
    "V15 Pro",
    "S1 Pro"
  ],

  // Huawei / Honor
  "BOX 077": [
    "Huawei Nova 5T",
    "Honor 20",
    "Honor 20 Pro",
    "Nova 5T"
  ],

  // OnePlus
  "BOX 113": [
    "OnePlus 8T",
    "OnePlus 9",
    "OnePlus 9R",
    "8T",
    "9R"
  ],
  "BOX 156": [
    "OnePlus Nord 3",
    "OnePlus Nord CE 3",
    "OnePlus Ace 2V",
    "Nord 3"
  ],

  // Tecno & Infinix
  "BOX 110": [
    "Tecno Pova 5 Pro",
    "Tecno Pova 5",
    "Tecno Pova Neo 3",
    "Pova 5 Pro",
    "Pova 5"
  ],
  "BOX 120": [
    "Infinix Note 11",
    "Infinix Note 11s",
    "Infinix Note 12",
    "Infinix Hot 11S",
    "Note 11",
    "Note 12"
  ],
  "BOX 142": [
    "Infinix Hot 8",
    "Infinix Hot 9",
    "Infinix Hot 9 Play",
    "Infinix Smart 4",
    "Infinix Smart 4 Plus",
    "Hot 8",
    "Hot 9"
  ],
  "BOX 143": [
    "Infinix Hot 40i",
    "Tecno Spark 20",
    "Tecno Spark 20C",
    "Infinix Smart 8",
    "Hot 40i"
  ],
  "BOX 152": [
    "Tecno Spark 20",
    "Tecno Spark 20C",
    "Infinix Hot 40i",
    "Infinix Smart 8",
    "Infinix Smart 8 HD",
    "Infinix Smart 8 Pro",
    "Tecno Pop 8",
    "Spark 20",
    "Hot 40i",
    "Smart 8"
  ],
  "BOX 153": [
    "Tecno Spark Go 2024",
    "Tecno Spark Go 2025",
    "Tecno Pop 8",
    "Infinix Smart 8",
    "Infinix Smart 8 HD",
    "Spark Go 2024",
    "Spark Go 2025"
  ]
};

function deduplicateModels(models: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of models) {
    const trimmed = m.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

function getBoxKey(boxNumber: string): string {
  const match = boxNumber.match(/BOX\s+\d+/i);
  return match ? match[0].toUpperCase() : boxNumber.toUpperCase();
}

async function main() {
  console.log("=== Universal Cross-Model Compatibility Enrichment (All 143 Boxes) ===\n");
  const root = process.cwd();

  // 1. Load current live database boxes (to preserve stock & variants)
  let liveBoxesMap = new Map<string, Box>();
  try {
    const res = await turso.execute("SELECT id, box_number, stock_quantity, stock_count_verified, units_sold, variants FROM boxes");
    for (const r of res.rows) {
      liveBoxesMap.set(String(r.id), {
        id: String(r.id),
        boxNumber: String(r.box_number),
        stockQuantity: Number(r.stock_quantity ?? 0),
        stockCountVerified: Boolean(r.stock_count_verified),
        unitsSold: Number(r.units_sold ?? 0),
        variants: r.variants ? JSON.parse(String(r.variants)) : undefined,
      } as Box);
    }
    console.log(`✓ Fetched ${liveBoxesMap.size} current boxes from database for state preservation.`);
  } catch (err) {
    console.warn("⚠️ Could not fetch from Turso DB:", err);
  }

  // 2. Load new_screenguard_seed.json
  const seedJsonPath = path.join(root, "new_screenguard_seed.json");
  const seedBoxes = JSON.parse(fs.readFileSync(seedJsonPath, "utf-8")) as any[];
  console.log(`✓ Loaded ${seedBoxes.length} boxes from new_screenguard_seed.json`);

  let totalModelsBefore = 0;
  let totalModelsAfter = 0;

  for (const box of seedBoxes) {
    const key = getBoxKey(box.boxNumber);
    const existingModels = box.compatibleModels || [];
    totalModelsBefore += existingModels.length;

    // Check if live DB has non-zero stock/variants to preserve
    const liveBox = liveBoxesMap.get(box.id);
    if (liveBox && (liveBox.stockQuantity > 0 || liveBox.stockCountVerified)) {
      box.stockQuantity = liveBox.stockQuantity;
      box.stockCountVerified = liveBox.stockCountVerified;
      box.unitsSold = liveBox.unitsSold;
      if (liveBox.variants) {
        box.variants = liveBox.variants;
      }
      box.stockStatus = box.stockQuantity >= 4 ? "IN_STOCK" : box.stockQuantity >= 1 ? "LOW_STOCK" : "OUT_OF_STOCK";
    }

    // Merge enrichment additions
    const additions = ENRICHMENT_MAP[key] || [];
    const merged = [...existingModels, ...additions];
    const cleanList = deduplicateModels(merged);
    box.compatibleModels = cleanList;
    totalModelsAfter += cleanList.length;
  }

  console.log(`✓ Enriched models: ${totalModelsBefore} -> ${totalModelsAfter} total model mappings.`);

  // 3. Save new_screenguard_seed.json
  fs.writeFileSync(seedJsonPath, JSON.stringify(seedBoxes, null, 2), "utf-8");
  console.log(`✓ Saved ${seedJsonPath}`);

  // 4. Save src/data/screenguards.json
  const dataJsonPath = path.join(root, "src", "data", "screenguards.json");
  fs.writeFileSync(dataJsonPath, JSON.stringify({ boxes: seedBoxes }, null, 2), "utf-8");
  console.log(`✓ Saved ${dataJsonPath}`);

  // 5. Save new_screenguard_seed.csv
  const seedCsvPath = path.join(root, "new_screenguard_seed.csv");
  const csvLines = [
    "ID,Box Number,Display Size,Title,Compatible Models,Stock Quantity,Units Sold,Stock Status,Stock Count Verified,Source,Verification,Category,Notes"
  ];
  for (const b of seedBoxes) {
    const modelsStr = `"${(b.compatibleModels || []).join(" | ").replace(/"/g, '""')}"`;
    const notesStr = b.notes ? `"${String(b.notes).replace(/"/g, '""')}"` : "";
    const titleStr = `"${String(b.title || "").replace(/"/g, '""')}"`;
    const sizeStr = `"${String(b.displaySize || "").replace(/"/g, '""')}"`;
    csvLines.push(
      `${b.id},${b.boxNumber},${sizeStr},${titleStr},${modelsStr},${b.stockQuantity ?? 0},${b.unitsSold ?? 0},${b.stockStatus || "NOT COUNTED"},${b.stockCountVerified ? "TRUE" : "FALSE"},"${b.source || ""}","${b.verification || ""}","${b.category || "Super-D"}",${notesStr}`
    );
  }
  fs.writeFileSync(seedCsvPath, csvLines.join("\n"), "utf-8");
  console.log(`✓ Saved ${seedCsvPath}`);

  // 6. Reseed Turso Cloud Database
  console.log("\nUpdating Turso Cloud Database...");
  try {
    // Delete existing models and update boxes
    await turso.execute("DELETE FROM models");
    console.log("✓ Cleared Turso models table.");

    const BATCH_SIZE = 25;
    let insertedBoxes = 0;
    let insertedModels = 0;

    for (let i = 0; i < seedBoxes.length; i += BATCH_SIZE) {
      const batch = seedBoxes.slice(i, i + BATCH_SIZE);
      const statements: InStatement[] = [];

      for (const item of batch) {
        const boxId = item.id;
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
            id, box_number, display_size, title, raw_text, category, notes,
            source, verification, stock_quantity, stock_count_verified,
            units_sold, variants, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            box_number = excluded.box_number,
            display_size = excluded.display_size,
            title = excluded.title,
            raw_text = excluded.raw_text,
            category = excluded.category,
            notes = excluded.notes,
            source = excluded.source,
            verification = excluded.verification,
            stock_quantity = excluded.stock_quantity,
            stock_count_verified = excluded.stock_count_verified,
            units_sold = excluded.units_sold,
            variants = excluded.variants,
            updated_at = CURRENT_TIMESTAMP`,
          args: [
            boxId,
            item.boxNumber,
            item.displaySize || "Unknown",
            item.title || "",
            (item.compatibleModels || []).join(" | "),
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

        for (const m of item.compatibleModels || []) {
          if (m && m.trim()) {
            statements.push({
              sql: "INSERT INTO models (id, box_id, model_name) VALUES (?, ?, ?)",
              args: [uuidv4(), boxId, m.trim()],
            });
            insertedModels++;
          }
        }
        insertedBoxes++;
      }
      await turso.batch(statements, "write");
    }
    console.log(`✓ Inserted ${insertedBoxes} boxes and ${insertedModels} models into Turso.`);
  } catch (err) {
    console.error("⚠️ Failed to update Turso Cloud Database:", err);
  }

  // 7. Update local SQLite databases: local.db and screenguards.db
  for (const dbName of ["local.db", "screenguards.db"]) {
    const dbFilePath = path.join(root, dbName);
    if (!fs.existsSync(dbFilePath)) continue;
    console.log(`\nUpdating ${dbName}...`);
    try {
      const localClient = createClient({ url: `file:${dbFilePath}` });
      await localClient.execute("DELETE FROM models");

      const BATCH_SIZE = 25;
      for (let i = 0; i < seedBoxes.length; i += BATCH_SIZE) {
        const batch = seedBoxes.slice(i, i + BATCH_SIZE);
        const statements: InStatement[] = [];

        for (const item of batch) {
          const boxId = item.id;
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
              id, box_number, display_size, title, raw_text, category, notes,
              source, verification, stock_quantity, stock_count_verified,
              units_sold, variants, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              box_number = excluded.box_number,
              display_size = excluded.display_size,
              title = excluded.title,
              raw_text = excluded.raw_text,
              category = excluded.category,
              notes = excluded.notes,
              source = excluded.source,
              verification = excluded.verification,
              stock_quantity = excluded.stock_quantity,
              stock_count_verified = excluded.stock_count_verified,
              units_sold = excluded.units_sold,
              variants = excluded.variants,
              updated_at = CURRENT_TIMESTAMP`,
            args: [
              boxId,
              item.boxNumber,
              item.displaySize || "Unknown",
              item.title || "",
              (item.compatibleModels || []).join(" | "),
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

          for (const m of item.compatibleModels || []) {
            if (m && m.trim()) {
              statements.push({
                sql: "INSERT INTO models (id, box_id, model_name) VALUES (?, ?, ?)",
                args: [uuidv4(), boxId, m.trim()],
              });
            }
          }
        }
        await localClient.batch(statements, "write");
      }
      console.log(`✓ Synchronized ${dbName} (${seedBoxes.length} boxes).`);
    } catch (err) {
      console.error(`⚠️ Failed to update ${dbName}:`, err);
    }
  }

  console.log("\n=== Universal Compatibility Enrichment Complete! ===");
}

main().catch((err) => {
  console.error("Enrichment fatal error:", err);
  process.exit(1);
});
