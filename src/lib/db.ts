import { turso } from "./turso";
import { v4 as uuidv4 } from "uuid";
import type { InStatement } from "@libsql/client";
import type { Box, InventoryTransaction, PurchaseItem } from "@/types/screenguard";

export function deriveStockStatus(
  quantity: number,
  verified = false,
  lowStockThreshold = 3
): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_COUNTED" {
  if (!verified) return "NOT_COUNTED";
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

// ─── Data Access Layer (Turso Normalized Boxes + Models + Inventory) ────────

/** Fetch all boxes with their compatible models via 1-to-many join */
export async function getAllBoxes(): Promise<Box[]> {
  try {
    // 1. Query all boxes
    const boxesRes = await turso.execute(
      `SELECT
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
        stock_count_verified
      FROM boxes
      ORDER BY box_number ASC`
    );

    // 2. Query all compatible models
    const modelsRes = await turso.execute(
      `SELECT box_id, model_name FROM models ORDER BY id ASC`
    );

    const modelsMap = new Map<string, string[]>();
    for (const row of modelsRes.rows) {
      const boxId = String(row.box_id);
      const modelName = String(row.model_name);
      const existing = modelsMap.get(boxId);
      if (existing) {
        existing.push(modelName);
      } else {
        modelsMap.set(boxId, [modelName]);
      }
    }

    return boxesRes.rows.map((row) => {
      const stockQty = Math.max(0, Number(row.stock_quantity ?? 0));
      const stockVerified = Boolean(row.stock_count_verified);
      const id = String(row.id);

      return {
        id,
        boxNumber: String(row.box_number),
        displaySize: String(row.display_size ?? "Unknown"),
        title: String(row.title ?? ""),
        compatibleModels: modelsMap.get(id) || [],
        rawText: row.raw_text ? String(row.raw_text) : undefined,
        category: row.category ? String(row.category) : "Super-D",
        notes: row.notes ? String(row.notes) : undefined,
        source: row.source ? String(row.source) : undefined,
        verification: row.verification ? String(row.verification) : undefined,
        stockQuantity: stockQty,
        stockCountVerified: stockVerified,
        stockStatus: deriveStockStatus(stockQty, stockVerified),
      };
    });
  } catch (error) {
    console.error("[db] Turso query failed, using emergency fallback to local JSON data:", error);
    const jsonModule = await import("@/data/screenguards.json");
    const jsonBoxes = (jsonModule.default.boxes || jsonModule.boxes) as Box[];
    return jsonBoxes.map((b) => {
      const qty = Math.max(0, b.stockQuantity ?? 0);
      const ver = b.stockCountVerified ?? false;
      return {
        ...b,
        stockQuantity: qty,
        stockCountVerified: ver,
        stockStatus: deriveStockStatus(qty, ver),
      };
    });
  }
}

/** Insert or update a box and its models atomically in Turso */
export async function upsertBox(box: Box): Promise<Box> {
  const stockQty = Math.max(0, box.stockQuantity ?? 0);
  const stockVer = box.stockCountVerified ?? false;

  // Check if box already exists in database
  const existingRes = await turso.execute({
    sql: "SELECT id, stock_quantity FROM boxes WHERE id = ?",
    args: [box.id],
  });
  const isNew = existingRes.rows.length === 0;

  const batchStatements: InStatement[] = [
    {
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
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
        updated_at = CURRENT_TIMESTAMP`,
      args: [
        box.id,
        box.boxNumber,
        box.displaySize || "Unknown",
        box.title || "",
        box.rawText ?? null,
        box.category ?? "Super-D",
        box.notes ?? null,
        box.source ?? null,
        box.verification ?? null,
        stockQty,
        stockVer ? 1 : 0,
      ],
    },
    {
      sql: "DELETE FROM models WHERE box_id = ?",
      args: [box.id],
    },
  ];

  if (Array.isArray(box.compatibleModels)) {
    for (const model of box.compatibleModels) {
      if (model && model.trim()) {
        batchStatements.push({
          sql: "INSERT INTO models (id, box_id, model_name) VALUES (?, ?, ?)",
          args: [uuidv4(), box.id, model.trim()],
        });
      }
    }
  }

  // If this is a brand new box with initial stock, log an INITIAL_STOCK transaction
  if (isNew && (stockQty > 0 || stockVer)) {
    batchStatements.push({
      sql: `INSERT INTO inventory_transactions (
        id,
        group_id,
        transaction_type,
        quantity_change,
        previous_quantity,
        new_quantity,
        box_number,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuidv4(),
        box.id,
        "INITIAL_STOCK",
        stockQty,
        0,
        stockQty,
        box.boxNumber,
        "Initial stock setup",
      ],
    });
  }

  // Execute atomic write transaction
  await turso.batch(batchStatements, "write");

  return {
    ...box,
    displaySize: box.displaySize || "Unknown",
    stockQuantity: stockQty,
    stockCountVerified: stockVer,
    stockStatus: deriveStockStatus(stockQty, stockVer),
  };
}

