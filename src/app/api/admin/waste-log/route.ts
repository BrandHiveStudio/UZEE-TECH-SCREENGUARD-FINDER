import { NextResponse } from "next/server";
import {
  getAllWasteLogs,
  getWasteStats,
  recordWasteEvent,
  WasteReason,
} from "@/lib/wasteLog";
import { VariantKey } from "@/lib/screenguard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await getAllWasteLogs(100);
    const stats = await getWasteStats();
    return NextResponse.json({ success: true, logs, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to retrieve waste logs", details: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { boxNumber, variant, quantity, reason, technicianNotes, modelName } = body;

    if (!boxNumber) {
      return NextResponse.json(
        { error: "boxNumber is required" },
        { status: 400 }
      );
    }

    if (!variant || !["super_d", "privacy", "matte", "borderless"].includes(variant)) {
      return NextResponse.json(
        { error: "Valid variant (super_d, privacy, matte, borderless) is required" },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "Quantity must be greater than 0" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "Waste reason is required" },
        { status: 400 }
      );
    }

    const result = await recordWasteEvent({
      boxNumber,
      variant: variant as VariantKey,
      quantity: qty,
      reason: reason as WasteReason,
      modelName,
      technicianNotes,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to record waste event", details: message },
      { status: 400 }
    );
  }
}

