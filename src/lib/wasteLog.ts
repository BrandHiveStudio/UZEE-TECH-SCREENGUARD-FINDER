import { turso } from "./turso";
import { v4 as uuidv4 } from "uuid";
import type { Box, ScreenGuardVariants } from "@/types/screenguard";
import { VariantKey, normalizeVariants, calculateTotalStock } from "./screenguard";
import { getAllBoxes, upsertBox } from "./db";

export type WasteReason =
  | "INSTALLATION_BUBBLE"
  | "CRACKED_ON_APPLICATION"
  | "CUSTOMER_RETURN_DEFECT"
  | "SUPPLIER_DEAD_ON_ARRIVAL";

export const WASTE_REASON_META: Record<
  WasteReason,
  { label: string; icon: string; description: string }
> = {
  INSTALLATION_BUBBLE: {
    label: "Installation Bubble / Dust Trap",
    icon: "🫧",
    description: "Dust particles or trapped air during counter application",
  },
  CRACKED_ON_APPLICATION: {
    label: "Cracked During Application",
    icon: "💥",
    description: "Glass fractured or corner snapped during pressure wipe",
  },
  CUSTOMER_RETURN_DEFECT: {
    label: "Customer Return Defect",
    icon: "🔄",
    description: "Adhesive failure or glass deformity returned by customer",
  },
  SUPPLIER_DEAD_ON_ARRIVAL: {
    label: "Supplier Dead-On-Arrival (DOA)",
    icon: "📦",
    description: "Arrived cracked, scratched, or missing glue in carton",
  },
};

export interface WasteLogEntry {
  id: string;
  boxNumber: string;
  boxId: string;
  modelName: string;
  variant: VariantKey;
  quantity: number;
  reason: WasteReason;
  technicianNotes?: string;
  timestamp: number;
  recordedBy?: string;
}

export interface WasteStats {
  totalWastedUnits: number;
  byReason: Record<WasteReason, number>;
  byVariant: Record<VariantKey, number>;
  topWastedBoxes: Array<{ boxNumber: string; title: string; count: number }>;
}

let _wasteTableEnsured = false;

export async function ensureWasteLogsTable(): Promise<void> {
  if (_wasteTableEnsured) return;
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS waste_logs (
        id TEXT PRIMARY KEY,
        box_number TEXT NOT NULL,
        box_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        variant TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reason TEXT NOT NULL,
        technician_notes TEXT,
        timestamp INTEGER NOT NULL,
        recorded_by TEXT
      )
    `);
    _wasteTableEnsured = true;
  } catch (e) {
    console.error("Failed to ensure waste_logs table", e);
  }
}

/**
 * Records a waste event, atomically deducting stock from the target box variant in the database.
 */
export async function recordWasteEvent(entry: {
  boxNumber: string;
  variant: VariantKey;
  quantity: number;
  reason: WasteReason;
  modelName?: string;
  technicianNotes?: string;
  recordedBy?: string;
}): Promise<{ success: boolean; log: WasteLogEntry; updatedBox: Box }> {
  await ensureWasteLogsTable();

  const allBoxes = await getAllBoxes();
  const normalizedNum = entry.boxNumber.trim().toLowerCase();
  const targetBox = allBoxes.find(
    (b) => b.boxNumber.trim().toLowerCase() === normalizedNum
  );

  if (!targetBox) {
    throw new Error(`Box ${entry.boxNumber} was not found in inventory.`);
  }

  const prevVars = normalizeVariants(targetBox.variants, targetBox.stockQuantity ?? 0);
  const currentVarStock = prevVars[entry.variant] ?? 0;

  if (currentVarStock < entry.quantity) {
    throw new Error(
      `Insufficient stock in ${targetBox.boxNumber} (${entry.variant}). Available: ${currentVarStock}, requested: ${entry.quantity}`
    );
  }

  // Deduct variant stock
  const updatedVars: ScreenGuardVariants = {
    ...prevVars,
    [entry.variant]: Math.max(0, currentVarStock - entry.quantity),
  };
  const newTotal = calculateTotalStock(updatedVars);

  const updatedBox: Box = {
    ...targetBox,
    variants: updatedVars,
    stockQuantity: newTotal,
    stockCountVerified: true,
    stockStatus: newTotal > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
  };

  // Upsert updated box in DB
  const savedBox = await upsertBox(updatedBox);

  // Write waste log record
  const logId = `waste-${uuidv4().substring(0, 8)}`;
  const now = Date.now();
  const modelName =
    entry.modelName ||
    (targetBox.compatibleModels && targetBox.compatibleModels[0]) ||
    targetBox.title;

  await turso.execute({
    sql: `INSERT INTO waste_logs (
      id, box_number, box_id, model_name, variant, quantity, reason, technician_notes, timestamp, recorded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      logId,
      targetBox.boxNumber,
      targetBox.id,
      modelName,
      entry.variant,
      entry.quantity,
      entry.reason,
      entry.technicianNotes || "",
      now,
      entry.recordedBy || "Counter Staff",
    ],
  });

  const log: WasteLogEntry = {
    id: logId,
    boxNumber: targetBox.boxNumber,
    boxId: targetBox.id,
    modelName,
    variant: entry.variant,
    quantity: entry.quantity,
    reason: entry.reason,
    technicianNotes: entry.technicianNotes,
    timestamp: now,
    recordedBy: entry.recordedBy || "Counter Staff",
  };

  return { success: true, log, updatedBox: savedBox };
}

