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

import { createClient, type InStatement } from "@libsql/client";
import { turso } from "../src/lib/turso";

export function formatStandardBoxNumber(rawBoxNumber: string): string {
  const match = rawBoxNumber.match(/\d+/);
  if (!match) return rawBoxNumber;
  const padded = match[0].padStart(3, "0");
  return `BOX ${padded} PRIVACY/CLEAR/MATTE/BORDERLESS`;
}

async function main() {
  console.log("=== Standardizing All Box Numbers to 'BOX XXX PRIVACY/CLEAR/MATTE/BORDERLESS' ===");
  const root = process.cwd();

  // 1. Update new_screenguard_seed.json
  const seedJsonPath = path.join(root, "new_screenguard_seed.json");
  if (fs.existsSync(seedJsonPath)) {
    const seedBoxes = JSON.parse(fs.readFileSync(seedJsonPath, "utf-8"));
    let updatedCount = 0;
    for (const box of seedBoxes) {
      const oldBoxNumber = box.boxNumber;
      box.boxNumber = formatStandardBoxNumber(oldBoxNumber);
      updatedCount++;
    }
    fs.writeFileSync(seedJsonPath, JSON.stringify(seedBoxes, null, 2), "utf-8");
    console.log(`✓ Updated ${updatedCount} boxes in new_screenguard_seed.json`);
  }

  // 2. Update src/data/screenguards.json
  const dataJsonPath = path.join(root, "src", "data", "screenguards.json");
  if (fs.existsSync(dataJsonPath)) {
    const dataObj = JSON.parse(fs.readFileSync(dataJsonPath, "utf-8"));
    const boxes = dataObj.boxes || dataObj;
    let updatedCount = 0;
    for (const box of boxes) {
      box.boxNumber = formatStandardBoxNumber(box.boxNumber);
      updatedCount++;
    }
    fs.writeFileSync(dataJsonPath, JSON.stringify(dataObj, null, 2), "utf-8");
    console.log(`✓ Updated ${updatedCount} boxes in src/data/screenguards.json`);
  }

  // 3. Update new_screenguard_seed.csv
  const seedCsvPath = path.join(root, "new_screenguard_seed.csv");
  if (fs.existsSync(seedCsvPath)) {
    const csvContent = fs.readFileSync(seedCsvPath, "utf-8");
    const lines = csvContent.split(/\r?\n/);
    if (lines.length > 0) {
      const header = lines[0];
      const newLines = [header];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        // The second column is Box Number
        // E.g.: box-001,BOX 001,"4.7""",iPhone 6,...
        // Replace BOX \d+ with BOX XXX PRIVACY/CLEAR/MATTE/BORDERLESS
        const updatedLine = line.replace(/,(BOX\s*\d+[^,]*),/i, (m, p1) => {
          return `,${formatStandardBoxNumber(p1)},`;
        });
        newLines.push(updatedLine);
      }
      fs.writeFileSync(seedCsvPath, newLines.join("\n"), "utf-8");
      console.log(`✓ Updated ${newLines.length - 1} rows in new_screenguard_seed.csv`);
    }
  }

  // 4. Update Turso Cloud Database
  console.log("\nUpdating Turso Cloud Database...");
  try {
    const boxesRes = await turso.execute("SELECT id, box_number FROM boxes");
    console.log(`Found ${boxesRes.rows.length} boxes in Turso database.`);
    const statements: InStatement[] = [];
    for (const row of boxesRes.rows) {
      const id = String(row.id);
      const oldBoxNumber = String(row.box_number);
      const newBoxNumber = formatStandardBoxNumber(oldBoxNumber);
      if (oldBoxNumber !== newBoxNumber) {
        statements.push({
          sql: "UPDATE boxes SET box_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          args: [newBoxNumber, id],
        });
      }
    }
    if (statements.length > 0) {
      // Execute in chunks of 50
      for (let i = 0; i < statements.length; i += 50) {
        const chunk = statements.slice(i, i + 50);
        await turso.batch(chunk, "write");
      }
      console.log(`✓ Updated ${statements.length} boxes in Turso Cloud Database.`);
    } else {
      console.log("✓ Turso Cloud Database already standardized.");
    }
  } catch (err) {
    console.error("⚠️ Failed to update Turso Cloud Database:", err);
  }

  // 5. Update local SQLite databases: local.db and screenguards.db
  for (const dbName of ["local.db", "screenguards.db"]) {
    const dbFilePath = path.join(root, dbName);
    if (!fs.existsSync(dbFilePath)) continue;
    console.log(`\nUpdating ${dbName}...`);
    try {
      const localClient = createClient({ url: `file:${dbFilePath}` });
      const boxesRes = await localClient.execute("SELECT id, box_number FROM boxes");
      const statements: InStatement[] = [];
      for (const row of boxesRes.rows) {
        const id = String(row.id);
        const oldBoxNumber = String(row.box_number);
        const newBoxNumber = formatStandardBoxNumber(oldBoxNumber);
        if (oldBoxNumber !== newBoxNumber) {
          statements.push({
            sql: "UPDATE boxes SET box_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            args: [newBoxNumber, id],
          });
        }
      }
      if (statements.length > 0) {
        for (let i = 0; i < statements.length; i += 50) {
          const chunk = statements.slice(i, i + 50);
          await localClient.batch(chunk, "write");
        }
        console.log(`✓ Updated ${statements.length} boxes in ${dbName}.`);
      } else {
        console.log(`✓ ${dbName} already standardized.`);
      }
    } catch (err) {
      console.error(`⚠️ Failed to update ${dbName}:`, err);
    }
  }

  console.log("\n=== Standardization Complete! ===");
}

main().catch((e) => {
  console.error("Migration fatal error:", e);
  process.exit(1);
});
