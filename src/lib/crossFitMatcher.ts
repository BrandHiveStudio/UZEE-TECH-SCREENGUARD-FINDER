import type { Box, ScreenGuardVariants } from "@/types/screenguard";
import {
  inferGeometryProfile,
  compareGeometryFitment,
  type PhoneGeometryProfile,
  type FitmentEvaluation,
} from "./geometryGuard";

export interface CrossFitAlternative {
  boxNumber: string;
  boxId: string;
  title: string;
  displaySize: string;
  totalStock: number;
  variants: ScreenGuardVariants;
  reason: string;
  matchedModelSummary: string;
  geometry: PhoneGeometryProfile;
  fitment: FitmentEvaluation;
}

/**
 * Normalizes display size strings like '6.5"', '6.5 inch', '6.5 ' -> '6.5'
 */
export function normalizeDisplaySize(size?: string | null): string {
  if (!size) return "";
  return size
    .replace(/["'”’]/g, "")
    .replace(/inch(es)?/gi, "")
    .trim()
    .toLowerCase();
}

/**
 * Finds in-stock cross-fit alternative boxes with matching screen geometry/display cut.
 */
export function findCrossFitAlternatives(
  targetBox: Box,
  allBoxes: Box[]
): CrossFitAlternative[] {
  const targetSize = normalizeDisplaySize(targetBox.displaySize);
  if (!targetSize || targetSize === "unknown") {
    return [];
  }

  const sourceGeometry = inferGeometryProfile(targetBox);
  const alternatives: CrossFitAlternative[] = [];

  for (const b of allBoxes) {
    // Skip self
    if (b.id === targetBox.id || b.boxNumber.toLowerCase() === targetBox.boxNumber.toLowerCase()) {
      continue;
    }

    const bSize = normalizeDisplaySize(b.displaySize);
    if (!bSize || bSize !== targetSize) {
      continue;
    }

    const stock = b.stockQuantity ?? 0;
    if (stock <= 0) {
      continue;
    }

    const targetGeometry = inferGeometryProfile(b);
    const fitment = compareGeometryFitment(sourceGeometry, targetGeometry);

    const vars: ScreenGuardVariants = b.variants || {
      super_d: stock,
      privacy: 0,
      matte: 0,
      borderless: 0,
    };

    const variantBreakdownParts: string[] = [];
    if (vars.super_d > 0) variantBreakdownParts.push(`${vars.super_d} Clear`);
    if (vars.privacy > 0) variantBreakdownParts.push(`${vars.privacy} Privacy`);
    if (vars.matte > 0) variantBreakdownParts.push(`${vars.matte} Matte`);
    if (vars.borderless > 0) variantBreakdownParts.push(`${vars.borderless} Borderless`);

    const stockSummary = variantBreakdownParts.length > 0 ? variantBreakdownParts.join(" / ") : `${stock} units`;
    const primaryModel = b.compatibleModels && b.compatibleModels.length > 0 ? b.compatibleModels[0] : b.title;

    alternatives.push({
      boxNumber: b.boxNumber,
      boxId: b.id,
      title: b.title,
      displaySize: b.displaySize || `${targetSize}"`,
      totalStock: stock,
      variants: vars,
      reason: `Identical ${b.displaySize || `${targetSize}"`} display cut with ${stockSummary} in stock`,
      matchedModelSummary: primaryModel,
      geometry: targetGeometry,
      fitment,
    });
  }

  // Sort by highest fitment score first, then by totalStock
  return alternatives.sort((a, b) => {
    if (b.fitment.scorePercent !== a.fitment.scorePercent) {
      return b.fitment.scorePercent - a.fitment.scorePercent;
    }
    return b.totalStock - a.totalStock;
  });
}
