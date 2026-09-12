import { NextResponse } from "next/server";
import { turso } from "@/lib/turso";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Query Turso for all existing box numbers
    const res = await turso.execute("SELECT box_number, id FROM boxes");

    let maxBox = 0;
    for (const row of res.rows) {
      const boxNum = String(row.box_number || "");
      const match = boxNum.match(/\d+/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (!isNaN(val) && val > maxBox) {
          maxBox = val;
        }
      }
    }

    const startBox = maxBox > 0 ? maxBox + 1 : 132;

    // Headers as specified
    const headers = [
      "Box Number",
      "Box Title",
      "Display Size",
      "Initial Stock",
      "Physical Stock Verified",
      "Compatible Models",
    ];

    const lines: string[] = [headers.join(",")];

    // Generate 50 prefilled sequential box numbers starting from (maxBox + 1)
    for (let i = 0; i < 50; i++) {
      const currentBoxNum = startBox + i;
      if (i === 0) {
        // Helpful standard example row on the first item
        lines.push(
          `${currentBoxNum},Super-D Black Edge,6.67,20,YES,"Redmi Note 12, Poco X5 5G"`
        );
      } else {
        lines.push(`${currentBoxNum},,,,,`);
      }
    }

    const csvContent = lines.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="screenguards_import_template_${startBox}-${startBox + 49}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate template";
    console.error("[api/admin/boxes/template] Error:", msg);
    return NextResponse.json(
      { error: "Failed to generate import template", details: msg },
      { status: 500 }
    );
  }
}
