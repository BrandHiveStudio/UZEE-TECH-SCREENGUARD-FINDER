import jsPDF from "jspdf";
import type { ScreenGuardItem, Box } from "@/types/screenguard";

export type LabelItemCompatible = ScreenGuardItem | Box | {
  boxNumber: string;
  title: string;
  displaySize?: string;
  compatibleModels: string[] | string;
};

export interface SelectedLabelItem {
  item: LabelItemCompatible;
  quantity: number;
}

/**
 * Generates an A4 PDF containing 3 columns x 4 rows = 12 box units per sheet.
 * Exact cell dimensions: 67mm width x 72mm height.
 * Margins: 4.5mm horizontal, 4.5mm vertical.
 */
export function generateA4LabelsPdf(selectedItemsWithQty: SelectedLabelItem[]): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4", // 210 x 297 mm
  });

  // Flatten the queue based on quantities
  const flattenedList: LabelItemCompatible[] = [];
  for (const entry of selectedItemsWithQty) {
    const qty = Math.max(1, entry.quantity || 1);
    for (let i = 0; i < qty; i++) {
      flattenedList.push(entry.item);
    }
  }

  if (flattenedList.length === 0) {
    // Return empty single page
    return doc;
  }

  const marginX = 4.5;
  const marginY = 4.5;
  const cellWidth = 67;
  const cellHeight = 72;
  const colsPerPage = 3;
  const rowsPerPage = 4;
  const unitsPerPage = colsPerPage * rowsPerPage; // 12

  flattenedList.forEach((item, index) => {
    // Add page if past first page slots
    if (index > 0 && index % unitsPerPage === 0) {
      doc.addPage();
    }

    const pageIndex = index % unitsPerPage;
    const col = pageIndex % colsPerPage;
    const row = Math.floor(pageIndex / colsPerPage);

    const x = marginX + col * cellWidth;
    const y = marginY + row * cellHeight;

    // ── 1. Outer Dashed Cut Guide ───────────────────────────────────────────
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.rect(x, y, cellWidth, cellHeight);
    doc.setLineDashPattern([], 0); // reset dash pattern

    // ── 2. Top Spine Strip (17mm height: y to y + 17) ───────────────────────
    // Spine divider line
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(x, y + 17, x + cellWidth, y + 17);

    // Solid Black Number Badge (left 22mm x 13mm)
    doc.setFillColor(15, 23, 42); // slate-900 / black
    doc.roundedRect(x + 2, y + 2, 22, 13, 1.2, 1.2, "F");

    // Box Number White Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const boxNo = item.boxNumber.replace(/box\s*/i, "").trim();
    doc.text(`BOX ${boxNo}`, x + 13, y + 9.5, { align: "center" });

    // Right of Badge: Series Title & Display Size
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const titleLines = doc.splitTextToSize(item.title || "Super-D Guard", 39);
    doc.text(titleLines.slice(0, 2), x + 26, y + 6.5);

    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const sizeStr = item.displaySize ? `Size: ${item.displaySize}` : "Universal Cut";
    doc.text(sizeStr, x + 26, y + 13.5);

    // ── 3. Bottom Front Face Card (55mm height: y + 17 to y + 72) ───────────
    // Centered BOX NUMBER Header
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const fullBoxHeader = item.boxNumber.toUpperCase().startsWith("BOX")
      ? item.boxNumber.toUpperCase()
      : `BOX ${item.boxNumber.toUpperCase()}`;
    doc.text(fullBoxHeader, x + cellWidth / 2, y + 24, { align: "center" });

    // Horizontal divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.25);
    doc.line(x + 6, y + 26.5, x + cellWidth - 6, y + 26.5);

    // Primary model name (bold)
    let modelsArray: string[] = [];
    if (Array.isArray(item.compatibleModels)) {
      modelsArray = item.compatibleModels;
    } else if (typeof item.compatibleModels === "string") {
      modelsArray = item.compatibleModels.split("|").map((m) => m.trim()).filter(Boolean);
    }

    const primaryModel = modelsArray[0] || item.title || "Universal Fit";
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const primaryLines = doc.splitTextToSize(primaryModel, 56);
    doc.text(primaryLines.slice(0, 1), x + cellWidth / 2, y + 31.5, { align: "center" });

    // Wrapped compatible model aliases
    doc.setTextColor(70, 70, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);

    const aliasesText = modelsArray.join(" • ");
    const wrappedAliases = doc.splitTextToSize(aliasesText, 60);

    // Print up to 7 wrapped lines
    doc.text(wrappedAliases.slice(0, 7), x + 3.5, y + 37);

    // Small footer watermark / packaging badge
    doc.setTextColor(170, 170, 170);
    doc.setFontSize(6);
    doc.text("UZEE TECH • SUPER-D COMPATIBILITY", x + cellWidth / 2, y + 70, { align: "center" });
  });

  return doc;
}

/**
 * Triggers direct browser printing of the A4 PDF via hidden iframe.
 */
export function printA4LabelsDirect(selectedItemsWithQty: SelectedLabelItem[]): void {
  const doc = generateA4LabelsPdf(selectedItemsWithQty);
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.opacity = "0.01";
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      }, 60000); // Clean up after 1 minute
    }, 250);
  };
}

