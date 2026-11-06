import type { Box, ScreenGuardItem } from "@/types/screenguard";

// ─── Brand Synonym Dictionary ───────────────────────────────────────────────
export const BRAND_SYNONYMS: Record<string, string[]> = {
  samsung: ["sm", "sam", "samsu", "galaxy"],
  apple: ["iphone", "ip", "iph", "ios", "apple"],
  xiaomi: ["redmi", "mi", "poco", "xm", "rm"],
  tecno: ["tec", "camon", "spark", "pova"],
  infinix: ["inf", "hot", "smart"],
  vivo: ["y-series", "v-series", "iqoo", "vo"],
  realme: ["narzo", "c-series", "real"],
  motorola: ["moto", "mot"],
  oneplus: ["1+", "oneplus", "op"],
  oppo: ["op", "oppo"],
  honor: ["hn", "honor", "huawei"],
};

// Build reverse lookup: abbreviation -> canonical brand
const ALIAS_TO_BRAND: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(BRAND_SYNONYMS)) {
  ALIAS_TO_BRAND[canonical] = canonical;
  for (const alias of aliases) {
    ALIAS_TO_BRAND[alias.toLowerCase()] = canonical;
  }
}

/**
 * Normalizes a raw string:
 * - Lowercases and trims
 * - Replaces `+` with `plus`
 * - Strips common punctuation except alphanumeric
 * - Standardizes model notations like "note 13" <-> "note13"
 */
export function normalizeQuery(query: string): string {
  let q = query.toLowerCase().trim();

  // Replace '+' with 'plus' e.g. "7+" -> "7 plus"
  q = q.replace(/(\d+)\s*\+/g, "$1 plus");
  q = q.replace(/\+/g, " plus ");

  // Normalize multiple spaces
  q = q.replace(/\s+/g, " ").trim();
  return q;
}

/**
 * Compact a string by removing all whitespace and non-alphanumeric characters.
 * E.g., "A 05" -> "a05", "Redmi 13 C" -> "redmi13c"
 */
export function compactString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Extract numerical box indicator if the query is referring to a box directly.
 * E.g., "box 48", "box048", "box 048", "48", "#48", "048"
 */
export function parseBoxQuery(rawQuery: string): { isBoxQuery: boolean; numStr: string; cleanNum: number } | null {
  const q = rawQuery.trim().toLowerCase();
  
  // Matches "box 48", "box048", "box-48", "b 48"
  const boxMatch = q.match(/^(?:box|b)?\s*#?0*(\d{1,4})$/i);
  if (boxMatch && boxMatch[1]) {
    const cleanNum = parseInt(boxMatch[1], 10);
    return {
      isBoxQuery: true,
      numStr: boxMatch[1],
      cleanNum,
    };
  }

  return null;
}

/**
 * Checks whether a box matches an active brand filter (e.g. "Samsung", "Apple", "Xiaomi / Poco")
 */
export function matchesBrandFilter(
  box: Box | ScreenGuardItem,
  activeBrandFilter?: string
): boolean {
  if (!activeBrandFilter || activeBrandFilter === "All") return true;

  const targetBrands = activeBrandFilter
    .split("/")
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);

  // Check models and title
  const models = Array.isArray(box.compatibleModels)
    ? box.compatibleModels
    : (box.compatibleModels || "").split(",");

  const corpus = [box.title, ...models].join(" ").toLowerCase();

  return targetBrands.some((target) => {
    // Direct match
    if (corpus.includes(target)) return true;

    // Check canonical brand synonyms
    const canonical = ALIAS_TO_BRAND[target] || target;
    const aliases = BRAND_SYNONYMS[canonical] || [];
    return aliases.some((alias) => corpus.includes(alias));
  });
}

/**
 * Detects whether a string is explicitly querying for screen/display size.
 * Matches: "6.7", "6.7\"", "6.7 inch", "6.7 in", "6.7'", "display size 6.7", "6.78", etc.
 */
