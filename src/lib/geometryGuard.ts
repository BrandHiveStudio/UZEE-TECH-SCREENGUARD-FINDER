import type { Box } from "@/types/screenguard";

export type NotchType =
  | "PUNCH_HOLE" // Center or corner punch hole cutout (e.g. Redmi Note 13, Galaxy A54)
  | "WATERDROP" // Tear-drop / V-notch / U-notch (e.g. Galaxy A05, Redmi 13C)
  | "DYNAMIC_ISLAND" // Pill cutout (iPhone 14 Pro, 15, 16 series)
  | "SOLID_BEZEL" // Flat unperforated top bezel (iPhone SE, older models)
  | "UNKNOWN";

export type EdgeCut =
  | "FLAT_2_5D" // Standard 2.5D curved-edge glass for flat panels
  | "CURVED_3D" // Full 3D curved glass for waterfall/curved OLEDs
  | "UNKNOWN";

export interface PhoneGeometryProfile {
  notchType: NotchType;
  edgeCut: EdgeCut;
  aspectRatio?: string;
  hasCameraCutoutOnGuard: boolean;
}

export interface FitmentEvaluation {
  scorePercent: number; // e.g. 100, 85, 50, etc.
  rating: "PERFECT_FIT" | "USABLE_FIT" | "CAUTION_MISMATCH";
  badgeText: string;
  color: "emerald" | "amber" | "rose";
  warningNote?: string;
}

export const NOTCH_META: Record<
  NotchType,
  { label: string; icon: string; short: string }
> = {
  PUNCH_HOLE: { label: "Punch Hole Cutout", icon: "⦿", short: "Punch Hole" },
  WATERDROP: { label: "Waterdrop / V-Notch", icon: "💧", short: "Waterdrop" },
  DYNAMIC_ISLAND: { label: "Dynamic Island", icon: "🏝️", short: "Dynamic Island" },
  SOLID_BEZEL: { label: "Solid Top Bezel", icon: "🔲", short: "Solid Bezel" },
  UNKNOWN: { label: "Standard Cut", icon: "📱", short: "Standard" },
};

export const EDGE_META: Record<
  EdgeCut,
  { label: string; short: string }
> = {
  FLAT_2_5D: { label: "Flat 2.5D Edge", short: "Flat 2.5D" },
  CURVED_3D: { label: "Curved 3D Edge", short: "Curved 3D" },
  UNKNOWN: { label: "Standard Glass", short: "2.5D Glass" },
};

/**
 * Infers phone and screenguard geometry profile based on model names, titles, and display size.
 */
export function inferGeometryProfile(
  target: Box | { title?: string; displaySize?: string; compatibleModels?: string[] } | string
): PhoneGeometryProfile {
  let combinedText = "";
  let displaySizeStr = "";

  if (typeof target === "string") {
    combinedText = target.toLowerCase();
  } else {
    combinedText = [
      target.title || "",
      ...(target.compatibleModels || []),
    ]
      .join(" ")
      .toLowerCase();
    displaySizeStr = target.displaySize || "";
  }

  // 1. Dynamic Island
  if (
    /\b(iphone\s*(14\s*pro|15|16)|dynamic\s*island)\b/i.test(combinedText)
  ) {
    return {
      notchType: "DYNAMIC_ISLAND",
      edgeCut: "FLAT_2_5D",
      hasCameraCutoutOnGuard: true,
    };
  }

  // 2. Curved 3D Glass check
  const isCurved =
    /\b(curved|ultra|edge|note\s*(10|20)\s*plus|reno\s*(10|11)\s*pro\s*plus|edge\s*(40|50))\b/i.test(
      combinedText
    ) &&
    !/\b(s24\s*ultra|s25\s*ultra|a0\d|a1\d|a2\d|iphone)\b/i.test(combinedText);

  // 3. Solid Bezel check (iPhone 6/7/8/SE)
  if (/\b(iphone\s*(6|7|8|se)|iphone\s*se\s*\d*)\b/i.test(combinedText)) {
    return {
      notchType: "SOLID_BEZEL",
      edgeCut: "FLAT_2_5D",
      hasCameraCutoutOnGuard: true,
    };
  }

  // 4. Waterdrop check (budget A series, C series, Y series)
  if (
    /\b(a0[1-6]|a1[0-5]|a2[0-4]|a3[0-2]|redmi\s*(9|10[ac]|12c|13c|14c|a[1-3])|poco\s*c\d+|y0\d|y1\d|y2\d|waterdrop|teardrop)\b/i.test(
      combinedText
    )
  ) {
    return {
      notchType: "WATERDROP",
      edgeCut: isCurved ? "CURVED_3D" : "FLAT_2_5D",
      hasCameraCutoutOnGuard: true,
    };
  }

  // 5. Punch Hole check (Modern midrange & flagships)
  if (
    /\b(note\s*(1[0-4])|poco\s*[xf]\d+|a5[1-5]|a7[1-3]|s2[0-4]|punch|nord|reno|camon)\b/i.test(
      combinedText
    )
  ) {
    return {
      notchType: "PUNCH_HOLE",
      edgeCut: isCurved ? "CURVED_3D" : "FLAT_2_5D",
      hasCameraCutoutOnGuard: false,
    };
  }

  // 6. Size-based fallback heuristic
  const sizeNum = parseFloat(displaySizeStr.replace(/[^0-9.]/g, ""));
  if (!isNaN(sizeNum) && sizeNum > 0) {
    if (sizeNum <= 6.55) {
      return {
        notchType: "WATERDROP",
        edgeCut: "FLAT_2_5D",
        hasCameraCutoutOnGuard: true,
      };
    } else {
      return {
        notchType: "PUNCH_HOLE",
        edgeCut: isCurved ? "CURVED_3D" : "FLAT_2_5D",
        hasCameraCutoutOnGuard: false,
      };
    }
  }

  return {
    notchType: "UNKNOWN",
    edgeCut: isCurved ? "CURVED_3D" : "FLAT_2_5D",
    hasCameraCutoutOnGuard: false,
  };
}