/** Delete a box by id (cascades to models and transactions) */
export async function deleteBox(id: string): Promise<void> {
  const result = await turso.execute({
    sql: "DELETE FROM boxes WHERE id = ?",
    args: [id],
  });

  if (result.rowsAffected === 0) {
    console.warn(`[db] deleteBox: No box found with id ${id}`);
  }
}

// ─── Inventory Management Data Access Functions ──────────────────────────────

/** Update stock for a group (SALE, RESTOCK, ADJUSTMENT) */
export async function updateStock(
  groupId: string,
  action: "SALE" | "RESTOCK" | "ADJUSTMENT",
  amountOrChange: number,
  note?: string
): Promise<Box> {
  const boxRes = await turso.execute({
    sql: "SELECT * FROM boxes WHERE id = ?",
    args: [groupId],
  });

  if (boxRes.rows.length === 0) {
    throw new Error(`Group '${groupId}' not found`);
  }

  const boxRow = boxRes.rows[0];
  const prevQty = Number(boxRow.stock_quantity ?? 0);
  let newQty = prevQty;
  let qtyChange = 0;

  if (action === "SALE") {
    qtyChange = -1;
    newQty = prevQty - 1;
  } else if (action === "RESTOCK") {
    qtyChange = Math.max(1, Math.floor(amountOrChange));
    newQty = prevQty + qtyChange;
  } else if (action === "ADJUSTMENT") {
    if (amountOrChange < 0) {
      throw new Error(`Stock quantity cannot be set to a negative number (${amountOrChange})`);
    }
    newQty = Math.floor(amountOrChange);
    qtyChange = newQty - prevQty;
  }

  if (newQty < 0) {
    throw new Error(`Stock quantity cannot be negative (current: ${prevQty}, attempted change: ${qtyChange})`);
  }

  const txId = uuidv4();
  const txNote = note || (action === "SALE" ? "Customer sale" : action === "RESTOCK" ? "Restock added" : "Physical stock count adjustment");

  // Atomic batch: update boxes table and insert audit log into inventory_transactions
  await turso.batch(
    [
      {
        sql: `UPDATE boxes SET stock_quantity = ?, stock_count_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [newQty, groupId],
      },
      {
        sql: `INSERT INTO inventory_transactions (
          id,
          group_id,
          transaction_type,
          quantity_change,
          previous_quantity,
          new_quantity,
          box_number,
          note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          txId,
          groupId,
          action,
          qtyChange,
          prevQty,
          newQty,
          String(boxRow.box_number),
          txNote,
        ],
      },
    ],
    "write"
  );

  // Fetch models for returning the complete Box object
  const modelsRes = await turso.execute({
    sql: "SELECT model_name FROM models WHERE box_id = ?",
    args: [groupId],
  });
  const compatibleModels = modelsRes.rows.map((r) => String(r.model_name));

  return {
    id: groupId,
    boxNumber: String(boxRow.box_number),
    displaySize: String(boxRow.display_size ?? "Unknown"),
    title: String(boxRow.title ?? ""),
    compatibleModels,
    rawText: boxRow.raw_text ? String(boxRow.raw_text) : undefined,
    category: boxRow.category ? String(boxRow.category) : "Super-D",
    notes: boxRow.notes ? String(boxRow.notes) : undefined,
    source: boxRow.source ? String(boxRow.source) : undefined,
    verification: boxRow.verification ? String(boxRow.verification) : undefined,
    stockQuantity: newQty,
    stockCountVerified: true,
    stockStatus: deriveStockStatus(newQty, true),
  };
}

