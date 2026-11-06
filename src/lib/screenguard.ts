export interface ScreenGuardVariants {
  super_d: number;
  privacy: number;
  matte: number;
  borderless: number;
}

export type VariantKey = "super_d" | "privacy" | "matte" | "borderless";

export const VARIANT_META: Record<
  VariantKey,
  { label: string; icon: string; shortName: string; color: string }
> = {
  super_d: {
    label: "Clear / Super-D",
    icon: "✨",
    shortName: "Clear",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  privacy: {
    label: "Privacy",
    icon: "🕶️",
    shortName: "Privacy",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
  matte: {
    label: "Matte",
    icon: "🌫️",
    shortName: "Matte",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  borderless: {
    label: "Borderless",
    icon: "🔲",
    shortName: "Borderless",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
};


export interface ScreenGuardItem {
  groupId: string;             // e.g. "box-048"
  boxNumber: string;           // e.g. "BOX 048"
  displaySize: string;         // e.g. "6.5\""
  title: string;               // e.g. "Samsung Galaxy A05"
  compatibleModels: string;    // pipe-delimited string
  stockQuantity: number;       // total sum: super_d + privacy + matte + borderless
  variants?: ScreenGuardVariants;
  stockStatus: string;         // "IN STOCK" | "LOW STOCK" | "OUT OF STOCK"
  stockCountVerified: string;  // "YES" | "NO"
  category: string;            // Default: "Super-D"
  notes?: string;
}

/**
 * Calculates the next sequential box number and groupId.
 * E.g., if max box is "BOX 148", returns { nextBoxNumber: "BOX 149", nextGroupId: "box-149" }
 */
export function getNextBoxSequence(
  existingItems: Array<{ boxNumber: string; id?: string; groupId?: string }>
): { nextBoxNumber: string; nextGroupId: string } {
  let maxNumber = 0;
  for (const item of existingItems) {
    if (!item?.boxNumber) continue;
    const match = item.boxNumber.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }
  const nextNum = maxNumber + 1;
  const padded = String(nextNum).padStart(3, "0");
  return {
    nextBoxNumber: `BOX ${padded}`,
    nextGroupId: `box-${padded}`,
  };
}

/**
 * Ensures variant object is valid and safe, falling back to super_d = fallbackTotal if empty.
 */
export function normalizeVariants(
  variants?: Partial<ScreenGuardVariants> | null,
  fallbackTotal = 0
): ScreenGuardVariants {
  if (!variants || typeof variants !== "object") {
    return {
      super_d: Math.max(0, fallbackTotal),
      privacy: 0,
      matte: 0,
      borderless: 0,
    };
  }
  return {
    super_d: Math.max(0, Number(variants.super_d ?? fallbackTotal)),
    privacy: Math.max(0, Number(variants.privacy ?? 0)),
    matte: Math.max(0, Number(variants.matte ?? 0)),
    borderless: Math.max(0, Number(variants.borderless ?? 0)),
  };
}

/**
 * Returns sum of all variants.
 */
export function calculateTotalStock(variants: ScreenGuardVariants): number {
  return (
    (variants.super_d || 0) +
    (variants.privacy || 0) +
    (variants.matte || 0) +
    (variants.borderless || 0)
  );
}

