import { NextResponse } from "next/server";
import { getAllBoxes, upsertBox, deleteBox } from "@/lib/db";
import { normalizeVariants, calculateTotalStock } from "@/lib/screenguard";
import type { Box } from "@/types/screenguard";

export const dynamic = "force-dynamic";

function prepareBoxData(rawBox: any): Box {
  const variants = normalizeVariants(rawBox.variants, rawBox.stockQuantity ?? 0);
  const totalStock = calculateTotalStock(variants);

  return {
    ...rawBox,
    stockQuantity: totalStock,
    variants,
  };
}

// ─── GET /api/screenguards/[id] ───────────────────────────────────────────────
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const boxes = await getAllBoxes();
    const box = boxes.find((b) => b.id === id);

    if (!box) {
      return NextResponse.json({ error: `Box '${id}' not found` }, { status: 404 });
    }

    return NextResponse.json({ box });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch box", details: message },
      { status: 500 }
    );
  }
}

// ─── PUT /api/screenguards/[id] ───────────────────────────────────────────────
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const rawBox = body.box || body;

    const box = prepareBoxData({
      ...rawBox,
      id,
    });

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

// ─── PATCH /api/screenguards/[id] ─────────────────────────────────────────────
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const rawBox = body.box || body;

    const allBoxes = await getAllBoxes();
    const existing = allBoxes.find((b) => b.id === id);

    const merged = existing ? { ...existing, ...rawBox, id } : { ...rawBox, id };
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

// ─── DELETE /api/screenguards/[id] ────────────────────────────────────────────
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
