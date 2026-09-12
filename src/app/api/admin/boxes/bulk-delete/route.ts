import { NextResponse } from "next/server";
import { turso } from "@/lib/turso";
import { InStatement } from "@libsql/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromBox, toBox } = body;

    const from = parseInt(String(fromBox), 10);
    const to = parseInt(String(toBox), 10);

    if (isNaN(from) || isNaN(to) || from <= 0 || to <= 0) {
      return NextResponse.json(
        { error: "Please provide valid positive numbers for From Box and To Box." },
        { status: 400 }
      );
    }

    const minBox = Math.min(from, to);
    const maxBox = Math.max(from, to);

    // 1. Fetch all boxes to find ones whose numerical box_number is between minBox and maxBox (inclusive)
    const res = await turso.execute("SELECT id, box_number FROM boxes");
    const targetBoxes: { id: string; boxNumber: string; num: number }[] = [];

    for (const row of res.rows) {
      const boxNumStr = String(row.box_number || "");
      const match = boxNumStr.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num >= minBox && num <= maxBox) {
          targetBoxes.push({
            id: String(row.id),
            boxNumber: boxNumStr,
            num,
          });
        }
      }
    }

    if (targetBoxes.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: `No boxes found between #${minBox} and #${maxBox}.`,
      });
    }

    // 2. Build transactional batch delete statements
    const batchStatements: InStatement[] = [];

    for (const box of targetBoxes) {
      // Delete child models
      batchStatements.push({
        sql: "DELETE FROM models WHERE box_id = ?",
        args: [box.id],
      });

      // Delete child inventory transactions
      batchStatements.push({
        sql: "DELETE FROM inventory_transactions WHERE group_id = ?",
        args: [box.id],
      });

      // Delete from purchase list if present
      batchStatements.push({
        sql: "DELETE FROM purchase_list WHERE group_id = ?",
        args: [box.id],
      });

      // Delete the box record
      batchStatements.push({
        sql: "DELETE FROM boxes WHERE id = ?",
        args: [box.id],
      });
    }

    // 3. Execute transactional batch delete (chunked for payload safety)
    const CHUNK_SIZE = 250;
    for (let i = 0; i < batchStatements.length; i += CHUNK_SIZE) {
      const chunk = batchStatements.slice(i, i + CHUNK_SIZE);
      await turso.batch(chunk, "write");
    }

    console.log(
      `[BULK-DELETE] Successfully deleted ${targetBoxes.length} boxes between #${minBox} and #${maxBox}.`
    );

    return NextResponse.json({
      success: true,
      deletedCount: targetBoxes.length,
    });
  } catch (error) {
    console.error("[BULK-DELETE] Error executing bulk delete:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while deleting boxes.",
      },
      { status: 500 }
    );
  }
}