/** Get inventory history for a group or all groups */
export async function getInventoryHistory(groupId?: string): Promise<InventoryTransaction[]> {
  const sql = groupId
    ? "SELECT * FROM inventory_transactions WHERE group_id = ? ORDER BY created_at DESC, rowid DESC"
    : "SELECT * FROM inventory_transactions ORDER BY created_at DESC, rowid DESC";
  const args = groupId ? [groupId] : [];

  const res = await turso.execute({ sql, args });

  return res.rows.map((t) => ({
    id: String(t.id),
    groupId: String(t.group_id),
    transactionType: t.transaction_type as "SALE" | "RESTOCK" | "ADJUSTMENT" | "INITIAL_STOCK",
    quantityChange: Number(t.quantity_change),
    previousQuantity: Number(t.previous_quantity),
    newQuantity: Number(t.new_quantity),
    boxNumber: String(t.box_number),
    note: t.note ? String(t.note) : undefined,
    createdAt: String(t.created_at),
  }));
}

/** Get current Purchase List items */
export async function getPurchaseList(): Promise<PurchaseItem[]> {
  const res = await turso.execute(`
    SELECT
      p.id,
      p.group_id,
      p.requested_quantity,
      p.status,
      p.note,
      p.created_at,
      p.updated_at,
      b.box_number,
      b.title,
      b.stock_quantity
    FROM purchase_list p
    LEFT JOIN boxes b ON p.group_id = b.id
    ORDER BY p.created_at DESC, p.rowid DESC
  `);

  if (res.rows.length === 0) {
    return [];
  }

  // Fetch models for these boxes
  const modelsRes = await turso.execute("SELECT box_id, model_name FROM models");
  const modelsMap = new Map<string, string[]>();
  for (const row of modelsRes.rows) {
    const boxId = String(row.box_id);
    const model = String(row.model_name);
    const existing = modelsMap.get(boxId);
    if (existing) {
      existing.push(model);
    } else {
      modelsMap.set(boxId, [model]);
    }
  }

  return res.rows.map((p) => {
    const groupId = String(p.group_id);
    return {
      id: String(p.id),
      groupId,
      boxNumber: p.box_number ? String(p.box_number) : groupId,
      title: p.title ? String(p.title) : "",
      compatibleModels: modelsMap.get(groupId) || [],
      currentQuantity: Number(p.stock_quantity ?? 0),
      requestedQuantity: Number(p.requested_quantity),
      status: p.status as "NEEDS ORDER" | "ORDERED" | "RECEIVED" | "CANCELLED",
      note: p.note ? String(p.note) : undefined,
      createdAt: String(p.created_at),
      updatedAt: String(p.updated_at),
    };
  });
}

