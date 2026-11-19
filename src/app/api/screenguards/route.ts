import { NextResponse } from "next/server";
import { getAllBoxes, upsertBox, deleteBox } from "@/lib/db";
import { normalizeVariants, calculateTotalStock } from "@/lib/screenguard";
import type { Box } from "@/types/screenguard";

// Force this route to be dynamic — never statically pre-rendered at build time.
export const dynamic = "force-dynamic";

// ─── GET /api/screenguards ────────────────────────────────────────────────────
export async function GET() {
  try {
    const boxes = await getAllBoxes();
    return NextResponse.json(
      { boxes, totalBoxes: boxes.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch data", details: message },
      { status: 500 }
    );
  }
}

// ─── Helper to normalize and prepare Box for persistence ──────────────────────
function prepareBoxData(rawBox: any): Box {
  const variants = normalizeVariants(rawBox.variants, rawBox.stockQuantity ?? 0);
  const totalStock = calculateTotalStock(variants);

  return {
    ...rawBox,
    stockQuantity: totalStock,
    variants,
  };
}

// ─── POST /api/screenguards ───────────────────────────────────────────────────
// Body: { action: "upsert", box: Box }
//       { action: "delete", id: string }
//       { box: Box } or direct box properties
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "delete") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { error: "id is required for delete" },
          { status: 400 }
        );
      }
      await deleteBox(id);
      return NextResponse.json({ success: true });
    }

    // Handle upsert action or direct box payload
    const rawBox = body.box || (body.id && body.boxNumber ? body : null);
    if (!rawBox || !rawBox.id || !rawBox.boxNumber) {
      return NextResponse.json(
        { error: "Invalid box data — id and boxNumber are required" },
        { status: 400 }
      );
    }

    const box = prepareBoxData(rawBox);
    const saved = await upsertBox(box);
    return NextResponse.json({ success: true, box: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Request failed", details: message },
      { status: 500 }
    );
  }
}

// ─── PUT /api/screenguards ────────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const rawBox = body.box || body;

    if (!rawBox || !rawBox.id || !rawBox.boxNumber) {
      return NextResponse.json(
        { error: "Invalid box data — id and boxNumber are required" },
        { status: 400 }
      );
    }

    const box = prepareBoxData(rawBox);
    const saved = await upsertBox(box);
    return NextResponse.json({ success: true, box: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "PUT failed", details: message },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/screenguards ──────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const rawBox = body.box || body;
    const targetId = rawBox?.id;

    if (!targetId) {
      return NextResponse.json({ error: "id is required for PATCH" }, { status: 400 });
    }

    const allBoxes = await getAllBoxes();
    const existing = allBoxes.find((b) => b.id === targetId);

    const merged = existing ? { ...existing, ...rawBox } : rawBox;
    const box = prepareBoxData(merged);
    const saved = await upsertBox(box);
    return NextResponse.json({ success: true, box: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "PATCH failed", details: message },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/screenguards ─────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: "id is required for delete" }, { status: 400 });
    }

    await deleteBox(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "DELETE failed", details: message },
      { status: 500 }
    );
  }
}