export function isScreenSizeQuery(str: string): boolean {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  // Decimal pattern e.g. 6.7, 6.1, 5.5, 6.78, 6.67
  if (/\b\d+\.\d+\b/.test(s)) return true;
  // Explicit inch notation e.g. 6", 6.7", 6.7inch, 6.7 in, 6.7'
  if (/\d+(?:\.\d+)?\s*(?:"|''|inch|inches|\bin\b)/i.test(s)) return true;
  // Explicit keyword with digits e.g. "screen 6.7", "cut 6.7", "size 6.7"
  if (/\b(?:screen|display|size|cut)\b/i.test(s) && /\d/.test(s)) return true;
  return false;
}

/**
 * Intelligent Retail Query Normalizer & Matcher
 * Resolves:
 * - "SM A05" -> Samsung Galaxy A05
 * - "Apple 7+" -> iPhone 7 Plus
 * - "ip 13 pro" -> iPhone 13 Pro
 * - "box 48", "048", "48" -> BOX 048
 * - spacing differences ("redmi 13 c" -> "redmi 13c")
 * - multi-token AND conjunction
 */
export function matchesBox(
  box: Box | ScreenGuardItem,
  rawQuery: string,
  activeBrandFilter?: string
): boolean {
  // 1. Check brand filter first
  if (!matchesBrandFilter(box, activeBrandFilter)) {
    return false;
  }

  const queryTrimmed = rawQuery.trim();
  if (!queryTrimmed) {
    return true; // No query: keep all boxes that pass brand filter
  }

  // 2. Direct Box Number Resolution
  const parsedBox = parseBoxQuery(queryTrimmed);
  const boxId = ("id" in box ? box.id : (box as ScreenGuardItem).groupId) || "";

  if (parsedBox) {
    const boxNumDigits = box.boxNumber.replace(/\D/g, "");
    if (boxNumDigits) {
      const boxInt = parseInt(boxNumDigits, 10);
      if (boxInt === parsedBox.cleanNum) {
        return true;
      }
    }
    // Also check id/groupId
    if (boxId.toLowerCase().includes(queryTrimmed.toLowerCase())) {
      return true;
    }
  }

  // 3. Prepare searchable text representations for this box
  const models = Array.isArray(box.compatibleModels)
    ? box.compatibleModels
    : (box.compatibleModels || "").split(/[,\n|]/);

  const rawTitle = box.title || "";
  const normalizedTitle = normalizeQuery(rawTitle);
  const normalizedModels = models.map((m) => normalizeQuery(m));

  // Full text corpus (excludes displaySize to avoid false positive number matches)
  const fullTextCorpus = [
    box.boxNumber.toLowerCase(),
    boxId.toLowerCase(),
    normalizedTitle,
    ...normalizedModels,
  ].join(" ");

  // Compact versions for spacing differences e.g. "a05" vs "a 05" (excludes displaySize)
  const compactCorpus = compactString([
    box.boxNumber,
    rawTitle,
    ...models,
  ].join(" "));

  // Combined models & title string for strict token/word and number sets
  const rawAndNormalizedStrings = [
    rawTitle,
    normalizedTitle,
    ...models,
    ...normalizedModels,
  ].join(" ");

  // Extract all individual model words cleaned of punctuation
  const modelWords = rawAndNormalizedStrings
    .toLowerCase()
    .replace(/[()[\]{},.;:/\\|_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const modelWordsSet = new Set(modelWords);

  // Extract standalone numbers from models & title
  const modelNumbers = rawAndNormalizedStrings.match(/\b\d+\b/g) || [];
  const modelNumbersSet = new Set(modelNumbers);

  const normalizedQ = normalizeQuery(queryTrimmed);
  const compactQ = compactString(normalizedQ);
  const queryIsScreenSize = isScreenSizeQuery(queryTrimmed);

  // Clean numeric display size if available (e.g. '6.7"' -> "6.7")
  const boxDisplayNumeric = box.displaySize
    ? box.displaySize.replace(/[^0-9.]/g, "")
    : "";

  // Fast direct match on compact string (only for non-numeric queries e.g. "sma05", "redmi13c")
  // Do NOT match purely numeric compact strings to prevent "7" matching "box017" or "iphone17"
  if (!/^\d+$/.test(compactQ) && compactCorpus.includes(compactQ)) {
    return true;
  }

  // 4. Token-based Multi-term AND Conjunction with Alias Expansion
  const queryTokens = normalizedQ.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return true;

  // Each token in query must be satisfied somewhere in the box
  const allTokensMatched = queryTokens.every((token) => {
    // A. Ignore screen size descriptive words when query is a screen size search
    if (queryIsScreenSize && /^(inch|inches|in|screen|display|size|cut)$/i.test(token)) {
      return true;
    }

    // B. Check if token is a screen size query (e.g. "6.7", "6.7\"", "6.7in")
    if (isScreenSizeQuery(token)) {
      if (boxDisplayNumeric) {
        const tokenNumeric = token.replace(/[^0-9.]/g, "");
        if (tokenNumeric && (boxDisplayNumeric === tokenNumeric || boxDisplayNumeric.startsWith(tokenNumeric))) {
          return true;
        }
      }
      return false;
    }

    // C. Purely numeric token (e.g. "7", "6", "8", "14", "15")
    // Require exact standalone token match in model numbers or words to avoid substring false positives
    if (/^\d+$/.test(token)) {
      if (modelNumbersSet.has(token) || modelWordsSet.has(token)) {
        return true;
      }
      // If the overall query was a screen size query, check display size
      if (queryIsScreenSize && boxDisplayNumeric) {
        if (boxDisplayNumeric === token || boxDisplayNumeric.startsWith(token + ".")) {
          return true;
        }
      }
      return false;
    }

    // D. Direct substring match in full corpus
    if (fullTextCorpus.includes(token)) return true;

    // E. Check compact token (for non-purely-numeric tokens like "a05")
    const tokenCompact = compactString(token);
    if (tokenCompact && !/^\d+$/.test(tokenCompact) && compactCorpus.includes(tokenCompact)) {
      return true;
    }

    // F. Expand brand abbreviations (e.g. "sm" -> "samsung", "ip" -> "iphone", "apple" -> "iphone")
    const canonical = ALIAS_TO_BRAND[token];
    if (canonical) {
      if (fullTextCorpus.includes(canonical)) return true;
      const synonyms = BRAND_SYNONYMS[canonical] || [];
      if (synonyms.some((syn) => fullTextCorpus.includes(syn))) return true;
    }

    // G. If token is like "a05" or "13c" or "note13" or "7plus"
    // Check if models have them split e.g. "a 05" or "note 13"
    const splitLetterDigit = token.replace(/([a-z]+)(\d+)/gi, "$1 $2");
    if (splitLetterDigit !== token && fullTextCorpus.includes(splitLetterDigit)) {
      return true;
    }

    return false;
  });

  return allTokensMatched;
}
