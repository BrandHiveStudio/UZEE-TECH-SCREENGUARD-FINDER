"use client";

import React from "react";
import { FileSpreadsheet } from "lucide-react";
import type { Box } from "@/types/screenguard";

interface ExportCsvButtonProps {
  boxes: Box[];
  className?: string;
}

export function ExportCsvButton({ boxes, className }: ExportCsvButtonProps) {
  const handleExport = () => {
    if (!boxes || boxes.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "Group ID",
      "Box Number",
      "Display Size",
      "Title",
      "Compatible Models",
      "Stock Quantity",
      "Units Sold",
      "Stock Status",
      "Stock Count Verified",
      "Source",
      "Verification",
      "Category",
      "Notes",
    ];

    const escapeCsv = (str: any) => `"${String(str ?? "").replace(/"/g, '""')}"`;

    const rows = boxes.map((b) => {
      const qty = b.stockQuantity ?? 0;
      const sold = b.unitsSold ?? 0;
      const verified = b.stockCountVerified ? "YES" : "NO";
      const status =
        b.stockStatus || (b.stockCountVerified ? (qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK") : "NOT_COUNTED");

      return [
        escapeCsv(b.id),
        escapeCsv(b.boxNumber),
        escapeCsv(b.displaySize || "Unknown"),
        escapeCsv(b.title),
        escapeCsv((b.compatibleModels || []).join(" | ")),
        escapeCsv(qty),
        escapeCsv(sold),
        escapeCsv(status),
        escapeCsv(verified),
        escapeCsv(b.source),
        escapeCsv(b.verification),
        escapeCsv(b.category || "Super-D"),
        escapeCsv(b.notes),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `UZEE_TECH_SCREENGUARD_LOCAL_SNAPSHOT_${timestamp}.csv`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={
        className ||
        "px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
      }
      title="Export Local CSV Snapshot of current working dataset"
    >
      <FileSpreadsheet className="w-4 h-4" />
      <span>Export Working CSV</span>
    </button>
  );
}