/** Add a group to Purchase List */
export async function addToPurchaseList(
  groupId: string,
  requestedQuantity = 1,
  note?: string
): Promise<PurchaseItem> {
  const existingRes = await turso.execute({
    sql: "SELECT * FROM purchase_list WHERE group_id = ? AND status NOT IN ('RECEIVED', 'CANCELLED') LIMIT 1",
    args: [groupId],
  });

  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    const newRequestedQuantity = Number(existing.requested_quantity) + requestedQuantity;
    const finalNote = note || (existing.note ? String(existing.note) : undefined);

    await turso.execute({
      sql: `UPDATE purchase_list
            SET requested_quantity = ?, note = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [newRequestedQuantity, finalNote ?? null, String(existing.id)],
    });

    const boxRes = await turso.execute({
      sql: "SELECT box_number, title, stock_quantity FROM boxes WHERE id = ?",
      args: [groupId],
    });
    const box = boxRes.rows[0];

    return {
      id: String(existing.id),
      groupId,
      boxNumber: box ? String(box.box_number) : groupId,
      title: box ? String(box.title) : "",
      currentQuantity: box ? Number(box.stock_quantity ?? 0) : 0,
      requestedQuantity: newRequestedQuantity,
      status: existing.status as "NEEDS ORDER" | "ORDERED" | "RECEIVED" | "CANCELLED",
      note: finalNote,
      createdAt: String(existing.created_at),
      updatedAt: new Date().toISOString(),
    };
  }

  const newId = uuidv4();
  const reqQty = Math.max(1, requestedQuantity);
  const itemNote = note || "Reorder requested";

  await turso.execute({
    sql: `INSERT INTO purchase_list (
      id, group_id, requested_quantity, status, note, created_at, updated_at
    ) VALUES (?, ?, ?, 'NEEDS ORDER', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [newId, groupId, reqQty, itemNote],
  });

  const boxRes = await turso.execute({
    sql: "SELECT box_number, title, stock_quantity FROM boxes WHERE id = ?",
    args: [groupId],
  });
  const box = boxRes.rows[0];

  return {
    id: newId,
    groupId,
    boxNumber: box ? String(box.box_number) : groupId,
    title: box ? String(box.title) : "",
    currentQuantity: box ? Number(box.stock_quantity ?? 0) : 0,
    requestedQuantity: reqQty,
    status: "NEEDS ORDER",
    note: itemNote,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Update status of a purchase list item */
export async function updatePurchaseStatus(
  purchaseId: string,
  status: "NEEDS ORDER" | "ORDERED" | "RECEIVED" | "CANCELLED",
  note?: string
): Promise<PurchaseItem> {
  const itemRes = await turso.execute({
    sql: `SELECT p.*, b.box_number, b.title, b.stock_quantity
          FROM purchase_list p
          LEFT JOIN boxes b ON p.group_id = b.id
          WHERE p.id = ?`,
    args: [purchaseId],
  });

  if (itemRes.rows.length === 0) {
    throw new Error(`Purchase item '${purchaseId}' not found`);
  }

  const row = itemRes.rows[0];
  const finalNote = note || (row.note ? String(row.note) : undefined);
  const requestedQuantity = Number(row.requested_quantity);
  const groupId = String(row.group_id);

  await turso.execute({
    sql: "UPDATE purchase_list SET status = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [status, finalNote ?? null, purchaseId],
  });

  // If status is RECEIVED, automatically execute RESTOCK for requested quantity
  if (status === "RECEIVED" && requestedQuantity > 0) {
    await updateStock(
      groupId,
      "RESTOCK",
      requestedQuantity,
      `Auto-restocked from Purchase Order (ID: ${purchaseId})`
    );
  }

  return {
    id: purchaseId,
    groupId,
    boxNumber: row.box_number ? String(row.box_number) : groupId,
    title: row.title ? String(row.title) : "",
    currentQuantity: Number(row.stock_quantity ?? 0),
    requestedQuantity,
    status,
    note: finalNote,
    createdAt: String(row.created_at),
    updatedAt: new Date().toISOString(),
  };
}

/** Save bulk stock counts from Stock Count Mode */
export async function saveBulkStockCounts(
  counts: { groupId: string; quantity: number }[]
): Promise<number> {
  let countSaved = 0;
  for (const item of counts) {
    if (typeof item.quantity === "number" && item.quantity >= 0) {
      await updateStock(item.groupId, "ADJUSTMENT", item.quantity, "Stock Count Mode verification");
      countSaved++;
    }
  }
  return countSaved;
}