/**
 * Retrieves all waste logs ordered newest to oldest.
 */
export async function getAllWasteLogs(limit = 100): Promise<WasteLogEntry[]> {
  await ensureWasteLogsTable();
  try {
    const res = await turso.execute({
      sql: `SELECT id, box_number, box_id, model_name, variant, quantity, reason, technician_notes, timestamp, recorded_by
            FROM waste_logs ORDER BY timestamp DESC LIMIT ?`,
      args: [limit],
    });

    return res.rows.map((row) => ({
      id: String(row.id),
      boxNumber: String(row.box_number),
      boxId: String(row.box_id),
      modelName: String(row.model_name),
      variant: String(row.variant) as VariantKey,
      quantity: Number(row.quantity),
      reason: String(row.reason) as WasteReason,
      technicianNotes: row.technician_notes ? String(row.technician_notes) : undefined,
      timestamp: Number(row.timestamp),
      recordedBy: row.recorded_by ? String(row.recorded_by) : undefined,
    }));
  } catch (e) {
    console.error("Failed to query waste_logs", e);
    return [];
  }
}

/**
 * Computes aggregated shrinkage metrics.
 */
export async function getWasteStats(): Promise<WasteStats> {
  const logs = await getAllWasteLogs(500);

  let totalWastedUnits = 0;
  const byReason: Record<WasteReason, number> = {
    INSTALLATION_BUBBLE: 0,
    CRACKED_ON_APPLICATION: 0,
    CUSTOMER_RETURN_DEFECT: 0,
    SUPPLIER_DEAD_ON_ARRIVAL: 0,
  };
  const byVariant: Record<VariantKey, number> = {
    super_d: 0,
    privacy: 0,
    matte: 0,
    borderless: 0,
  };
  const boxCounter: Record<string, { boxNumber: string; title: string; count: number }> = {};

  for (const log of logs) {
    totalWastedUnits += log.quantity;

    if (byReason[log.reason] !== undefined) {
      byReason[log.reason] += log.quantity;
    }

    if (byVariant[log.variant] !== undefined) {
      byVariant[log.variant] += log.quantity;
    }

    if (!boxCounter[log.boxNumber]) {
      boxCounter[log.boxNumber] = {
        boxNumber: log.boxNumber,
        title: log.modelName,
        count: 0,
      };
    }
    boxCounter[log.boxNumber].count += log.quantity;
  }

  const topWastedBoxes = Object.values(boxCounter)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalWastedUnits,
    byReason,
    byVariant,
    topWastedBoxes,
  };
}

