import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { InStatement } from "@libsql/client";
import { turso } from "@/lib/turso";

export const dynamic = "force-dynamic";

/**
 * RFC-4180 compliant CSV parser that correctly handles quoted strings containing commas.
 */
function parseCSV(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.replace(/^["']|["']$/g, "").trim());
  const records: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || !row.some((cell) => cell.length > 0)) continue;
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = row[idx] ? row[idx].replace(/^["']|["']$/g, "").trim() : "";
    });
    records.push(record);
  }

  return records;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No CSV file provided. Please attach a CSV file." },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const records = parseCSV(csvText);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "The uploaded CSV file contains no data rows." },
        { status: 400 }
      );
    }

    // 1. Fetch all existing box numbers from Turso to prevent duplicates
    const existingRes = await turso.execute("SELECT id, box_number FROM boxes");
    const existingBoxNumbers = new Set<string>();
    const existingIds = new Set<string>();

    for (const row of existingRes.rows) {
      if (row.box_number) {
        existingBoxNumbers.add(String(row.box_number).trim().toUpperCase());
      }
      if (row.id) {
        existingIds.add(String(row.id).trim().toLowerCase());
      }
    }

    const batchStatements: InStatement[] = [];
    const seenBatchNumbers = new Set<string>();
    const validationErrors: string[] = [];

    let boxesAdded = 0;
    let modelsAdded = 0;

    // 2. Validate and prepare each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +1 for 0-index, +1 for header line

      // Extract required fields
      const title = (
        row["Box Title / Main Model"] ||
        row["Box Title"] ||
        row["title"] ||
        row["Title"] ||
        ""
      ).trim();

      const models = (
        row["Compatible Models"] ||
        row["compatible_models"] ||
        row["Models"] ||
        ""
      ).trim();

      const size = (
        row["Display Size"] ||
        row["display_size"] ||
        row["Size"] ||
        ""
      ).trim();

      const stock = (
        row["Initial Stock"] ||
        row["stock"] ||
        row["Stock Quantity"] ||
        ""
      ).trim();

      // Strict skip rule: If !title && !models && !size && !stock, VOID/SKIP this row completely.
      // Do not create a box, do not reserve the box number, and do not execute any database write for it.
      if (!title && !models && !size && !stock) {
        continue;
      }

      // Only process and insert rows that have at least a title or models defined
      if (!title && !models) {
        continue;
      }

      const rawBoxNum = (
        row["Box Number"] ||
        row["box_number"] ||
        row["Box #"] ||
        row["boxNumber"] ||
        ""
      ).trim();

      if (!rawBoxNum) {
        validationErrors.push(`Row ${rowNumber}: Box Number is required.`);
        continue;
      }

      // Normalize Box Number: e.g. "134" -> "BOX 134", or "BOX 134" -> "BOX 134"
      const normalizedBoxNumber = rawBoxNum.toUpperCase().startsWith("BOX")
        ? rawBoxNum.toUpperCase()
        : `BOX ${rawBoxNum}`;

      // Check for duplication against existing database
      if (existingBoxNumbers.has(normalizedBoxNumber)) {
        validationErrors.push(
          `Row ${rowNumber}: ${normalizedBoxNumber} already exists in the database.`
        );
        continue;
      }

      // Check for duplication within the uploaded file itself
      if (seenBatchNumbers.has(normalizedBoxNumber)) {
        validationErrors.push(
          `Row ${rowNumber}: ${normalizedBoxNumber} is duplicated within the CSV file.`
        );
        continue;
      }
      seenBatchNumbers.add(normalizedBoxNumber);

      const finalTitle = title || models.split(",")[0]?.trim() || normalizedBoxNumber;
      const displaySize = size || "Unknown";

      // Parse Initial Stock
      const stockQty = Math.max(0, parseInt(stock, 10) || 0);

      // Normalize Physical Stock Verified into 1 or 0 boolean
      const rawVerified =
        row["Physical Stock Verified"] ||
        row["verified"] ||
        row["Stock Verified"] ||
        "";
      const isVerified = /^(1|true|yes|y)$/i.test(String(rawVerified).trim()) ? 1 : 0;

      // Parse Compatible Models
      const compatibleModels = models
        ? models.split(",").map((m) => m.trim()).filter(Boolean)
        : [finalTitle];

      // Generate unique box id
      const digitsMatch = normalizedBoxNumber.match(/\d+/);
      const suffix = digitsMatch ? digitsMatch[0] : uuidv4().slice(0, 8);
      let boxId = `box-${suffix}`;
      if (existingIds.has(boxId.toLowerCase())) {
        boxId = `SD-NEW-${Date.now()}-${i}`;
      }
      existingIds.add(boxId.toLowerCase());

      // 3. Batch statement for `boxes` table
      batchStatements.push({
        sql: `INSERT INTO boxes (
          id,
          box_number,
          display_size,
          title,
          category,
          stock_quantity,
          stock_count_verified,
          units_sold,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'Super-D', ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [boxId, normalizedBoxNumber, displaySize, finalTitle, stockQty, isVerified],
      });
      boxesAdded++;

      // 4. Batch statements for child `models` table
      for (const modelName of compatibleModels) {
        batchStatements.push({
          sql: `INSERT INTO models (id, box_id, model_name, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          args: [uuidv4(), boxId, modelName],
        });
        modelsAdded++;
      }

      // 5. Initial stock transaction audit log if stock was specified
      if (stockQty > 0 || isVerified === 1) {
        batchStatements.push({
          sql: `INSERT INTO inventory_transactions (
            id,
            group_id,
            transaction_type,
            quantity_change,
            previous_quantity,
            new_quantity,
            box_number,
            note,
            created_at
          ) VALUES (?, ?, 'INITIAL_STOCK', ?, 0, ?, ?, 'Bulk CSV Import initial stock', CURRENT_TIMESTAMP)`,
          args: [uuidv4(), boxId, stockQty, stockQty, normalizedBoxNumber],
        });
      }
    }

    // If there were critical validation errors and no valid boxes could be parsed
    if (boxesAdded === 0 && validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV validation failed. No boxes were imported.",
          validationErrors,
        },
        { status: 400 }
      );
    }

    // Execute single atomic transaction in Turso
    if (batchStatements.length > 0) {
      await turso.batch(batchStatements, "write");
    }

    return NextResponse.json({
      success: true,
      boxesAdded,
      modelsAdded,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to import boxes";
    console.error("[api/admin/boxes/bulk-import] Error:", msg);
    return NextResponse.json(
      { error: "Failed to process bulk import", details: msg },
      { status: 500 }
    );
  }
}