/**
 * Compares geometry of source phone against target alternative box screenguard glass.
 */
export function compareGeometryFitment(
  source: PhoneGeometryProfile,
  target: PhoneGeometryProfile
): FitmentEvaluation {
  // Edge Mismatch Check: Curved screen vs Flat glass (or vice-versa)
  if (
    (source.edgeCut === "CURVED_3D" && target.edgeCut === "FLAT_2_5D") ||
    (source.edgeCut === "FLAT_2_5D" && target.edgeCut === "CURVED_3D")
  ) {
    return {
      scorePercent: 45,
      rating: "CAUTION_MISMATCH",
      badgeText: "Caution - Edge Halo / Bubble Risk",
      color: "rose",
      warningNote: "Curved edge curvature mismatch will cause glass halo lifting or air bubbles on display borders.",
    };
  }

  // Dynamic Island Intrusion Check
  if (
    source.notchType === "DYNAMIC_ISLAND" &&
    target.notchType !== "DYNAMIC_ISLAND"
  ) {
    return {
      scorePercent: 50,
      rating: "CAUTION_MISMATCH",
      badgeText: "Caution - Notch Intrusion",
      color: "rose",
      warningNote: "Notch or punch hole cutout overlaps into Dynamic Island pill sensor area.",
    };
  }

  // Source Waterdrop vs Target Punch Hole
  if (
    source.notchType === "WATERDROP" &&
    target.notchType === "PUNCH_HOLE"
  ) {
    return {
      scorePercent: 70,
      rating: "CAUTION_MISMATCH",
      badgeText: "70% Caution - Waterdrop Sensor Clipped",
      color: "rose",
      warningNote: "Waterdrop camera notch may extend below punch hole boundary.",
    };
  }

  // Exact Match
  if (
    source.notchType === target.notchType &&
    source.edgeCut === target.edgeCut &&
    source.notchType !== "UNKNOWN"
  ) {
    return {
      scorePercent: 100,
      rating: "PERFECT_FIT",
      badgeText: "100% Perfect Cutout Match",
      color: "emerald",
      warningNote: undefined,
    };
  }

  // Source Punch Hole vs Target Solid / Full Glass
  if (
    source.notchType === "PUNCH_HOLE" &&
    (target.notchType === "SOLID_BEZEL" || !target.hasCameraCutoutOnGuard)
  ) {
    return {
      scorePercent: 85,
      rating: "USABLE_FIT",
      badgeText: "85% Usable - Solid Over Cutout",
      color: "amber",
      warningNote: "Glass covers camera without hole; facial recognition and selfie camera remain functional through high-transparency glass.",
    };
  }

  // Generic acceptable fit
  return {
    scorePercent: 80,
    rating: "USABLE_FIT",
    badgeText: "80% Usable - Geometric Fit",
    color: "amber",
    warningNote: "Minor bezel variance; display active viewing area is completely protected.",
  };
}

