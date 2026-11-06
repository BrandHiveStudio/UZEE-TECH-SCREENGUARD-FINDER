import type { Box } from "@/types/screenguard";
import { VariantKey } from "./screenguard";

export interface ManifestItem {
  id: string;
  rawLine: string;
  modelQuery: string;
  matchedBox: Box | null;
  candidates: Box[];
  variant: VariantKey;
  quantity: number;
  matchStatus: "MATCHED_100" | "MULTIPLE_MATCH" | "UNMATCHED";
  selected: boolean;
}

const VARIANT_KEYWORDS: Array<{ key: VariantKey; patterns: RegExp[] }> = [
  {
    key: "privacy",
    patterns: [/\bprivacy\b/i, /\banti[\s-_]*spy\b/i, /\bspy\b/i],
  },
  {
    key: "matte",
    patterns: [/\bmatte\b/i, /\bfrosted\b/i, /\bgaming\b/i, /\bag\b/i],
  },
  {
    key: "borderless",
    patterns: [/\bborderless\b/i, /\bfull[\s-_]*glue\b/i, /\bseamless\b/i, /\bborder\b/i],
  },
  {
    key: "super_d",
    patterns: [/\bsuper[\s-_]*d\b/i, /\bclear\b/i, /\bstandard\b/i, /\bnormal\b/i, /\bsd\b/i],
  },
];

function detectVariantFromText(text: string): VariantKey {
  for (const item of VARIANT_KEYWORDS) {
    for (const pat of item.patterns) {
      if (pat.test(text)) return item.key;
    }
  }
  return "super_d";
}

/**
 * Searches boxes for a match using boxNumber, title, or compatibleModels.
 */
export function findMatchingBoxes(query: string, allBoxes: Box[]): Box[] {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ || cleanQ.length < 2) return [];

  // 1. Direct box number match (e.g. "box 048" or "048")
  const boxMatch = cleanQ.match(/box\s*(\d+)/i) || cleanQ.match(/^(\d{1,3})$/);
  if (boxMatch) {
    const boxNum = parseInt(boxMatch[1], 10);
    const padded = `BOX ${String(boxNum).padStart(3, "0")}`;
    const directBox = allBoxes.filter((b) => b.boxNumber.toUpperCase() === padded);
    if (directBox.length > 0) return directBox;
  }

  // 2. Exact model match in compatibleModels
  const exactModelMatches = allBoxes.filter((b) =>
    (b.compatibleModels || []).some((m) => m.toLowerCase() === cleanQ)
  );
  if (exactModelMatches.length > 0) return exactModelMatches;

  // 3. Exact title match
  const exactTitleMatches = allBoxes.filter((b) => b.title.toLowerCase() === cleanQ);
  if (exactTitleMatches.length > 0) return exactTitleMatches;

  // 4. Substring / Word Match
  const candidates: Array<{ box: Box; score: number }> = [];

  for (const b of allBoxes) {
    let score = 0;
    const titleLower = b.title.toLowerCase();

    if (titleLower.includes(cleanQ)) {
      score += 5;
    }

    for (const model of b.compatibleModels || []) {
      const modelLower = model.toLowerCase();
      if (modelLower === cleanQ) {
        score += 10;
      } else if (modelLower.startsWith(cleanQ) || cleanQ.startsWith(modelLower)) {
        score += 6;
      } else if (modelLower.includes(cleanQ)) {
        score += 3;
      }
    }

    if (score > 0) {
      candidates.push({ box: b, score });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).map((c) => c.box);
}

/**
 * Parses raw WhatsApp or invoice text into structured manifest line items.
 */
export function parseRawManifestText(rawText: string, allBoxes: Box[]): ManifestItem[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ManifestItem[] = [];

  const IGNORE_PATTERNS = [
    /^arrived/i,
    /^today/i,
    /^invoice/i,
    /^delivery/i,
    /^order/i,
    /^received/i,
    /^date/i,
    /^-+$/,
    /^=+$/,
  ];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (IGNORE_PATTERNS.some((p) => p.test(line))) continue;

    // Check if line contains multiple quantity/variant segments separated by comma
    // e.g. "A05 - 20 SuperD, 10 Privacy"
    // Extract base model name: everything before the first hyphen or colon or digit
    let modelPart = "";
    let specsPart = "";

    const sepIndex = line.search(/[-:=]/);
    if (sepIndex >= 0) {
      modelPart = line.substring(0, sepIndex).trim();
      specsPart = line.substring(sepIndex + 1).trim();
    } else {
      // Look for first number
      const numMatch = line.search(/\b\d+\b/);
      if (numMatch >= 0) {
        modelPart = line.substring(0, numMatch).trim();
        specsPart = line.substring(numMatch).trim();
      } else {
        modelPart = line;
        specsPart = "1 super_d";
      }
    }

    if (!modelPart && specsPart) {
      modelPart = specsPart;
      specsPart = "1 super_d";
    }

    const segments = specsPart.split(/[,&]/).map((s) => s.trim()).filter(Boolean);

    if (segments.length === 0) {
      segments.push("1 super_d");
    }

    for (const segment of segments) {
      // Extract quantity number from segment
      const qtyMatch = segment.match(/\b(\d+)\b/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

      // Extract variant
      const variant = detectVariantFromText(segment);

      // Match box for modelPart
      const candidates = findMatchingBoxes(modelPart, allBoxes);
      let matchStatus: ManifestItem["matchStatus"] = "UNMATCHED";
      let matchedBox: Box | null = null;

      if (candidates.length === 1) {
        matchStatus = "MATCHED_100";
        matchedBox = candidates[0];
      } else if (candidates.length > 1) {
        matchStatus = "MULTIPLE_MATCH";
        matchedBox = candidates[0]; // pick top scored by default
      }

      results.push({
        id: `manifest-${lineIndex}-${Math.random().toString(36).substring(2, 7)}`,
        rawLine: line,
        modelQuery: modelPart,
        matchedBox,
        candidates,
        variant,
        quantity: Math.max(1, qty),
        matchStatus,
        selected: matchedBox !== null,
      });
    }
  }

  return results;
}

